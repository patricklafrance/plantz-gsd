/**
 * Phase 3 rotation engine. Pure functions + the single-write-path transitionCycle.
 *
 * Canonical references:
 *  - PITFALLS.md §Pitfall 5, 6, 7, 8 — DST safety, row-lock pattern, null-return
 *  - CONTEXT.md D-01..D-05, D-14..D-19 — cycle lifecycle and notifications
 *  - RESEARCH.md §Pattern 1, §Pattern 2 — verbatim code templates
 *
 * IMPORTANT: This file does NOT have the "use server" directive — it is a plain
 * domain module callable from Server Actions (actions.ts), orchestrators (cron.ts),
 * and Route Handlers (app/api/cron/...).
 */
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { addDays, startOfDay } from "date-fns";
import { TZDate } from "@date-fns/tz";
import type { TransitionReason, NotificationType } from "./constants";

/**
 * Return shape for transitionCycle (implemented below). Declared at module top
 * so the exported contract is visible alongside the pure helpers; tests + Wave 3
 * callers can import this type without depending on the function body.
 */
export type TransitionResult =
  | { skipped: true }
  | {
      transitioned: true;
      fromCycleNumber: number;
      toCycleNumber: number;
      reason: TransitionReason;
      assignedUserId: string | null;
      status: "active" | "paused";
    };

/**
 * ROTA-02 deterministic rotation formula.
 * Pitfall 8: single-member household returns 0 via `% 1`.
 *
 * NOT used by `transitionCycle` — the live write path uses `findNextAssignee`
 * to account for availability. This pure helper exists as a standalone
 * rotation invariant, exercised directly by `tests/phase-03/rotation-formula.test.ts`
 * and reserved for the Phase 6+ dashboard "upcoming rotation" preview that
 * needs a deterministic answer without touching availability. If this function
 * ever drifts from `findNextAssignee`'s baseline (no-unavailability) behavior,
 * the rotation-formula tests will fail.
 */
export function computeAssigneeIndex(
  anchorDate: Date,
  now: Date,
  cycleDuration: number,
  memberCount: number,
): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysSince = Math.floor((now.getTime() - anchorDate.getTime()) / msPerDay);
  return Math.floor(daysSince / cycleDuration) % memberCount;
}

/**
 * D-02 + Pitfall 6: DST-safe initial cycle boundaries.
 * anchorDate = start of next local day in household timezone, materialized as UTC.
 * endDate = anchorDate + cycleDuration days with wall-clock preservation.
 */
export function computeInitialCycleBoundaries(
  now: Date,
  timezone: string,
  cycleDuration: number,
): { anchorDate: Date; startDate: Date; endDate: Date } {
  const nowInZone = new TZDate(now.getTime(), timezone);
  const tomorrowStartLocal = startOfDay(addDays(nowInZone, 1));
  const endLocal = addDays(tomorrowStartLocal, cycleDuration);
  return {
    anchorDate: new Date(tomorrowStartLocal.getTime()),
    startDate: new Date(tomorrowStartLocal.getTime()),
    endDate: new Date(endLocal.getTime()),
  };
}

/**
 * Pitfall 6: next-cycle boundary computation. Contiguous (next startDate = outgoing endDate).
 * Wall-clock preserving via TZDate addition.
 */
export function computeNextCycleBoundaries(
  outgoingEndDate: Date,
  timezone: string,
  cycleDuration: number,
): { startDate: Date; endDate: Date } {
  const startInZone = new TZDate(outgoingEndDate.getTime(), timezone);
  const endInZone = addDays(startInZone, cycleDuration);
  return {
    startDate: new Date(startInZone.getTime()),
    endDate: new Date(endInZone.getTime()),
  };
}

/**
 * Pitfall 8 + AVLB-03 + AVLB-05: walks the rotation from current+1, skipping
 * unavailable members. Returns owner (with fallback=true) when all non-owners
 * are unavailable. Returns null when owner is also unavailable (caller creates
 * a paused cycle).
 *
 * `tx` is a Prisma transaction client; passed in so the availability read shares
 * the transaction's snapshot.
 */
type MemberRow = {
  userId: string;
  rotationOrder: number;
  role: string; // 'OWNER' | 'MEMBER'
};

export async function findNextAssignee(
  tx: Prisma.TransactionClient,
  householdId: string,
  members: MemberRow[],
  outgoing: { assignedUserId: string | null; endDate: Date },
): Promise<{ userId: string; fallback: boolean } | null> {
  const unavailableRows = await tx.availability.findMany({
    where: {
      householdId,
      startDate: { lte: outgoing.endDate },
      endDate: { gte: outgoing.endDate },
    },
    select: { userId: true },
  });
  const unavailable = new Set(unavailableRows.map((r) => r.userId));

  const sorted = [...members].sort((a, b) => a.rotationOrder - b.rotationOrder);
  if (sorted.length === 0) return null;

  // Pitfall 8: single-member household — the only member is always "next"
  // and this is the normal path (NOT owner-fallback). If they're unavailable,
  // fall through to the null path (paused).
  if (sorted.length === 1) {
    const sole = sorted[0];
    if (!unavailable.has(sole.userId)) {
      return { userId: sole.userId, fallback: false };
    }
    return null;
  }

  const currentIdx = sorted.findIndex((m) => m.userId === outgoing.assignedUserId);
  // Walk every OTHER position (n-1 candidates). The outgoing assignee is not
  // a candidate in the normal walker — if the walker finds no one, the post-
  // loop owner-fallback branch (AVLB-05) returns the owner with fallback=true.
  // This mirrors the plan Task 1 <behavior> contract: normal rotation returns
  // `fallback:false`; owner-fallback is a DISTINCT state, reached only when
  // all non-outgoing members are unavailable.
  const walkLen = currentIdx === -1 ? sorted.length : sorted.length - 1;
  const startIdx = currentIdx === -1 ? 0 : (currentIdx + 1) % sorted.length;

  for (let i = 0; i < walkLen; i++) {
    const candidate = sorted[(startIdx + i) % sorted.length];
    if (!unavailable.has(candidate.userId)) {
      return { userId: candidate.userId, fallback: false };
    }
  }

  // All non-outgoing members unavailable. AVLB-05 owner fallback.
  const owner = sorted.find((m) => m.role === "OWNER");
  if (owner && !unavailable.has(owner.userId)) {
    return { userId: owner.userId, fallback: true };
  }
  return null;
}

/**
 * D-18: TransitionReason → NotificationType mapping.
 * - cycle_end / paused_resumed → cycle_started (D-18 explicit reuse)
 * - manual_skip → cycle_reassigned_manual_skip
 * - auto_skip_unavailable → cycle_reassigned_auto_skip
 * - member_left → cycle_reassigned_member_left
 * - all_unavailable_fallback → cycle_fallback_owner
 */
export function mapReasonToNotificationType(reason: TransitionReason): NotificationType {
  switch (reason) {
    case "cycle_end":
    case "paused_resumed":
      return "cycle_started";
    case "manual_skip":
      return "cycle_reassigned_manual_skip";
    case "auto_skip_unavailable":
      return "cycle_reassigned_auto_skip";
    case "member_left":
      return "cycle_reassigned_member_left";
    case "all_unavailable_fallback":
      return "cycle_fallback_owner";
  }
}

/**
 * Prisma P2002 unique violation detector. Used to swallow duplicate notification
 * INSERTs from idempotent cron retries (D-19).
 */
export function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"
  );
}

/**
 * The single-write-path cycle transition function. Callers: cron orchestrator,
 * skipCurrentCycle action, Phase 4 leaveHousehold action.
 *
 * Invariants (binding):
 *  - $queryRaw with FOR UPDATE SKIP LOCKED is the FIRST statement inside the
 *    $transaction callback. NEVER call it outside the callback (Pitfall B).
 *  - Notification INSERT is INSIDE the same transaction (Pitfall 7 / D-15).
 *  - P2002 from notification insert is swallowed via isUniqueViolation (D-19).
 *  - `reason` hint from caller may be upgraded by the engine based on rotation
 *    state (cycle_end → auto_skip_unavailable when findNextAssignee walks past
 *    unavailable members; cycle_end → all_unavailable_fallback on owner-fallback;
 *    cycle_end → paused_resumed when outgoing status was 'paused').
 */
export async function transitionCycle(
  householdId: string,
  hintReason: TransitionReason,
): Promise<TransitionResult> {
  return db.$transaction(async (tx) => {
    // STEP 1 — Lock the outgoing cycle. SKIP LOCKED = non-blocking no-op on contention.
    const lockedRows = await tx.$queryRaw<
      Array<{
        id: string;
        householdId: string;
        cycleNumber: number;
        anchorDate: Date;
        cycleDuration: number;
        startDate: Date;
        endDate: Date;
        status: string;
        assignedUserId: string | null;
      }>
    >`
      SELECT id, "householdId", "cycleNumber", "anchorDate", "cycleDuration",
             "startDate", "endDate", status, "assignedUserId"
      FROM "Cycle"
      WHERE "householdId" = ${householdId}
        AND status IN ('active', 'paused')
      ORDER BY "cycleNumber" DESC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `;

    if (lockedRows.length === 0) {
      return { skipped: true } as const;
    }
    const outgoing = lockedRows[0];

    // STEP 2 — load household (for timezone) + live members.
    const household = await tx.household.findUniqueOrThrow({
      where: { id: householdId },
      select: { id: true, timezone: true, cycleDuration: true },
    });
    const members = await tx.householdMember.findMany({
      where: { householdId },
      orderBy: { rotationOrder: "asc" },
      select: { userId: true, rotationOrder: true, role: true },
    });

    // STEP 3 — next assignee.
    const nextAssignee = await findNextAssignee(tx, householdId, members, {
      assignedUserId: outgoing.assignedUserId,
      endDate: outgoing.endDate,
    });

    // STEP 4 — compute boundaries in the household's timezone.
    const { startDate: nextStart, endDate: nextEnd } =
      computeNextCycleBoundaries(
        outgoing.endDate,
        household.timezone,
        household.cycleDuration,
      );

    // STEP 5 — determine the final reason.
    // Caller hints (e.g., cron passes "cycle_end") may be upgraded.
    let finalReason: TransitionReason = hintReason;
    if (outgoing.status === "paused" && hintReason === "cycle_end") {
      finalReason = "paused_resumed";
    } else if (nextAssignee?.fallback) {
      // Owner fallback: all non-outgoing members unavailable but owner IS available
      finalReason = "all_unavailable_fallback";
    } else if (!nextAssignee) {
      // Everyone — including owner — unavailable. Outgoing cycle closes with
      // an all_unavailable_fallback label; new cycle is paused, no notification.
      finalReason = "all_unavailable_fallback";
    } else if (
      hintReason === "cycle_end" &&
      nextAssignee &&
      !isSequentialNext(members, outgoing.assignedUserId, nextAssignee.userId)
    ) {
      // Walker stepped past an unavailable member (auto-skip).
      finalReason = "auto_skip_unavailable";
    }

    // STEP 6 — write next cycle (active or paused).
    const nextStatus: "active" | "paused" = nextAssignee ? "active" : "paused";
    const nextAssignedUserId = nextAssignee ? nextAssignee.userId : null;

    const nextCycle = await tx.cycle.create({
      data: {
        householdId,
        cycleNumber: outgoing.cycleNumber + 1,
        anchorDate: nextStart,
        cycleDuration: household.cycleDuration,
        startDate: nextStart,
        endDate: nextEnd,
        status: nextStatus,
        assignedUserId: nextAssignedUserId,
        memberOrderSnapshot: members.map((m) => ({
          userId: m.userId,
          rotationOrder: m.rotationOrder,
        })),
      },
    });

    // STEP 7 — close outgoing cycle.
    const outgoingClosedStatus =
      finalReason === "manual_skip" ||
      finalReason === "auto_skip_unavailable" ||
      finalReason === "member_left"
        ? "skipped"
        : "completed";
    await tx.cycle.update({
      where: { id: outgoing.id },
      data: {
        status: outgoingClosedStatus,
        transitionReason: finalReason,
      },
    });

    // STEP 8 — notification for incoming assignee (D-15 inside-same-transaction).
    if (nextAssignedUserId) {
      const notificationType = mapReasonToNotificationType(finalReason);
      // WR-02 (Phase 5 review): snapshot the outgoing assignee's userId on
      // cycle_reassigned_* rows so read-time UI renders the correct
      // "<name> skipped / left / is unavailable" regardless of later rotation
      // order churn. Left NULL on cycle_started + cycle_fallback_owner (no
      // prior-assignee semantics for those types).
      const priorAssigneeUserId = notificationType.startsWith("cycle_reassigned_")
        ? outgoing.assignedUserId
        : null;
      try {
        await tx.householdNotification.create({
          data: {
            householdId,
            recipientUserId: nextAssignedUserId,
            type: notificationType,
            cycleId: nextCycle.id,
            priorAssigneeUserId,
          },
        });
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
      }
    }

    return {
      transitioned: true,
      fromCycleNumber: outgoing.cycleNumber,
      toCycleNumber: nextCycle.cycleNumber,
      reason: finalReason,
      assignedUserId: nextAssignedUserId,
      status: nextStatus,
    } as const;
  });
}

/**
 * Helper: detect whether `findNextAssignee` returned the rotation-sequential
 * next member (no unavailability skip) vs. stepped past one or more unavailable
 * members. Used to upgrade a "cycle_end" hint to "auto_skip_unavailable".
 */
function isSequentialNext(
  members: Array<{ userId: string; rotationOrder: number }>,
  outgoingAssigneeId: string | null,
  nextAssigneeId: string,
): boolean {
  if (members.length === 0) return true;
  const sorted = [...members].sort((a, b) => a.rotationOrder - b.rotationOrder);
  const currentIdx = sorted.findIndex((m) => m.userId === outgoingAssigneeId);
  const expectedIdx = currentIdx === -1 ? 0 : (currentIdx + 1) % sorted.length;
  return sorted[expectedIdx]?.userId === nextAssigneeId;
}

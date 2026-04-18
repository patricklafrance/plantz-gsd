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

// transitionCycle lives in Task 2 — appended below in this file.

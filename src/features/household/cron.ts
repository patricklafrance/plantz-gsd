/**
 * Phase 3 cron orchestrator. Consumed by /api/cron/advance-cycles/route.ts.
 *
 * D-10: hourly via cron-job.org (external). D-11: sequential per-household loop
 * with per-household try/catch so one bad household does not block others.
 *
 * D-05: paused cycles are re-evaluated on every tick by virtue of being
 * included in the household query filter. transitionCycle's internal
 * reason-upgrade path handles the "paused → paused_resumed" label
 * (see cycle.ts STEP 5).
 *
 * This module has no server-action directive — it is a plain domain module
 * callable from Route Handlers (app/api/cron/advance-cycles/route.ts) and,
 * in principle, from Server Actions or other orchestrators.
 */
import { db } from "@/lib/db";
import { transitionCycle } from "./cycle";

export interface CronSummary {
  ranAt: string;
  totalHouseholds: number;
  transitions: Array<{
    householdId: string;
    fromCycleNumber: number;
    toCycleNumber: number;
    reason: string;
    assignedUserId: string | null;
  }>;
  errors: Array<{ householdId: string; message: string }>;
}

/**
 * Iterates every household with either an active cycle past its endDate OR a
 * paused cycle, calling `transitionCycle(householdId, "cycle_end")` sequentially.
 *
 * - Sequential, NOT Promise.all: keeps the per-household $transaction +
 *   FOR UPDATE SKIP LOCKED contention model predictable (D-11).
 * - Per-household try/catch: a thrown error in one household is recorded in
 *   `errors[]` and the loop continues (T-3-ITER-BLOCKING mitigation).
 * - Skipped results (lock contention — another concurrent transition is in
 *   progress) are intentionally dropped: no transitions[] entry, no errors[]
 *   entry. Next cron tick picks it up.
 */
export async function advanceAllHouseholds(): Promise<CronSummary> {
  const now = new Date();
  const transitions: CronSummary["transitions"] = [];
  const errors: CronSummary["errors"] = [];

  const households = await db.household.findMany({
    where: {
      cycles: {
        some: {
          OR: [
            { status: "active", endDate: { lte: now } },
            { status: "paused" },
          ],
        },
      },
    },
    select: { id: true },
  });

  for (const h of households) {
    try {
      const result = await transitionCycle(h.id, "cycle_end");
      if ("transitioned" in result && result.transitioned) {
        transitions.push({
          householdId: h.id,
          fromCycleNumber: result.fromCycleNumber,
          toCycleNumber: result.toCycleNumber,
          reason: result.reason,
          assignedUserId: result.assignedUserId,
        });
      }
      // "skipped" result: another concurrent transition is in progress; no-op.
    } catch (err) {
      errors.push({
        householdId: h.id,
        message: err instanceof Error ? err.message : String(err),
      });
      console.error(`[cron] transition failed for household ${h.id}`, err);
    }
  }

  return {
    ranAt: now.toISOString(),
    totalHouseholds: households.length,
    transitions,
    errors,
  };
}

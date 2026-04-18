/**
 * Phase 3 availability predicates. Pure Prisma read wrappers; no auth, no transactions.
 * Called from actions.ts (createAvailability overlap check) and cycle.ts (findNextAssignee).
 */
import { db } from "@/lib/db";

/**
 * D-06 / Pitfall 11: returns the existing Availability row that overlaps
 * [startDate, endDate] for the given user+household, or null.
 * Closed-interval semantics per D-06 literal wording (lte / gte).
 */
export async function findOverlappingPeriod(
  userId: string,
  householdId: string,
  startDate: Date,
  endDate: Date,
): Promise<{ id: string; startDate: Date; endDate: Date } | null> {
  return db.availability.findFirst({
    where: {
      userId,
      householdId,
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
    select: { id: true, startDate: true, endDate: true },
  });
}

/**
 * Predicate used by findNextAssignee. True when the user has any availability
 * period covering the reference date `at`. Uses the module-level db client; the
 * caller inside a transaction should use `isMemberUnavailableOnTx` / run the
 * equivalent query on their `tx` handle to share the transaction snapshot.
 * (Phase 3's findNextAssignee does the latter — this helper is provided for
 * non-transactional callers, e.g., pre-insert guards in Server Actions.)
 */
export async function isMemberUnavailableOn(
  userId: string,
  householdId: string,
  at: Date,
): Promise<boolean> {
  const hit = await db.availability.findFirst({
    where: {
      userId,
      householdId,
      startDate: { lte: at },
      endDate: { gte: at },
    },
    select: { id: true },
  });
  return hit !== null;
}

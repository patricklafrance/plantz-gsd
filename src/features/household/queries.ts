import { db } from "@/lib/db";
import type { Cycle, Availability } from "@/generated/prisma/client";

/**
 * D-17: Resolve a URL slug to a household identifier.
 *
 * Used by Server Components to translate `/h/[householdSlug]` URL params
 * into a `householdId` that can be passed to `requireHouseholdAccess()`.
 *
 * Returns null when the slug is unknown — the caller decides whether to
 * 404 or redirect. This function does NOT call `auth()`; authentication
 * and authorization are the guard's job (D-16/D-18).
 */
export async function resolveHouseholdBySlug(slug: string) {
  return db.household.findUnique({
    where: { slug },
    select: { id: true, name: true },
  });
}

/**
 * HSLD-03 (D-08): List every household the user belongs to with role + isDefault.
 * Sorted by membership.createdAt asc so the auto-created solo household
 * (created during signup via src/features/auth/actions.ts:78-85) appears first.
 *
 * isDefault surfaces the HouseholdMember.isDefault column added in Plan 02-01.
 * Phase 6 HSET-02 adds the write path to toggle default; Phase 2 only reads it.
 *
 * Security note (T-02-02-04): caller MUST pass session.user.id — this query
 * has no authz check itself. Phase 6 consumer MUST read userId from auth().
 */
export async function getUserHouseholds(userId: string) {
  const memberships = await db.householdMember.findMany({
    where: { userId },
    include: { household: true },
    orderBy: { createdAt: "asc" },
  });

  return memberships.map((m) => ({
    household: m.household,
    role: m.role as "OWNER" | "MEMBER",
    isDefault: m.isDefault,
    joinedAt: m.createdAt,
  }));
}

/**
 * Phase 6 consumer: dashboard cycle banner reads this inside the layout chokepoint.
 * Returns the most recent active-or-paused Cycle for the household, or null.
 * Caller is responsible for authorization (layout ran requireHouseholdAccess).
 */
export async function getCurrentCycle(householdId: string): Promise<Cycle | null> {
  return db.cycle.findFirst({
    where: {
      householdId,
      status: { in: ["active", "paused"] },
    },
    orderBy: { cycleNumber: "desc" },
  });
}

/**
 * D-08: all household members can view all members' availability.
 * Joined with `user.name` + `user.email` for display in the settings list.
 */
export async function getHouseholdAvailabilities(
  householdId: string,
): Promise<Array<Availability & { user: { name: string | null; email: string } }>> {
  return db.availability.findMany({
    where: { householdId },
    include: {
      user: { select: { name: true, email: true } },
    },
    orderBy: { startDate: "asc" },
  });
}

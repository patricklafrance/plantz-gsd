/**
 * D-27 real-DB integration test for leaveHousehold when the caller is the active cycle assignee.
 * Verifies that transitionCycle fires and the outgoing cycle has transitionReason='member_left',
 * while a new active Cycle with a different assignee is created.
 *
 * REQUIRES: a real Postgres database (DATABASE_URL).
 */
import { expect, test, describe, vi, afterAll, beforeEach } from "vitest";

vi.mock("../../auth", () => ({ auth: vi.fn(), unstable_update: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { auth } = await import("../../auth");
const { db } = await import("@/lib/db");
const { leaveHousehold } = await import("@/features/household/actions");
const { EMAIL_PREFIX, createHouseholdWithMembers } = await import("./fixtures");

afterAll(async () => {
  try {
    const users = await db.user.findMany({
      where: { email: { startsWith: EMAIL_PREFIX } },
      select: { id: true },
    });
    const userIds = users.map((u: { id: string }) => u.id);
    if (userIds.length > 0) {
      const memberships = await db.householdMember.findMany({
        where: { userId: { in: userIds } },
        select: { householdId: true },
      });
      const householdIds = [
        ...new Set(memberships.map((m: { householdId: string }) => m.householdId)),
      ];
      await db.user.deleteMany({ where: { id: { in: userIds } } });
      if (householdIds.length > 0) {
        await db.household.deleteMany({ where: { id: { in: householdIds } } });
      }
    }
  } finally {
    await db.$disconnect();
  }
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("assignee-leaves triggers transitionCycle (real DB, D-27)", () => {
  test(
    "[INVT-05 / D-27] active assignee calls leaveHousehold: new active Cycle with different assignee exists AND outgoing cycle has transitionReason='member_left'",
    async () => {
      // Seed a 3-member household. Owner at index 0 is the active cycle assignee
      // (createHouseholdWithMembers assigns ownerId as assignedUserId on Cycle #1).
      const { householdId, ownerId, memberIds } = await createHouseholdWithMembers(3);

      // Promote memberIds[1] to OWNER so the assignee (ownerId at rotationOrder 0) can
      // leave without hitting the last-OWNER pre-check (D-13).
      await db.householdMember.update({
        where: { householdId_userId: { householdId, userId: memberIds[1] } },
        data: { role: "OWNER" },
      });

      // Mock session for the original owner (active assignee).
      vi.mocked(auth).mockResolvedValue({
        user: { id: ownerId, isDemo: false },
      } as unknown as Awaited<ReturnType<typeof auth>>);

      const household = await db.household.findUniqueOrThrow({
        where: { id: householdId },
        select: { slug: true },
      });

      const result = await leaveHousehold({
        householdId,
        householdSlug: household.slug,
      });
      expect(result).toEqual({ success: true });

      // Outgoing cycle: originally assignedUserId === ownerId; should now have transitionReason='member_left'
      const outgoing = await db.cycle.findFirst({
        where: { householdId, assignedUserId: ownerId },
        orderBy: { cycleNumber: "asc" },
      });
      expect(outgoing?.transitionReason).toBe("member_left");
      // Outgoing cycle should no longer be active
      expect(outgoing?.status).not.toBe("active");

      // New active cycle: exists and has a different assignee
      const newActive = await db.cycle.findFirst({
        where: { householdId, status: "active" },
        orderBy: { cycleNumber: "desc" },
      });
      expect(newActive).not.toBeNull();
      expect(newActive?.assignedUserId).not.toBe(ownerId);
    },
    30_000,
  );
});

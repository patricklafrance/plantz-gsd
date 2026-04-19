/**
 * D-14 real-DB cascade delete test for leaveHousehold sole-member terminal case.
 * Verifies that when the sole member (also the last OWNER) calls leaveHousehold,
 * the Household row is deleted and all related rows cascade-wipe via FK constraints.
 *
 * REQUIRES: a real Postgres database (DATABASE_URL).
 */
import { expect, test, describe, vi, afterAll, beforeEach } from "vitest";

vi.mock("../../auth", () => ({ auth: vi.fn(), unstable_update: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { auth, unstable_update } = await import("../../auth");
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

describe("leaveHousehold sole-member terminal case (real DB, D-14)", () => {
  test(
    "[INVT-05 / D-14] sole-member last-OWNER: Household.delete succeeds and cascade wipes plants, rooms, cycles, availabilities, invitations",
    async () => {
      const { householdId, ownerId } = await createHouseholdWithMembers(1); // sole member, OWNER

      // Seed minimal related rows so we can verify cascade deletion
      const room = await db.room.create({
        data: { name: "Living Room", householdId },
        select: { id: true },
      });
      await db.plant.create({
        data: {
          nickname: "Fern",
          householdId,
          roomId: room.id,
          wateringInterval: 7,
        },
      });
      await db.availability.create({
        data: {
          userId: ownerId,
          householdId,
          startDate: new Date(Date.now() + 86_400_000), // tomorrow
          endDate: new Date(Date.now() + 2 * 86_400_000),
        },
      });
      await db.invitation.create({
        data: { householdId, tokenHash: `unique-cascade-test-hash-${Date.now()}` },
      });
      // Cycle already exists from createHouseholdWithMembers (Cycle #1)

      // Mock session for the owner
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

      // Household row gone
      expect(
        await db.household.findUnique({ where: { id: householdId } }),
      ).toBeNull();

      // Cascade verified: no related rows referencing the deleted household
      expect(await db.plant.count({ where: { householdId } })).toBe(0);
      expect(await db.room.count({ where: { householdId } })).toBe(0);
      expect(await db.cycle.count({ where: { householdId } })).toBe(0);
      expect(await db.availability.count({ where: { householdId } })).toBe(0);
      expect(await db.invitation.count({ where: { householdId } })).toBe(0);
      expect(await db.householdMember.count({ where: { householdId } })).toBe(0);

      // JWT refresh called with undefined (no remaining memberships)
      // Note: actions.ts calls unstable_update({ user: { activeHouseholdId: undefined } })
      // when remaining?.householdId is undefined (no other household found).
      expect(vi.mocked(unstable_update)).toHaveBeenCalledWith({
        user: { activeHouseholdId: undefined },
      });
    },
    30_000,
  );
});

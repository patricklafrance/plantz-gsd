/**
 * D-26 real-DB + mocked-auth tests for unstable_update call shape.
 * Verifies that acceptInvitation and leaveHousehold call unstable_update
 * with the correct activeHouseholdId payload after DB writes persist.
 *
 * REQUIRES: a real Postgres database (DATABASE_URL).
 */
import { expect, test, describe, vi, afterAll, beforeEach } from "vitest";

vi.mock("../../auth", () => ({ auth: vi.fn(), unstable_update: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { auth, unstable_update } = await import("../../auth");
const { db } = await import("@/lib/db");
const { acceptInvitation, leaveHousehold } = await import(
  "@/features/household/actions"
);
const {
  EMAIL_PREFIX,
  createHouseholdWithInvitation,
  createHouseholdWithMembers,
  createBareUser,
} = await import("./fixtures");

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
        ...new Set(
          memberships.map((m: { householdId: string }) => m.householdId),
        ),
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

describe("JWT unstable_update on membership change (D-26)", () => {
  test(
    "[INVT-05 / D-26] acceptInvitation: unstable_update receives activeHouseholdId of newly joined household",
    async () => {
      const { householdId, rawToken } = await createHouseholdWithInvitation(1);
      const joiner = await createBareUser();

      vi.mocked(auth).mockResolvedValue({
        user: { id: joiner.id, isDemo: false },
      } as unknown as Awaited<ReturnType<typeof auth>>);

      const result = await acceptInvitation({ token: rawToken });
      expect("success" in result).toBe(true);

      // unstable_update must have been called with the joined household's id
      expect(vi.mocked(unstable_update)).toHaveBeenCalledWith({
        user: { activeHouseholdId: householdId },
      });
    },
    30_000,
  );

  test(
    "[INVT-05 / D-26] leaveHousehold (with remaining membership): unstable_update receives another householdId",
    async () => {
      // Seed two separate households, each with 1 member (different owners).
      const hh1 = await createHouseholdWithMembers(1);
      const hh2 = await createHouseholdWithMembers(1);

      // We need hh1.ownerId to also be a member of hh2.
      // Replace hh2's sole member with hh1's owner so the leaver has a remaining membership.
      await db.householdMember.update({
        where: {
          householdId_userId: {
            householdId: hh2.householdId,
            userId: hh2.ownerId,
          },
        },
        data: { userId: hh1.ownerId },
      });
      // Now hh1.ownerId is OWNER in hh1 and OWNER in hh2.
      // Leaving hh1 leaves one remaining membership in hh2.

      // Add a second OWNER to hh1 so leaving isn't blocked by last-OWNER check (D-13).
      const promotee = await createBareUser();
      await db.householdMember.create({
        data: {
          householdId: hh1.householdId,
          userId: promotee.id,
          role: "OWNER",
          rotationOrder: 99,
          isDefault: false,
        },
      });

      vi.mocked(auth).mockResolvedValue({
        user: { id: hh1.ownerId, isDemo: false },
      } as unknown as Awaited<ReturnType<typeof auth>>);

      const hhRow = await db.household.findUniqueOrThrow({
        where: { id: hh1.householdId },
        select: { slug: true },
      });
      const result = await leaveHousehold({
        householdId: hh1.householdId,
        householdSlug: hhRow.slug,
      });
      expect(result).toEqual({ success: true });

      // unstable_update must have been called with the remaining household (hh2)
      expect(vi.mocked(unstable_update)).toHaveBeenCalledWith({
        user: { activeHouseholdId: hh2.householdId },
      });
    },
    30_000,
  );
});

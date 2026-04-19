/**
 * D-23 real-DB concurrency test for acceptInvitation.
 * Tests that two concurrent calls with the same token produce exactly one success
 * and one "already used" error, with no duplicate HouseholdMember rows.
 *
 * REQUIRES: a real Postgres database (DATABASE_URL). pg-mem does not support
 * the row-level locking semantics that make this test meaningful.
 */
import { expect, test, describe, vi, afterAll, beforeEach } from "vitest";

// Mock NextAuth so acceptInvitation can call auth() + unstable_update without a real session.
vi.mock("../../auth", () => ({ auth: vi.fn(), unstable_update: vi.fn() }));
// Next cache must be stubbed — real-DB tests don't need revalidation.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { auth } = await import("../../auth");
const { db } = await import("@/lib/db");
const { acceptInvitation } = await import("@/features/household/actions");
const {
  EMAIL_PREFIX,
  createHouseholdWithInvitation,
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

function mockSessionFor(userId: string) {
  vi.mocked(auth).mockResolvedValue({
    user: { id: userId, isDemo: false },
  } as unknown as Awaited<ReturnType<typeof auth>>);
}

describe("acceptInvitation atomicity (real DB, D-23)", () => {
  test(
    "[INVT-04 / D-23] two concurrent acceptInvitation calls with same token: exactly one success, one 'already used'",
    async () => {
      const { householdId, rawToken } = await createHouseholdWithInvitation(2);
      const joiner = await createBareUser();

      // Mock session for the joiner — both concurrent calls share the same mocked session
      mockSessionFor(joiner.id);

      const [a, b] = await Promise.all([
        acceptInvitation({ token: rawToken }),
        acceptInvitation({ token: rawToken }),
      ]);

      const successes = [a, b].filter((r) => "success" in r);
      const errors = [a, b].filter((r) => "error" in r);

      expect(successes).toHaveLength(1);
      expect(errors).toHaveLength(1);
      expect((errors[0] as { error: string }).error).toBe(
        "This invite has already been used.",
      );

      // DB backstop: exactly one membership row for this (household, user) pair
      const memberships = await db.householdMember.findMany({
        where: { householdId, userId: joiner.id },
      });
      expect(memberships).toHaveLength(1);
    },
    30_000,
  );

  test(
    "[INVT-04 / D-23] stress: 3 distinct invitations + concurrent accept each: all succeed, no dup memberships",
    async () => {
      // Seed 3 separate households with invitations
      const [inv1, inv2, inv3] = await Promise.all([
        createHouseholdWithInvitation(1),
        createHouseholdWithInvitation(1),
        createHouseholdWithInvitation(1),
      ]);

      // Create 3 joiners
      const [joiner1, joiner2, joiner3] = await Promise.all([
        createBareUser(),
        createBareUser(),
        createBareUser(),
      ]);

      // For each invitation, run two concurrent accept calls with the same joiner.
      // Exactly one should succeed and one should get "already used".
      async function runConcurrentAccept(
        rawToken: string,
        joinerId: string,
        householdId: string,
      ) {
        mockSessionFor(joinerId);
        const [r1, r2] = await Promise.all([
          acceptInvitation({ token: rawToken }),
          acceptInvitation({ token: rawToken }),
        ]);

        const successes = [r1, r2].filter((r) => "success" in r);
        const errors = [r1, r2].filter((r) => "error" in r);

        expect(successes).toHaveLength(1);
        expect(errors).toHaveLength(1);

        // Exactly one membership per joiner-household pair
        const memberships = await db.householdMember.findMany({
          where: { householdId, userId: joinerId },
        });
        expect(memberships).toHaveLength(1);
      }

      // Run sequentially to avoid auth mock cross-contamination between invitations
      await runConcurrentAccept(inv1.rawToken, joiner1.id, inv1.householdId);
      await runConcurrentAccept(inv2.rawToken, joiner2.id, inv2.householdId);
      await runConcurrentAccept(inv3.rawToken, joiner3.id, inv3.householdId);
    },
    60_000,
  );
});

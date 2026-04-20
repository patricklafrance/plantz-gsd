/**
 * D-35 real-DB concurrency test for reorderRotation.
 *
 * Proves that when a client submits reorderRotation with a stale
 * orderedMemberUserIds list (e.g., the list includes a member who was just
 * removed by another OWNER in a concurrent transaction), the $transaction's
 * set-mismatch guard throws MEMBERS_CHANGED, the tx rolls back, and the
 * remaining members' rotationOrder is untouched. The removed member is gone,
 * no torn state remains.
 *
 * REQUIRES: a real Postgres database (DATABASE_URL). pg-mem does not support
 * the snapshot semantics that make this test meaningful. If DATABASE_URL is
 * not set, the describe block is skipped — matches the pattern used by the
 * other real-DB tests in tests/phase-04/*.test.ts.
 */
import { expect, test, describe, vi, afterAll, beforeEach } from "vitest";

// Mock NextAuth so reorderRotation + removeMember can call auth() without a
// real session. Both actions also call requireHouseholdAccess internally,
// which reads auth() again, so mockResolvedValue (not mockResolvedValueOnce)
// is required (STATE.md Phase 03-04 precedent).
vi.mock("../../auth", () => ({ auth: vi.fn() }));
// revalidatePath is a no-op in this test environment.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const hasDb = Boolean(process.env.DATABASE_URL);
const describeReal = hasDb ? describe : describe.skip;

const { auth } = await import("../../auth");
// Lazy-import db inside the test body so the module doesn't throw at import
// time when DATABASE_URL is unset (fixtures.ts uses the same lazy pattern).
async function getDb() {
  const mod = await import("@/lib/db");
  return mod.db;
}
const { reorderRotation, removeMember } = await import(
  "@/features/household/actions"
);
const { EMAIL_PREFIX, RUN_ID } = await import("./fixtures");

afterAll(async () => {
  if (!hasDb) return;
  const db = await getDb();
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
        await db.household.deleteMany({
          where: { id: { in: householdIds } },
        });
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

/**
 * Seeds a household with an OWNER plus two additional MEMBER rows in a
 * known rotation order. Returns IDs for the concurrency scenario.
 */
async function seedHouseholdWithThreeMembers(): Promise<{
  householdId: string;
  householdSlug: string;
  ownerId: string;
  memberA: string;
  memberB: string;
  memberC: string;
}> {
  const db = await getDb();
  // Three users: owner + A + B. memberC is a fourth seeded user we will
  // remove mid-test to simulate the concurrent delete.
  const tag = `${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
  const [owner, userA, userB, userC] = await Promise.all([
    db.user.create({
      data: {
        email: `${EMAIL_PREFIX}-${tag}-owner@test.local`,
        name: "P6 Owner",
        passwordHash: "bcrypt$fixture-only-never-verified",
      },
      select: { id: true },
    }),
    db.user.create({
      data: {
        email: `${EMAIL_PREFIX}-${tag}-a@test.local`,
        name: "P6 A",
        passwordHash: "bcrypt$fixture-only-never-verified",
      },
      select: { id: true },
    }),
    db.user.create({
      data: {
        email: `${EMAIL_PREFIX}-${tag}-b@test.local`,
        name: "P6 B",
        passwordHash: "bcrypt$fixture-only-never-verified",
      },
      select: { id: true },
    }),
    db.user.create({
      data: {
        email: `${EMAIL_PREFIX}-${tag}-c@test.local`,
        name: "P6 C",
        passwordHash: "bcrypt$fixture-only-never-verified",
      },
      select: { id: true },
    }),
  ]);

  const slug = `p6-reorder-${RUN_ID.toLowerCase().slice(-8)}-${tag}`;
  const household = await db.household.create({
    data: {
      name: `P6 Reorder Test ${tag}`,
      slug,
      timezone: "America/New_York",
      cycleDuration: 7,
    },
    select: { id: true, slug: true },
  });

  await db.householdMember.createMany({
    data: [
      {
        userId: owner.id,
        householdId: household.id,
        role: "OWNER",
        rotationOrder: 0,
        isDefault: true,
      },
      {
        userId: userA.id,
        householdId: household.id,
        role: "MEMBER",
        rotationOrder: 1,
        isDefault: false,
      },
      {
        userId: userB.id,
        householdId: household.id,
        role: "MEMBER",
        rotationOrder: 2,
        isDefault: false,
      },
      {
        userId: userC.id,
        householdId: household.id,
        role: "MEMBER",
        rotationOrder: 3,
        isDefault: false,
      },
    ],
  });

  // Minimal Cycle #1 so requireHouseholdAccess finds consistent state.
  const anchor = new Date(Date.now() - 86400 * 1000);
  await db.cycle.create({
    data: {
      householdId: household.id,
      cycleNumber: 1,
      anchorDate: anchor,
      cycleDuration: 7,
      startDate: anchor,
      endDate: new Date(anchor.getTime() + 7 * 86400 * 1000),
      status: "active",
      assignedUserId: owner.id,
      memberOrderSnapshot: [
        { userId: owner.id, rotationOrder: 0 },
        { userId: userA.id, rotationOrder: 1 },
        { userId: userB.id, rotationOrder: 2 },
        { userId: userC.id, rotationOrder: 3 },
      ],
    },
  });

  return {
    householdId: household.id,
    householdSlug: household.slug,
    ownerId: owner.id,
    memberA: userA.id,
    memberB: userB.id,
    memberC: userC.id,
  };
}

describeReal("reorderRotation + removeMember concurrency (D-35)", () => {
  test(
    "D-35 stale orderedMemberUserIds (includes a just-removed member) fails with MEMBERS_CHANGED; removed member is gone; rotation untouched",
    async () => {
      const {
        householdId,
        householdSlug,
        ownerId,
        memberA,
        memberB,
        memberC,
      } = await seedHouseholdWithThreeMembers();

      // Owner performs both the removeMember and the stale reorderRotation —
      // they run "concurrently" in the sense that the client captured the
      // member list BEFORE the remove landed, and now submits the reorder
      // with memberC still in it.
      mockSessionFor(ownerId);

      // Stale client-side ordering — includes memberC who is about to be
      // removed. We serialize the calls so the server state mutates in
      // between: removeMember first, then reorderRotation. This proves the
      // set-mismatch guard catches the stale snapshot even after the other
      // transaction has committed.
      const removeResult = await removeMember({
        householdId,
        householdSlug,
        targetUserId: memberC,
      });
      expect("success" in removeResult).toBe(true);

      // memberC is gone in the DB.
      const db = await getDb();
      const membershipsAfterRemove = await db.householdMember.findMany({
        where: { householdId },
        select: { userId: true, rotationOrder: true },
        orderBy: { rotationOrder: "asc" },
      });
      expect(membershipsAfterRemove.map((m) => m.userId)).not.toContain(
        memberC,
      );
      expect(membershipsAfterRemove).toHaveLength(3);

      // Capture the pre-reorder rotation state — we assert it's unchanged
      // after the failed reorder.
      const preReorder = membershipsAfterRemove.map((m) => ({
        userId: m.userId,
        rotationOrder: m.rotationOrder,
      }));

      // Stale reorder: client sends all 4 user IDs (including the removed
      // memberC). The $transaction's set-equality guard throws MEMBERS_CHANGED.
      const reorderResult = await reorderRotation({
        householdId,
        householdSlug,
        orderedMemberUserIds: [ownerId, memberB, memberA, memberC],
      });
      expect("error" in reorderResult).toBe(true);
      expect((reorderResult as { error: string }).error).toMatch(
        /Member list changed/i,
      );

      // Rotation state MUST be unchanged — the $transaction rolled back
      // before any per-row update landed.
      const postReorder = await db.householdMember.findMany({
        where: { householdId },
        select: { userId: true, rotationOrder: true },
        orderBy: { rotationOrder: "asc" },
      });
      expect(postReorder).toEqual(preReorder);
    },
    60_000,
  );

  test(
    "D-35 reorder with a non-member userId in the array (tampered client payload) also fails with MEMBERS_CHANGED",
    async () => {
      const { householdId, householdSlug, ownerId, memberA, memberB } =
        await seedHouseholdWithThreeMembers();

      mockSessionFor(ownerId);
      const db = await getDb();

      // A real cuid-shaped id that has never been a member of this household.
      // Use another newly-created user (lives in User table, not in
      // HouseholdMember rows for this household).
      const stranger = await db.user.create({
        data: {
          email: `${EMAIL_PREFIX}-${Date.now()}-stranger@test.local`,
          name: "P6 Stranger",
          passwordHash: "bcrypt$fixture-only-never-verified",
        },
        select: { id: true },
      });

      // Capture current order
      const preReorder = await db.householdMember.findMany({
        where: { householdId },
        select: { userId: true, rotationOrder: true },
        orderBy: { rotationOrder: "asc" },
      });

      // Tampered reorder: correct length (4) but swaps a real member for the
      // stranger's id. Set-inequality trips MEMBERS_CHANGED.
      const reorderResult = await reorderRotation({
        householdId,
        householdSlug,
        // Seeded 4 members (owner + A + B + C). Substitute stranger for C.
        orderedMemberUserIds: [ownerId, memberA, memberB, stranger.id],
      });

      expect("error" in reorderResult).toBe(true);
      expect((reorderResult as { error: string }).error).toMatch(
        /Member list changed/i,
      );

      // Rotation unchanged.
      const postReorder = await db.householdMember.findMany({
        where: { householdId },
        select: { userId: true, rotationOrder: true },
        orderBy: { rotationOrder: "asc" },
      });
      expect(postReorder).toEqual(preReorder);
    },
    60_000,
  );
});

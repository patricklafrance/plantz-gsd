/**
 * ROTA-06 race-safe transition — integration test against real Postgres.
 * pg-mem does NOT support FOR UPDATE SKIP LOCKED; this test REQUIRES real Postgres.
 */
import { expect, test, describe, vi, afterAll, beforeEach } from "vitest";

vi.mock("../../auth", () => ({ auth: vi.fn() }));

const { db } = await import("@/lib/db");
const { transitionCycle } = await import("@/features/household/cycle");
const { EMAIL_PREFIX, createHouseholdWithMembers } = await import("./fixtures");

type TransitionReturn = Awaited<ReturnType<typeof transitionCycle>>;

beforeEach(() => {
  vi.clearAllMocks();
});

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

describe("transitionCycle concurrency — FOR UPDATE SKIP LOCKED (ROTA-06)", () => {
  test("two parallel transitionCycle calls: exactly 1 transitioned + 1 skipped; exactly one Cycle #2 and one notification", async () => {
    const { householdId } = await createHouseholdWithMembers(2);

    const [r1, r2] = await Promise.all([
      transitionCycle(householdId, "cycle_end"),
      transitionCycle(householdId, "cycle_end"),
    ]);

    const isTransitioned = (
      r: TransitionReturn,
    ): r is Extract<TransitionReturn, { transitioned: true }> =>
      "transitioned" in r && r.transitioned === true;
    const isSkipped = (
      r: TransitionReturn,
    ): r is Extract<TransitionReturn, { skipped: true }> =>
      "skipped" in r && r.skipped === true;

    const transitioned = [r1, r2].filter(isTransitioned);
    const skipped = [r1, r2].filter(isSkipped);
    expect(transitioned).toHaveLength(1);
    expect(skipped).toHaveLength(1);

    // DB backstop: exactly one Cycle row with cycleNumber=2
    const cycle2Rows = await db.cycle.findMany({
      where: { householdId, cycleNumber: 2 },
    });
    expect(cycle2Rows).toHaveLength(1);

    // Exactly one notification emitted for Cycle #2
    const notes = await db.householdNotification.findMany({
      where: { householdId, cycleId: cycle2Rows[0].id },
    });
    expect(notes).toHaveLength(1);
  });
});

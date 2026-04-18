/**
 * ROTA-02 end-to-end transition happy path — integration test against real Postgres.
 */
import { expect, test, describe, vi, afterAll, beforeEach } from "vitest";

vi.mock("../../auth", () => ({ auth: vi.fn() }));

const { db } = await import("@/lib/db");
const { transitionCycle } = await import("@/features/household/cycle");
const { EMAIL_PREFIX, createHouseholdWithMembers } = await import("./fixtures");

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

describe("transitionCycle — cycle_end happy path (ROTA-02, D-15, D-18)", () => {
  test("transitions Cycle #1 → #2 with correct return shape, DB state, and single notification", async () => {
    // Use single-member household so rotation lands back on the owner
    // (sequential next of a 1-member rotation is still the owner — finalReason stays 'cycle_end').
    const { householdId, ownerId, cycleId: outgoingId } =
      await createHouseholdWithMembers(1);

    const result = await transitionCycle(householdId, "cycle_end");

    // 1. Return shape
    expect(result).toMatchObject({
      transitioned: true,
      fromCycleNumber: 1,
      toCycleNumber: 2,
      reason: "cycle_end",
      assignedUserId: ownerId,
      status: "active",
    });

    // 2. New Cycle #2 present
    const cycle2 = await db.cycle.findFirst({
      where: { householdId, cycleNumber: 2 },
    });
    expect(cycle2).not.toBeNull();
    expect(cycle2!.status).toBe("active");
    expect(cycle2!.assignedUserId).toBe(ownerId);

    // 3. Outgoing Cycle #1 closed
    const cycle1 = await db.cycle.findUnique({ where: { id: outgoingId } });
    expect(cycle1!.status).toBe("completed");
    expect(cycle1!.transitionReason).toBe("cycle_end");

    // 4. One notification emitted
    const notes = await db.householdNotification.findMany({
      where: { householdId, cycleId: cycle2!.id },
    });
    expect(notes).toHaveLength(1);
    expect(notes[0].type).toBe("cycle_started");
    expect(notes[0].recipientUserId).toBe(ownerId);

    // 5. DB end-state for this household: exactly one completed + one active cycle, no strays
    const completed = await db.cycle.findMany({
      where: { householdId, status: "completed" },
    });
    const active = await db.cycle.findMany({
      where: { householdId, status: "active" },
    });
    expect(completed).toHaveLength(1);
    expect(active).toHaveLength(1);
  });
});

/**
 * D-05 paused cycle resume on cron tick. Phase 03 plan 05 (Wave 4).
 *
 * Integration test against real Postgres. Sets up a household whose Cycle #1 is
 * `status: "paused"` (simulating a prior "all unavailable" outcome), inserts
 * zero Availability rows so every member is now available, then runs the cron
 * orchestrator and asserts the paused cycle transitions into a new active
 * successor with `transitionReason: "paused_resumed"` and a `cycle_started`
 * notification (per D-18 reuse).
 *
 * The outgoing cycle closes with `status: "completed"` because `paused_resumed`
 * is NOT in the {manual_skip, auto_skip_unavailable, member_left} closed-as-
 * "skipped" set (see src/features/household/cycle.ts STEP 7).
 */
import { expect, test, describe, vi, afterAll, beforeEach } from "vitest";

vi.mock("../../auth", () => ({ auth: vi.fn() }));

const { db } = await import("@/lib/db");
const { advanceAllHouseholds } = await import("@/features/household/cron");
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

describe("cron paused → active resume (D-05)", () => {
  test("paused Cycle with newly-available member: cron transition writes active successor cycle, outgoing transitionReason === 'paused_resumed', notification type === 'cycle_started'", async () => {
    // 3-member household, Cycle #1 active + owner assigned (from fixture default).
    const { householdId, memberIds } = await createHouseholdWithMembers(3);

    // Flip Cycle #1 to paused with no assignee — simulates a prior all-unavailable
    // outcome where findNextAssignee returned null and the engine wrote a paused cycle.
    // assignedUserId=null mirrors the engine's paused-cycle write (cycle.ts STEP 6).
    await db.cycle.updateMany({
      where: { householdId, cycleNumber: 1 },
      data: {
        status: "paused",
        assignedUserId: null,
      },
    });

    // No Availability rows → every member is available on next tick. The rotation
    // walker (findNextAssignee) starts at currentIdx=-1 (outgoing.assignedUserId is
    // null) and walks index 0 first, so memberIds[0] should be the resumed assignee.
    const result = await advanceAllHouseholds();

    // D-12 shape sanity
    expect(result).toMatchObject({
      ranAt: expect.any(String),
      totalHouseholds: expect.any(Number),
      transitions: expect.any(Array),
      errors: expect.any(Array),
    });
    expect(result.totalHouseholds).toBeGreaterThanOrEqual(1);
    expect(result.errors).toEqual([]);

    // The transition for our household is present with reason=paused_resumed
    const ourTransition = result.transitions.find(
      (t) => t.householdId === householdId,
    );
    expect(ourTransition).toBeDefined();
    expect(ourTransition!.reason).toBe("paused_resumed");
    expect(ourTransition!.fromCycleNumber).toBe(1);
    expect(ourTransition!.toCycleNumber).toBe(2);
    expect(ourTransition!.assignedUserId).not.toBeNull();
    expect(memberIds).toContain(ourTransition!.assignedUserId);

    // DB state: exactly 2 cycles. Outgoing #1 closed as completed with paused_resumed.
    // New #2 is active with a real assignee.
    const cycles = await db.cycle.findMany({
      where: { householdId },
      orderBy: { cycleNumber: "asc" },
    });
    expect(cycles).toHaveLength(2);
    expect(cycles[0].cycleNumber).toBe(1);
    expect(cycles[0].status).toBe("completed");
    expect(cycles[0].transitionReason).toBe("paused_resumed");
    expect(cycles[1].cycleNumber).toBe(2);
    expect(cycles[1].status).toBe("active");
    expect(cycles[1].assignedUserId).toBe(ourTransition!.assignedUserId);

    // Exactly one cycle_started notification for the new assignee, pointing at Cycle #2.
    const notifications = await db.householdNotification.findMany({
      where: { householdId, cycleId: cycles[1].id },
    });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].type).toBe("cycle_started");
    expect(notifications[0].recipientUserId).toBe(ourTransition!.assignedUserId);
  }, 30_000);
});

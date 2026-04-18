/**
 * AVLB-03 auto-skip path — real-DB integration test.
 *
 * Scenario: 3-member household, Cycle #1 assigned to owner (rotationOrder 0).
 * Member1 (rotationOrder 1) is unavailable at cycle-end; the walker must step
 * past them and land on Member2 (rotationOrder 2). Outgoing cycle closes with
 * transitionReason='auto_skip_unavailable'; incoming notification type is
 * 'cycle_reassigned_auto_skip'.
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

describe("transitionCycle auto_skip_unavailable path (AVLB-03, D-04)", () => {
  test("next scheduled member has Availability covering cycle end → walker lands on the walked-to member; outgoing transitionReason='auto_skip_unavailable'; notification type='cycle_reassigned_auto_skip'", async () => {
    // createHouseholdWithMembers(3) → owner@rot0, m1@rot1, m2@rot2,
    // Cycle #1 assignedUserId=owner, endDate ≈ 1 day ago (already due).
    const { householdId, ownerId, memberIds, cycleId: outgoingId } =
      await createHouseholdWithMembers(3);

    // memberIds[0] = owner, memberIds[1] = m1 (next in rotation), memberIds[2] = m2
    const member1Id = memberIds[1];
    const member2Id = memberIds[2];

    // Cover Cycle #1 endDate with an Availability row for m1 (the "next" assignee).
    const outgoing = await db.cycle.findUnique({ where: { id: outgoingId } });
    const coverStart = new Date(outgoing!.endDate.getTime() - 86400_000);
    const coverEnd = new Date(outgoing!.endDate.getTime() + 86400_000);
    await db.availability.create({
      data: {
        userId: member1Id,
        householdId,
        startDate: coverStart,
        endDate: coverEnd,
      },
    });

    const result = await transitionCycle(householdId, "cycle_end");

    // Returned TransitionResult: walker skipped m1 and landed on m2.
    expect(result).toMatchObject({
      transitioned: true,
      fromCycleNumber: 1,
      toCycleNumber: 2,
      reason: "auto_skip_unavailable",
      assignedUserId: member2Id,
      status: "active",
    });

    // Outgoing Cycle #1: status='skipped' (auto_skip_unavailable branch),
    // transitionReason='auto_skip_unavailable' column on the row.
    const cycle1 = await db.cycle.findUnique({ where: { id: outgoingId } });
    expect(cycle1!.status).toBe("skipped");
    expect(cycle1!.transitionReason).toBe("auto_skip_unavailable");

    // New Cycle #2 exists with assignedUserId=m2.
    const cycle2 = await db.cycle.findFirst({
      where: { householdId, cycleNumber: 2 },
    });
    expect(cycle2).not.toBeNull();
    expect(cycle2!.assignedUserId).toBe(member2Id);
    expect(cycle2!.status).toBe("active");

    // Exactly one HouseholdNotification for cycle #2, type=cycle_reassigned_auto_skip,
    // recipient=m2 (the new assignee — NOT the owner, NOT m1).
    const notes = await db.householdNotification.findMany({
      where: { householdId, cycleId: cycle2!.id },
    });
    expect(notes).toHaveLength(1);
    expect(notes[0].type).toBe("cycle_reassigned_auto_skip");
    expect(notes[0].recipientUserId).toBe(member2Id);
    // And just to be explicit: the owner was the outgoing assignee, not
    // involved in the notification.
    expect(notes[0].recipientUserId).not.toBe(ownerId);
  });
});

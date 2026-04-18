/**
 * AVLB-05 all-unavailable fallback — two scenarios against real Postgres.
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

describe("transitionCycle all-unavailable fallback (AVLB-05)", () => {
  test("owner available → new active cycle with owner as assignee, transitionReason=all_unavailable_fallback, notification type=cycle_fallback_owner", async () => {
    const { householdId, ownerId, memberIds, cycleId: outgoingId } =
      await createHouseholdWithMembers(3);

    // Outgoing cycle endDate is ~1 day from now per fixture; availability rows must cover it
    const outgoing = await db.cycle.findUnique({ where: { id: outgoingId } });
    const coverStart = new Date(outgoing!.endDate.getTime() - 86400_000);
    const coverEnd = new Date(outgoing!.endDate.getTime() + 86400_000);

    // Non-owner members (m1, m2) unavailable; owner (m0) available
    await db.availability.createMany({
      data: [memberIds[1], memberIds[2]].map((userId) => ({
        userId,
        householdId,
        startDate: coverStart,
        endDate: coverEnd,
      })),
    });

    const result = await transitionCycle(householdId, "cycle_end");

    expect(result).toMatchObject({
      transitioned: true,
      reason: "all_unavailable_fallback",
      assignedUserId: ownerId,
      status: "active",
    });

    // Outgoing cycle closed with all_unavailable_fallback
    const cycle1 = await db.cycle.findUnique({ where: { id: outgoingId } });
    expect(cycle1!.status).toBe("completed");
    expect(cycle1!.transitionReason).toBe("all_unavailable_fallback");

    // Successor cycle is active + owner
    const cycle2 = await db.cycle.findFirst({
      where: { householdId, cycleNumber: 2 },
    });
    expect(cycle2!.status).toBe("active");
    expect(cycle2!.assignedUserId).toBe(ownerId);

    // Notification type = cycle_fallback_owner
    const notes = await db.householdNotification.findMany({
      where: { householdId, cycleId: cycle2!.id },
    });
    expect(notes).toHaveLength(1);
    expect(notes[0].type).toBe("cycle_fallback_owner");
    expect(notes[0].recipientUserId).toBe(ownerId);
  });

  test("owner ALSO unavailable → new paused cycle, zero notifications, outgoing still labeled all_unavailable_fallback", async () => {
    const { householdId, memberIds, cycleId: outgoingId } =
      await createHouseholdWithMembers(3);

    const outgoing = await db.cycle.findUnique({ where: { id: outgoingId } });
    const coverStart = new Date(outgoing!.endDate.getTime() - 86400_000);
    const coverEnd = new Date(outgoing!.endDate.getTime() + 86400_000);

    // ALL members (including owner) unavailable
    await db.availability.createMany({
      data: memberIds.map((userId: string) => ({
        userId,
        householdId,
        startDate: coverStart,
        endDate: coverEnd,
      })),
    });

    const result = await transitionCycle(householdId, "cycle_end");

    expect(result).toMatchObject({
      transitioned: true,
      reason: "all_unavailable_fallback",
      assignedUserId: null,
      status: "paused",
    });

    // Outgoing cycle closed with all_unavailable_fallback (NOT 'cycle_end')
    const cycle1 = await db.cycle.findUnique({ where: { id: outgoingId } });
    expect(cycle1!.status).toBe("completed");
    expect(cycle1!.transitionReason).toBe("all_unavailable_fallback");

    // Successor cycle is paused, no assignee
    const cycle2 = await db.cycle.findFirst({
      where: { householdId, cycleNumber: 2 },
    });
    expect(cycle2!.status).toBe("paused");
    expect(cycle2!.assignedUserId).toBeNull();

    // Zero notifications emitted (no recipient)
    const notes = await db.householdNotification.findMany({
      where: { householdId, cycleId: cycle2!.id },
    });
    expect(notes).toHaveLength(0);
  });
});

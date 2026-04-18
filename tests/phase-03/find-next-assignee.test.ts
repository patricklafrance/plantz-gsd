/**
 * AVLB-03 / AVLB-05 rotation walker — integration tests against real Postgres.
 *
 * Session mock note: findNextAssignee does not consult auth(); the mock is in
 * place only because the shared db module is loaded by other production code
 * that imports through @/auth transitively in dev. Keeping the mock here keeps
 * the test-file pattern consistent with the rest of phase-03/.
 */
import { expect, test, describe, vi, afterAll, beforeEach } from "vitest";

vi.mock("../../auth", () => ({ auth: vi.fn() }));

const { db } = await import("@/lib/db");
const { findNextAssignee } = await import("@/features/household/cycle");
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

describe("findNextAssignee (AVLB-03, AVLB-05)", () => {
  test("all members available → returns rotationOrder+1 with fallback=false", async () => {
    const { householdId, memberIds } = await createHouseholdWithMembers(3);
    const ownerId = memberIds[0];
    const outgoing = { assignedUserId: ownerId, endDate: new Date() };

    const members = await db.householdMember.findMany({
      where: { householdId },
      select: { userId: true, rotationOrder: true, role: true },
    });

    const result = await db.$transaction((tx) =>
      findNextAssignee(tx, householdId, members, outgoing),
    );

    expect(result).not.toBeNull();
    expect(result!.fallback).toBe(false);
    expect(result!.userId).toBe(memberIds[1]); // rotationOrder 1
  });

  test("next scheduled member unavailable → walks past to next available member", async () => {
    const { householdId, memberIds } = await createHouseholdWithMembers(3);
    const ownerId = memberIds[0];
    const endDate = new Date();

    // Member at rotationOrder=1 is unavailable covering endDate
    await db.availability.create({
      data: {
        userId: memberIds[1],
        householdId,
        startDate: new Date(endDate.getTime() - 86400_000),
        endDate: new Date(endDate.getTime() + 86400_000),
      },
    });

    const members = await db.householdMember.findMany({
      where: { householdId },
      select: { userId: true, rotationOrder: true, role: true },
    });

    const result = await db.$transaction((tx) =>
      findNextAssignee(tx, householdId, members, {
        assignedUserId: ownerId,
        endDate,
      }),
    );

    expect(result).not.toBeNull();
    expect(result!.fallback).toBe(false);
    expect(result!.userId).toBe(memberIds[2]); // skipped m1, landed on m2
  });

  test("all non-owner members unavailable + owner available → returns owner with fallback=true", async () => {
    const { householdId, memberIds } = await createHouseholdWithMembers(3);
    const ownerId = memberIds[0];
    const endDate = new Date();

    await db.availability.createMany({
      data: [memberIds[1], memberIds[2]].map((userId) => ({
        userId,
        householdId,
        startDate: new Date(endDate.getTime() - 86400_000),
        endDate: new Date(endDate.getTime() + 86400_000),
      })),
    });

    const members = await db.householdMember.findMany({
      where: { householdId },
      select: { userId: true, rotationOrder: true, role: true },
    });

    const result = await db.$transaction((tx) =>
      findNextAssignee(tx, householdId, members, {
        assignedUserId: ownerId,
        endDate,
      }),
    );

    expect(result).not.toBeNull();
    expect(result!.fallback).toBe(true);
    expect(result!.userId).toBe(ownerId);
  });

  test("all members including owner unavailable → returns null (paused signal)", async () => {
    const { householdId, memberIds } = await createHouseholdWithMembers(3);
    const ownerId = memberIds[0];
    const endDate = new Date();

    await db.availability.createMany({
      data: memberIds.map((userId: string) => ({
        userId,
        householdId,
        startDate: new Date(endDate.getTime() - 86400_000),
        endDate: new Date(endDate.getTime() + 86400_000),
      })),
    });

    const members = await db.householdMember.findMany({
      where: { householdId },
      select: { userId: true, rotationOrder: true, role: true },
    });

    const result = await db.$transaction((tx) =>
      findNextAssignee(tx, householdId, members, {
        assignedUserId: ownerId,
        endDate,
      }),
    );

    expect(result).toBeNull();
  });
});

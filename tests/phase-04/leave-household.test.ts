import { expect, test, describe, vi, beforeEach } from "vitest";

vi.mock("@/generated/prisma/client", () => ({ PrismaClient: vi.fn() }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: vi.fn() }));

const mockHouseholdMember = {
  count: vi.fn(),
  delete: vi.fn(),
  findFirst: vi.fn(),
};
const mockAvailability = { deleteMany: vi.fn() };
const mockHousehold = { delete: vi.fn() };
const mockCycle = { findFirst: vi.fn() };

vi.mock("@/lib/db", () => ({
  db: {
    householdMember: mockHouseholdMember,
    availability: mockAvailability,
    household: mockHousehold,
    cycle: mockCycle,
    $transaction: vi.fn(async (callback) =>
      callback({
        householdMember: mockHouseholdMember,
        availability: mockAvailability,
      }),
    ),
  },
}));
vi.mock("../../auth", () => ({ auth: vi.fn(), unstable_update: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/features/household/guards", () => {
  class ForbiddenError extends Error {
    readonly name = "ForbiddenError" as const;
    readonly statusCode = 403 as const;
    constructor(message = "Access denied") {
      super(message);
      Object.setPrototypeOf(this, ForbiddenError.prototype);
    }
  }
  return { ForbiddenError, requireHouseholdAccess: vi.fn() };
});

vi.mock("@/features/household/cycle", async () => {
  const actual = await vi.importActual<typeof import("@/features/household/cycle")>(
    "@/features/household/cycle",
  );
  return { ...actual, transitionCycle: vi.fn() };
});

const { auth, unstable_update } = await import("../../auth");
const { requireHouseholdAccess } = await import("@/features/household/guards");
const { transitionCycle } = await import("@/features/household/cycle");
const { leaveHousehold } = await import("@/features/household/actions");

beforeEach(() => {
  vi.clearAllMocks();
});

const USER_ID = "clw_usr_leaver_000000000";
const HOUSEHOLD_ID = "clw_household_0000000000";
const HOUSEHOLD_SLUG = "my-home";

function mockSession(isDemo = false) {
  vi.mocked(auth).mockResolvedValue({
    user: { id: USER_ID, isDemo },
  } as unknown as Awaited<ReturnType<typeof auth>>);
}

function mockAccess(role: "OWNER" | "MEMBER") {
  vi.mocked(requireHouseholdAccess).mockResolvedValue({
    household: { id: HOUSEHOLD_ID } as never,
    member: {} as never,
    role,
  });
}

describe("leaveHousehold", () => {
  test("[INVT-05 / D-13] last OWNER in multi-member household: blocked", async () => {
    mockSession();
    mockAccess("OWNER");
    // count(other OWNERs) = 0, count(total members) = 3
    mockHouseholdMember.count
      .mockResolvedValueOnce(0)  // otherOwnerCount
      .mockResolvedValueOnce(3); // totalMemberCount

    const result = await leaveHousehold({ householdId: HOUSEHOLD_ID, householdSlug: HOUSEHOLD_SLUG });

    expect(result).toEqual({
      error: "You're the only owner. Promote another member to owner first, then try again.",
    });
    expect(mockHousehold.delete).not.toHaveBeenCalled();
    expect(mockHouseholdMember.delete).not.toHaveBeenCalled();
  });

  test("[INVT-05] two OWNERs, two members: OWNER leaves, allowed", async () => {
    mockSession();
    mockAccess("OWNER");
    // count(other OWNERs) = 1, count(total members) = 2
    mockHouseholdMember.count
      .mockResolvedValueOnce(1)  // otherOwnerCount
      .mockResolvedValueOnce(2); // totalMemberCount
    // cycle: caller is NOT the assignee
    mockCycle.findFirst.mockResolvedValueOnce({ assignedUserId: "clw_other_user_000000" });
    // remaining membership after leave
    mockHouseholdMember.findFirst.mockResolvedValueOnce({ householdId: "clw_other_hh_000000" });
    mockHouseholdMember.delete.mockResolvedValueOnce({});
    mockAvailability.deleteMany.mockResolvedValueOnce({ count: 0 });

    const result = await leaveHousehold({ householdId: HOUSEHOLD_ID, householdSlug: HOUSEHOLD_SLUG });

    expect(result).toEqual({ success: true });
    expect(mockHouseholdMember.delete).toHaveBeenCalledWith({
      where: { householdId_userId: { householdId: HOUSEHOLD_ID, userId: USER_ID } },
    });
    expect(mockAvailability.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: USER_ID, householdId: HOUSEHOLD_ID }),
      }),
    );
    expect(vi.mocked(unstable_update)).toHaveBeenCalledWith({
      user: { activeHouseholdId: "clw_other_hh_000000" },
    });
  });

  test("[INVT-05] MEMBER in multi-member household: allowed", async () => {
    mockSession();
    mockAccess("MEMBER");
    // callerIsOwner = false — pre-check short-circuits (no count calls needed for block logic)
    // Still counts to determine isSoleMember
    mockHouseholdMember.count
      .mockResolvedValueOnce(1)  // otherOwnerCount (not used for block, but still queried)
      .mockResolvedValueOnce(2); // totalMemberCount
    mockCycle.findFirst.mockResolvedValueOnce({ assignedUserId: "clw_other_user_000000" });
    mockHouseholdMember.findFirst.mockResolvedValueOnce({ householdId: "clw_other_hh_000000" });
    mockHouseholdMember.delete.mockResolvedValueOnce({});
    mockAvailability.deleteMany.mockResolvedValueOnce({ count: 0 });

    const result = await leaveHousehold({ householdId: HOUSEHOLD_ID, householdSlug: HOUSEHOLD_SLUG });

    expect(result).toEqual({ success: true });
    expect(mockHouseholdMember.delete).toHaveBeenCalled();
  });

  test("[INVT-05 / D-14] sole-member last-OWNER: Household.delete called (cascade)", async () => {
    mockSession();
    mockAccess("OWNER");
    // count(other OWNERs) = 0, count(total members) = 1 → sole member
    mockHouseholdMember.count
      .mockResolvedValueOnce(0)  // otherOwnerCount
      .mockResolvedValueOnce(1); // totalMemberCount
    mockHousehold.delete.mockResolvedValueOnce({});
    // no remaining membership after household deleted
    mockHouseholdMember.findFirst.mockResolvedValueOnce(null);

    const result = await leaveHousehold({ householdId: HOUSEHOLD_ID, householdSlug: HOUSEHOLD_SLUG });

    expect(result).toEqual({ success: true });
    expect(mockHousehold.delete).toHaveBeenCalledWith({ where: { id: HOUSEHOLD_ID } });
    expect(mockHouseholdMember.delete).not.toHaveBeenCalled();
    expect(vi.mocked(unstable_update)).toHaveBeenCalledWith({
      user: { activeHouseholdId: undefined },
    });
  });

  test("[INVT-05] active assignee leaves: transitionCycle called before member.delete", async () => {
    mockSession();
    mockAccess("MEMBER");
    mockHouseholdMember.count
      .mockResolvedValueOnce(1)  // otherOwnerCount
      .mockResolvedValueOnce(2); // totalMemberCount
    // caller IS the active assignee
    mockCycle.findFirst.mockResolvedValueOnce({ assignedUserId: USER_ID });
    vi.mocked(transitionCycle).mockResolvedValueOnce({ transitioned: true } as never);
    mockHouseholdMember.delete.mockResolvedValueOnce({});
    mockAvailability.deleteMany.mockResolvedValueOnce({ count: 0 });
    mockHouseholdMember.findFirst.mockResolvedValueOnce({ householdId: "clw_other_hh_000000" });

    await leaveHousehold({ householdId: HOUSEHOLD_ID, householdSlug: HOUSEHOLD_SLUG });

    expect(vi.mocked(transitionCycle)).toHaveBeenCalledWith(HOUSEHOLD_ID, "member_left");
    // Assert call order: transitionCycle BEFORE householdMember.delete
    const transitionOrder = vi.mocked(transitionCycle).mock.invocationCallOrder[0];
    const deleteOrder = mockHouseholdMember.delete.mock.invocationCallOrder[0];
    expect(transitionOrder).toBeLessThan(deleteOrder);
  });

  test("[INVT-05] non-assignee leaves: transitionCycle NOT called", async () => {
    mockSession();
    mockAccess("MEMBER");
    mockHouseholdMember.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);
    // different user is the assignee
    mockCycle.findFirst.mockResolvedValueOnce({ assignedUserId: "clw_other_user_000000" });
    mockHouseholdMember.delete.mockResolvedValueOnce({});
    mockAvailability.deleteMany.mockResolvedValueOnce({ count: 0 });
    mockHouseholdMember.findFirst.mockResolvedValueOnce(null);

    await leaveHousehold({ householdId: HOUSEHOLD_ID, householdSlug: HOUSEHOLD_SLUG });

    expect(vi.mocked(transitionCycle)).not.toHaveBeenCalled();
  });

  test("[INVT-05] cancels future availability (startDate >= today)", async () => {
    mockSession();
    mockAccess("MEMBER");
    mockHouseholdMember.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);
    mockCycle.findFirst.mockResolvedValueOnce({ assignedUserId: "clw_other_user_000000" });
    mockHouseholdMember.delete.mockResolvedValueOnce({});
    mockAvailability.deleteMany.mockResolvedValueOnce({ count: 2 });
    mockHouseholdMember.findFirst.mockResolvedValueOnce(null);

    await leaveHousehold({ householdId: HOUSEHOLD_ID, householdSlug: HOUSEHOLD_SLUG });

    expect(mockAvailability.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: USER_ID,
          householdId: HOUSEHOLD_ID,
          startDate: expect.objectContaining({ gte: expect.any(Date) }),
        }),
      }),
    );
    // Verify the date is start of day (hours === 0)
    const callArg = mockAvailability.deleteMany.mock.calls[0][0] as {
      where: { startDate: { gte: Date } };
    };
    expect(callArg.where.startDate.gte.getHours()).toBe(0);
    expect(callArg.where.startDate.gte.getMinutes()).toBe(0);
    expect(callArg.where.startDate.gte.getSeconds()).toBe(0);
  });

  test("[INVT-05 / D-26] unstable_update receives remaining or null", async () => {
    // Sub-case (a): with remaining membership
    mockSession();
    mockAccess("MEMBER");
    mockHouseholdMember.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);
    mockCycle.findFirst.mockResolvedValueOnce({ assignedUserId: "clw_other_user_000000" });
    mockHouseholdMember.delete.mockResolvedValueOnce({});
    mockAvailability.deleteMany.mockResolvedValueOnce({ count: 0 });
    mockHouseholdMember.findFirst.mockResolvedValueOnce({ householdId: "clw_other_hh_000000" });

    await leaveHousehold({ householdId: HOUSEHOLD_ID, householdSlug: HOUSEHOLD_SLUG });

    expect(vi.mocked(unstable_update)).toHaveBeenCalledWith({
      user: { activeHouseholdId: "clw_other_hh_000000" },
    });

    vi.clearAllMocks();

    // Sub-case (b): no remaining membership
    mockSession();
    mockAccess("MEMBER");
    mockHouseholdMember.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);
    mockCycle.findFirst.mockResolvedValueOnce({ assignedUserId: "clw_other_user_000000" });
    mockHouseholdMember.delete.mockResolvedValueOnce({});
    mockAvailability.deleteMany.mockResolvedValueOnce({ count: 0 });
    mockHouseholdMember.findFirst.mockResolvedValueOnce(null);

    await leaveHousehold({ householdId: HOUSEHOLD_ID, householdSlug: HOUSEHOLD_SLUG });

    expect(vi.mocked(unstable_update)).toHaveBeenCalledWith({
      user: { activeHouseholdId: undefined },
    });
  });
});

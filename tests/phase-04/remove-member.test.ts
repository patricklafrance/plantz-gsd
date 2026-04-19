import { expect, test, describe, vi, beforeEach } from "vitest";

vi.mock("@/generated/prisma/client", () => ({ PrismaClient: vi.fn() }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: vi.fn() }));

const mockHouseholdMember = {
  count: vi.fn(),
  delete: vi.fn(),
  findFirst: vi.fn(),
};
const mockAvailability = { deleteMany: vi.fn() };
const mockCycle = { findFirst: vi.fn() };

vi.mock("@/lib/db", () => ({
  db: {
    householdMember: mockHouseholdMember,
    availability: mockAvailability,
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
const { removeMember } = await import("@/features/household/actions");

beforeEach(() => {
  vi.clearAllMocks();
});

const CALLER_ID = "clw_usr_caller_000000000";
const TARGET_ID = "clw_usr_target_000000000";
const HOUSEHOLD_ID = "clw_household_0000000000";
const HOUSEHOLD_SLUG = "my-home";

function mockSession() {
  vi.mocked(auth).mockResolvedValue({
    user: { id: CALLER_ID, isDemo: false },
  } as unknown as Awaited<ReturnType<typeof auth>>);
}

function mockAccess(role: "OWNER" | "MEMBER") {
  vi.mocked(requireHouseholdAccess).mockResolvedValue({
    household: { id: HOUSEHOLD_ID } as never,
    member: {} as never,
    role,
  });
}

describe("removeMember", () => {
  test("[INVT-06 / D-24] non-OWNER caller: returns 'Only household owners can remove members.'", async () => {
    mockSession();
    mockAccess("MEMBER");

    const result = await removeMember({
      householdId: HOUSEHOLD_ID,
      householdSlug: HOUSEHOLD_SLUG,
      targetUserId: TARGET_ID,
    });

    expect(result).toEqual({ error: "Only household owners can remove members." });
    expect(mockHouseholdMember.delete).not.toHaveBeenCalled();
  });

  test("[INVT-06] self-target: returns 'To leave a household, use Leave instead of Remove.'", async () => {
    mockSession();
    // Self-target guard runs BEFORE requireHouseholdAccess

    const result = await removeMember({
      householdId: HOUSEHOLD_ID,
      householdSlug: HOUSEHOLD_SLUG,
      targetUserId: CALLER_ID, // same as session user
    });

    expect(result).toEqual({
      error: "To leave a household, use Leave instead of Remove.",
    });
    expect(vi.mocked(requireHouseholdAccess)).not.toHaveBeenCalled();
    expect(mockHouseholdMember.delete).not.toHaveBeenCalled();
  });

  test("[INVT-06] target is last OWNER: blocked with owner-specific error including display name", async () => {
    mockSession();
    mockAccess("OWNER");
    // Target is an OWNER with display name
    mockHouseholdMember.findFirst.mockResolvedValueOnce({
      role: "OWNER",
      user: { name: "Alice", email: "alice@test.local" },
    });
    // otherOwnerCount (excluding target) = 0
    mockHouseholdMember.count.mockResolvedValueOnce(0);

    const result = await removeMember({
      householdId: HOUSEHOLD_ID,
      householdSlug: HOUSEHOLD_SLUG,
      targetUserId: TARGET_ID,
    });

    expect(result).toEqual({
      error: "Alice is the only owner. Promote another member before removing them.",
    });
    expect(mockHouseholdMember.delete).not.toHaveBeenCalled();
  });

  test("[INVT-06] happy path: non-assignee MEMBER removed; no transitionCycle, no unstable_update", async () => {
    mockSession();
    mockAccess("OWNER");
    // Target is a MEMBER
    mockHouseholdMember.findFirst.mockResolvedValueOnce({
      role: "MEMBER",
      user: { name: "Bob", email: "bob@test.local" },
    });
    // Cycle: target is NOT the assignee
    mockCycle.findFirst.mockResolvedValueOnce({ assignedUserId: "clw_other_user_000000" });
    mockHouseholdMember.delete.mockResolvedValueOnce({});
    mockAvailability.deleteMany.mockResolvedValueOnce({ count: 0 });

    const result = await removeMember({
      householdId: HOUSEHOLD_ID,
      householdSlug: HOUSEHOLD_SLUG,
      targetUserId: TARGET_ID,
    });

    expect(result).toEqual({ success: true });
    expect(mockHouseholdMember.delete).toHaveBeenCalledWith({
      where: { householdId_userId: { householdId: HOUSEHOLD_ID, userId: TARGET_ID } },
    });
    expect(mockAvailability.deleteMany).toHaveBeenCalled();
    expect(vi.mocked(transitionCycle)).not.toHaveBeenCalled();
    expect(vi.mocked(unstable_update)).not.toHaveBeenCalled();
  });

  test("[INVT-06] target is active assignee: transitionCycle called before member.delete", async () => {
    mockSession();
    mockAccess("OWNER");
    mockHouseholdMember.findFirst.mockResolvedValueOnce({
      role: "MEMBER",
      user: { name: "Bob", email: "bob@test.local" },
    });
    // Target IS the active assignee
    mockCycle.findFirst.mockResolvedValueOnce({ assignedUserId: TARGET_ID });
    vi.mocked(transitionCycle).mockResolvedValueOnce({ transitioned: true } as never);
    mockHouseholdMember.delete.mockResolvedValueOnce({});
    mockAvailability.deleteMany.mockResolvedValueOnce({ count: 0 });

    await removeMember({
      householdId: HOUSEHOLD_ID,
      householdSlug: HOUSEHOLD_SLUG,
      targetUserId: TARGET_ID,
    });

    expect(vi.mocked(transitionCycle)).toHaveBeenCalledWith(HOUSEHOLD_ID, "member_left");
    // Assert call order: transitionCycle BEFORE householdMember.delete
    const transitionOrder = vi.mocked(transitionCycle).mock.invocationCallOrder[0];
    const deleteOrder = mockHouseholdMember.delete.mock.invocationCallOrder[0];
    expect(transitionOrder).toBeLessThan(deleteOrder);
  });

  test("[INVT-06] unstable_update NOT called in any removeMember success path", async () => {
    mockSession();
    mockAccess("OWNER");
    mockHouseholdMember.findFirst.mockResolvedValueOnce({
      role: "MEMBER",
      user: { name: "Bob", email: "bob@test.local" },
    });
    mockCycle.findFirst.mockResolvedValueOnce({ assignedUserId: "clw_other_user_000000" });
    mockHouseholdMember.delete.mockResolvedValueOnce({});
    mockAvailability.deleteMany.mockResolvedValueOnce({ count: 0 });

    const result = await removeMember({
      householdId: HOUSEHOLD_ID,
      householdSlug: HOUSEHOLD_SLUG,
      targetUserId: TARGET_ID,
    });

    expect(result).toEqual({ success: true });
    expect(vi.mocked(unstable_update)).not.toHaveBeenCalled();
  });
});

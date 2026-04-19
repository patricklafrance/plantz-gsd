import { expect, test, describe, vi, beforeEach } from "vitest";

vi.mock("@/generated/prisma/client", () => ({ PrismaClient: vi.fn() }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: vi.fn() }));

const mockHouseholdMember = {
  count: vi.fn(),
  update: vi.fn(),
  findFirst: vi.fn(),
};

vi.mock("@/lib/db", () => ({
  db: {
    householdMember: mockHouseholdMember,
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

const { auth } = await import("../../auth");
const { requireHouseholdAccess } = await import("@/features/household/guards");
const { promoteToOwner, demoteToMember } = await import("@/features/household/actions");

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

describe("promoteToOwner", () => {
  test("[INVT-06 / D-24] non-OWNER caller: blocked with 'Only household owners can promote members.'", async () => {
    mockSession();
    mockAccess("MEMBER");

    const result = await promoteToOwner({
      householdId: HOUSEHOLD_ID,
      householdSlug: HOUSEHOLD_SLUG,
      targetUserId: TARGET_ID,
    });

    expect(result).toEqual({ error: "Only household owners can promote members." });
    expect(mockHouseholdMember.update).not.toHaveBeenCalled();
  });

  test("[INVT-06] target is already OWNER: idempotent no-op, no DB update", async () => {
    mockSession();
    mockAccess("OWNER");
    mockHouseholdMember.findFirst.mockResolvedValueOnce({ role: "OWNER" });

    const result = await promoteToOwner({
      householdId: HOUSEHOLD_ID,
      householdSlug: HOUSEHOLD_SLUG,
      targetUserId: TARGET_ID,
    });

    expect(result).toEqual({ success: true });
    expect(mockHouseholdMember.update).not.toHaveBeenCalled();
  });

  test("[INVT-06] MEMBER → OWNER: db.householdMember.update called with role: 'OWNER'", async () => {
    mockSession();
    mockAccess("OWNER");
    mockHouseholdMember.findFirst.mockResolvedValueOnce({ role: "MEMBER" });
    mockHouseholdMember.update.mockResolvedValueOnce({ id: "mbr" });

    const result = await promoteToOwner({
      householdId: HOUSEHOLD_ID,
      householdSlug: HOUSEHOLD_SLUG,
      targetUserId: TARGET_ID,
    });

    expect(result).toEqual({ success: true });
    expect(mockHouseholdMember.update).toHaveBeenCalledWith({
      where: { householdId_userId: { householdId: HOUSEHOLD_ID, userId: TARGET_ID } },
      data: { role: "OWNER" },
    });
  });

  test("[INVT-06] target not found in household: returns 'Member not found in this household.'", async () => {
    mockSession();
    mockAccess("OWNER");
    mockHouseholdMember.findFirst.mockResolvedValueOnce(null);

    const result = await promoteToOwner({
      householdId: HOUSEHOLD_ID,
      householdSlug: HOUSEHOLD_SLUG,
      targetUserId: TARGET_ID,
    });

    expect(result).toEqual({ error: "Member not found in this household." });
    expect(mockHouseholdMember.update).not.toHaveBeenCalled();
  });
});

describe("demoteToMember", () => {
  test("[INVT-06] non-OWNER caller: blocked with 'Only household owners can demote other owners.'", async () => {
    mockSession();
    mockAccess("MEMBER");

    const result = await demoteToMember({
      householdId: HOUSEHOLD_ID,
      householdSlug: HOUSEHOLD_SLUG,
      targetUserId: TARGET_ID,
    });

    expect(result).toEqual({ error: "Only household owners can demote other owners." });
    expect(mockHouseholdMember.update).not.toHaveBeenCalled();
  });

  test("[INVT-06] target is already MEMBER: idempotent no-op, no DB update", async () => {
    mockSession();
    mockAccess("OWNER");
    mockHouseholdMember.findFirst.mockResolvedValueOnce({ role: "MEMBER" });

    const result = await demoteToMember({
      householdId: HOUSEHOLD_ID,
      householdSlug: HOUSEHOLD_SLUG,
      targetUserId: TARGET_ID,
    });

    expect(result).toEqual({ success: true });
    expect(mockHouseholdMember.update).not.toHaveBeenCalled();
  });

  test("[INVT-06] would leave 0 OWNERs: blocked with last-owner error", async () => {
    mockSession();
    mockAccess("OWNER");
    mockHouseholdMember.findFirst.mockResolvedValueOnce({ role: "OWNER" });
    // otherOwnerCount (excluding target) = 0
    mockHouseholdMember.count.mockResolvedValueOnce(0);

    const result = await demoteToMember({
      householdId: HOUSEHOLD_ID,
      householdSlug: HOUSEHOLD_SLUG,
      targetUserId: TARGET_ID,
    });

    expect(result).toEqual({
      error: "Can't demote the last owner. Promote another member to owner first.",
    });
    expect(mockHouseholdMember.update).not.toHaveBeenCalled();
  });

  test("[INVT-06] self-demote with another OWNER present: allowed", async () => {
    mockSession();
    mockAccess("OWNER");
    // Caller demotes themselves (targetUserId = CALLER_ID)
    mockHouseholdMember.findFirst.mockResolvedValueOnce({ role: "OWNER" });
    // Another OWNER exists
    mockHouseholdMember.count.mockResolvedValueOnce(1);
    mockHouseholdMember.update.mockResolvedValueOnce({ id: "mbr" });

    const result = await demoteToMember({
      householdId: HOUSEHOLD_ID,
      householdSlug: HOUSEHOLD_SLUG,
      targetUserId: CALLER_ID, // self-demote
    });

    expect(result).toEqual({ success: true });
    expect(mockHouseholdMember.update).toHaveBeenCalledWith({
      where: { householdId_userId: { householdId: HOUSEHOLD_ID, userId: CALLER_ID } },
      data: { role: "MEMBER" },
    });
  });
});

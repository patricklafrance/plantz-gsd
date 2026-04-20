import { expect, test, describe, vi, beforeEach } from "vitest";

vi.mock("@/generated/prisma/client", () => ({ PrismaClient: vi.fn() }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: vi.fn() }));

const mockHouseholdMember = {
  findMany: vi.fn(),
  updateMany: vi.fn(),
  update: vi.fn(),
};

vi.mock("@/lib/db", () => ({
  db: {
    householdMember: mockHouseholdMember,
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
      return callback({ householdMember: mockHouseholdMember });
    }),
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

const { auth } = await import("../../auth");
const { requireHouseholdAccess } = await import(
  "@/features/household/guards"
);
const { revalidatePath } = await import("next/cache");
const { reorderRotation } = await import("@/features/household/actions");

const OWNER_ID = "clowner12345678901234567a";
const HOUSEHOLD_ID = "clhousehold1234567890abcd";
const HOUSEHOLD_SLUG = "test-house";
const MEMBER_A = "clmemberaaaaaaaaaaaaaaaaa";
const MEMBER_B = "clmemberbbbbbbbbbbbbbbbbb";
const MEMBER_C = "clmembercccccccccccccccccc";
const MEMBER_D = "clmemberdddddddddddddddddd";

function mockSession(opts: { isDemo?: boolean } = {}) {
  vi.mocked(auth).mockResolvedValue({
    user: { id: OWNER_ID, isDemo: opts.isDemo ?? false },
  } as unknown as Awaited<ReturnType<typeof auth>>);
}

function mockRoleAccess(role: "OWNER" | "MEMBER") {
  vi.mocked(requireHouseholdAccess).mockResolvedValueOnce({
    household: { id: HOUSEHOLD_ID, slug: HOUSEHOLD_SLUG } as never,
    member: {} as never,
    role,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("reorderRotation (ROTA-01 / D-11)", () => {
  test("ROTA-01 happy path: updates rotationOrder for each member matching input index", async () => {
    mockSession();
    mockRoleAccess("OWNER");
    mockHouseholdMember.findMany.mockResolvedValueOnce([
      { userId: MEMBER_A },
      { userId: MEMBER_B },
      { userId: MEMBER_C },
    ] as never);
    mockHouseholdMember.update.mockResolvedValue({} as never);

    const result = await reorderRotation({
      householdId: HOUSEHOLD_ID,
      householdSlug: HOUSEHOLD_SLUG,
      orderedMemberUserIds: [MEMBER_C, MEMBER_A, MEMBER_B],
    });

    expect(result).toEqual({ success: true });
    expect(mockHouseholdMember.update).toHaveBeenCalledTimes(3);
    expect(mockHouseholdMember.update).toHaveBeenNthCalledWith(1, {
      where: {
        householdId_userId: { userId: MEMBER_C, householdId: HOUSEHOLD_ID },
      },
      data: { rotationOrder: 0 },
    });
    expect(mockHouseholdMember.update).toHaveBeenNthCalledWith(2, {
      where: {
        householdId_userId: { userId: MEMBER_A, householdId: HOUSEHOLD_ID },
      },
      data: { rotationOrder: 1 },
    });
    expect(mockHouseholdMember.update).toHaveBeenNthCalledWith(3, {
      where: {
        householdId_userId: { userId: MEMBER_B, householdId: HOUSEHOLD_ID },
      },
      data: { rotationOrder: 2 },
    });
  });

  test("ROTA-01 members changed (length mismatch): throws MEMBERS_CHANGED then error 'Member list changed — reload and try again.'", async () => {
    mockSession();
    mockRoleAccess("OWNER");
    // DB has 2 members; input has 3 → length mismatch
    mockHouseholdMember.findMany.mockResolvedValueOnce([
      { userId: MEMBER_A },
      { userId: MEMBER_B },
    ] as never);

    const result = await reorderRotation({
      householdId: HOUSEHOLD_ID,
      householdSlug: HOUSEHOLD_SLUG,
      orderedMemberUserIds: [MEMBER_A, MEMBER_B, MEMBER_C],
    });

    expect(result).toEqual({
      error: "Member list changed — reload and try again.",
    });
    expect(mockHouseholdMember.update).not.toHaveBeenCalled();
  });

  test("ROTA-01 members changed (set mismatch): tx.findMany returns different user-id set then error", async () => {
    mockSession();
    mockRoleAccess("OWNER");
    // Same count (3) but different set: D replaces C
    mockHouseholdMember.findMany.mockResolvedValueOnce([
      { userId: MEMBER_A },
      { userId: MEMBER_B },
      { userId: MEMBER_D },
    ] as never);

    const result = await reorderRotation({
      householdId: HOUSEHOLD_ID,
      householdSlug: HOUSEHOLD_SLUG,
      orderedMemberUserIds: [MEMBER_A, MEMBER_B, MEMBER_C],
    });

    expect(result).toEqual({
      error: "Member list changed — reload and try again.",
    });
    expect(mockHouseholdMember.update).not.toHaveBeenCalled();
  });

  test("ROTA-01 non-OWNER: returns error 'Only household owners can reorder the rotation.'", async () => {
    mockSession();
    mockRoleAccess("MEMBER");

    const result = await reorderRotation({
      householdId: HOUSEHOLD_ID,
      householdSlug: HOUSEHOLD_SLUG,
      orderedMemberUserIds: [MEMBER_A, MEMBER_B, MEMBER_C],
    });

    expect(result).toEqual({
      error: "Only household owners can reorder the rotation.",
    });
    expect(mockHouseholdMember.findMany).not.toHaveBeenCalled();
    expect(mockHouseholdMember.update).not.toHaveBeenCalled();
  });

  test("ROTA-01 demo mode: returns error without touching DB", async () => {
    mockSession({ isDemo: true });

    const result = await reorderRotation({
      householdId: HOUSEHOLD_ID,
      householdSlug: HOUSEHOLD_SLUG,
      orderedMemberUserIds: [MEMBER_A, MEMBER_B, MEMBER_C],
    });

    expect(result).toEqual({
      error:
        "This action is disabled in demo mode. Sign up to get your own household.",
    });
    expect(vi.mocked(requireHouseholdAccess)).not.toHaveBeenCalled();
    expect(mockHouseholdMember.update).not.toHaveBeenCalled();
  });

  test("ROTA-01 unauthenticated: returns 'Not authenticated.'", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const result = await reorderRotation({
      householdId: HOUSEHOLD_ID,
      householdSlug: HOUSEHOLD_SLUG,
      orderedMemberUserIds: [MEMBER_A],
    });

    expect(result).toEqual({ error: "Not authenticated." });
  });

  test("ROTA-01 invalid input: empty array rejected by Zod nonempty() then error", async () => {
    mockSession();

    const result = await reorderRotation({
      householdId: HOUSEHOLD_ID,
      householdSlug: HOUSEHOLD_SLUG,
      orderedMemberUserIds: [],
    });

    expect(result).toEqual({ error: "Invalid input." });
    expect(vi.mocked(requireHouseholdAccess)).not.toHaveBeenCalled();
  });

  test("ROTA-01 revalidatePath called for settings + dashboard", async () => {
    mockSession();
    mockRoleAccess("OWNER");
    mockHouseholdMember.findMany.mockResolvedValueOnce([
      { userId: MEMBER_A },
      { userId: MEMBER_B },
    ] as never);
    mockHouseholdMember.update.mockResolvedValue({} as never);

    await reorderRotation({
      householdId: HOUSEHOLD_ID,
      householdSlug: HOUSEHOLD_SLUG,
      orderedMemberUserIds: [MEMBER_B, MEMBER_A],
    });

    const calls = vi.mocked(revalidatePath).mock.calls;
    expect(calls).toContainEqual(["/h/[householdSlug]/settings", "page"]);
    expect(calls).toContainEqual(["/h/[householdSlug]/dashboard", "page"]);
  });
});

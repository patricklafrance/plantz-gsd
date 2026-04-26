import { expect, test, describe, vi, beforeEach } from "vitest";

vi.mock("@/generated/prisma/client", () => ({ PrismaClient: vi.fn() }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: vi.fn() }));

const mockHouseholdMember = {
  updateMany: vi.fn(),
  update: vi.fn(),
  findMany: vi.fn(),
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

const { db } = await import("@/lib/db");
const { auth } = await import("../../auth");
const { requireHouseholdAccess, ForbiddenError } = await import(
  "@/features/household/guards"
);
const { revalidatePath } = await import("next/cache");
const { setDefaultHousehold } = await import("@/features/household/actions");

const USER_ID = "clowner12345678901234567a";
const HOUSEHOLD_ID = "clhousehold1234567890abcd";

function mockSession(opts: { userId?: string; isDemo?: boolean } = {}) {
  vi.mocked(auth).mockResolvedValue({
    user: { id: opts.userId ?? USER_ID, isDemo: opts.isDemo ?? false },
  } as unknown as Awaited<ReturnType<typeof auth>>);
}

function mockMemberAccess() {
  vi.mocked(requireHouseholdAccess).mockResolvedValueOnce({
    household: { id: HOUSEHOLD_ID, slug: "test-slug" } as never,
    member: {} as never,
    role: "MEMBER",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("setDefaultHousehold (HSET-02 / D-06)", () => {
  test("HSET-02 happy path: clears prior default then sets new default atomically", async () => {
    mockSession();
    mockMemberAccess();
    mockHouseholdMember.updateMany.mockResolvedValueOnce({ count: 1 } as never);
    mockHouseholdMember.update.mockResolvedValueOnce({} as never);

    const result = await setDefaultHousehold({ householdId: HOUSEHOLD_ID });

    expect(result).toEqual({ success: true });
    // Clears prior defaults for this user
    expect(mockHouseholdMember.updateMany).toHaveBeenCalledWith({
      where: { userId: USER_ID, isDefault: true },
      data: { isDefault: false },
    });
    // Sets new default via compound key
    expect(mockHouseholdMember.update).toHaveBeenCalledWith({
      where: {
        householdId_userId: { userId: USER_ID, householdId: HOUSEHOLD_ID },
      },
      data: { isDefault: true },
    });
    // Transaction was used
    expect(vi.mocked(db.$transaction)).toHaveBeenCalledTimes(1);
  });

  test("HSET-02 non-member: requireHouseholdAccess throws ForbiddenError then error", async () => {
    mockSession();
    vi.mocked(requireHouseholdAccess).mockRejectedValueOnce(
      new ForbiddenError("Not a member of this household"),
    );

    const result = await setDefaultHousehold({ householdId: HOUSEHOLD_ID });

    expect(result).toEqual({ error: "Not a member of this household" });
    expect(mockHouseholdMember.updateMany).not.toHaveBeenCalled();
    expect(mockHouseholdMember.update).not.toHaveBeenCalled();
  });

  test("HSET-02 demo mode: returns error without touching DB", async () => {
    mockSession({ isDemo: true });

    const result = await setDefaultHousehold({ householdId: HOUSEHOLD_ID });

    expect(result).toEqual({
      error:
        "This action is disabled in demo mode. Sign up to get your own household.",
    });
    expect(mockHouseholdMember.updateMany).not.toHaveBeenCalled();
    expect(mockHouseholdMember.update).not.toHaveBeenCalled();
    expect(vi.mocked(requireHouseholdAccess)).not.toHaveBeenCalled();
  });

  test("HSET-02 unauthenticated: returns 'Not authenticated.'", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const result = await setDefaultHousehold({ householdId: HOUSEHOLD_ID });

    expect(result).toEqual({ error: "Not authenticated." });
    expect(mockHouseholdMember.updateMany).not.toHaveBeenCalled();
  });

  test("HSET-02 invalid input: Zod safeParse failure then error Invalid input.", async () => {
    mockSession();

    const result = await setDefaultHousehold({});

    expect(result).toEqual({ error: "Invalid input." });
    expect(vi.mocked(requireHouseholdAccess)).not.toHaveBeenCalled();
    expect(mockHouseholdMember.updateMany).not.toHaveBeenCalled();
  });

  test("HSET-02 revalidatePath called for household layout", async () => {
    mockSession();
    mockMemberAccess();
    mockHouseholdMember.updateMany.mockResolvedValueOnce({ count: 1 } as never);
    mockHouseholdMember.update.mockResolvedValueOnce({} as never);

    await setDefaultHousehold({ householdId: HOUSEHOLD_ID });

    const calls = vi.mocked(revalidatePath).mock.calls;
    expect(calls).toContainEqual(["/h/[householdSlug]", "layout"]);
  });
});

import { expect, test, describe, vi, beforeEach } from "vitest";

vi.mock("@/generated/prisma/client", () => ({ PrismaClient: vi.fn() }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: vi.fn() }));

const mockHousehold = { update: vi.fn() };
const mockCycle = { update: vi.fn(), create: vi.fn() };

vi.mock("@/lib/db", () => ({
  db: {
    household: mockHousehold,
    cycle: mockCycle,
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
const { updateHouseholdSettings } = await import(
  "@/features/household/actions"
);

const OWNER_ID = "clowner12345678901234567a";
const HOUSEHOLD_ID = "clhousehold1234567890abcd";
const HOUSEHOLD_SLUG = "test-house";

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

function validInput(
  overrides: Partial<{
    name: string;
    timezone: string;
    cycleDuration: "1" | "3" | "7" | "14";
  }> = {},
) {
  return {
    householdId: HOUSEHOLD_ID,
    householdSlug: HOUSEHOLD_SLUG,
    name: overrides.name ?? "New Name",
    timezone: overrides.timezone ?? "America/New_York",
    cycleDuration: overrides.cycleDuration ?? "7",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("updateHouseholdSettings (HSET-03 / D-13)", () => {
  test("HSET-03 happy path: all three fields written to household row", async () => {
    mockSession();
    mockRoleAccess("OWNER");
    mockHousehold.update.mockResolvedValueOnce({} as never);

    const result = await updateHouseholdSettings(validInput());

    expect(result).toEqual({ success: true });
    expect(mockHousehold.update).toHaveBeenCalledWith({
      where: { id: HOUSEHOLD_ID },
      data: {
        name: "New Name",
        timezone: "America/New_York",
        // cycleDuration is transformed from "7" → 7 by Zod
        cycleDuration: 7,
      },
    });
  });

  test("HSET-03 non-OWNER: returns error 'Only household owners can edit settings.'", async () => {
    mockSession();
    mockRoleAccess("MEMBER");

    const result = await updateHouseholdSettings(validInput());

    expect(result).toEqual({
      error: "Only household owners can edit settings.",
    });
    expect(mockHousehold.update).not.toHaveBeenCalled();
  });

  test("HSET-03 invalid cycleDuration: Zod enum rejects values outside 1/3/7/14", async () => {
    mockSession();

    const result = await updateHouseholdSettings(
      validInput({ cycleDuration: "5" as "1" | "3" | "7" | "14" }),
    );

    expect(result).toEqual({ error: "Invalid input." });
    expect(vi.mocked(requireHouseholdAccess)).not.toHaveBeenCalled();
    expect(mockHousehold.update).not.toHaveBeenCalled();
  });

  test("HSET-03 preserves active cycle: db.cycle.update and db.cycle.create are NOT called (Pitfall 3)", async () => {
    mockSession();
    mockRoleAccess("OWNER");
    mockHousehold.update.mockResolvedValueOnce({} as never);

    await updateHouseholdSettings(
      validInput({ cycleDuration: "14" }),
    );

    // ROTA-07 / Pitfall 3 binding: cycle row is NEVER touched from this action
    expect(mockCycle.update).toHaveBeenCalledTimes(0);
    expect(mockCycle.create).toHaveBeenCalledTimes(0);
  });

  test("HSET-03 demo mode: returns error without touching DB", async () => {
    mockSession({ isDemo: true });

    const result = await updateHouseholdSettings(validInput());

    expect(result).toEqual({
      error:
        "This action is disabled in demo mode. Sign up to get your own household.",
    });
    expect(vi.mocked(requireHouseholdAccess)).not.toHaveBeenCalled();
    expect(mockHousehold.update).not.toHaveBeenCalled();
  });

  test("HSET-03 invalid timezone: Intl.DateTimeFormat pre-check returns user-friendly error", async () => {
    mockSession();
    mockRoleAccess("OWNER");

    const result = await updateHouseholdSettings(
      validInput({ timezone: "Not/A_Real_Zone" }),
    );

    expect(result).toEqual({ error: "Please select a valid timezone." });
    expect(mockHousehold.update).not.toHaveBeenCalled();
  });

  test("HSET-03 unauthenticated: returns 'Not authenticated.'", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const result = await updateHouseholdSettings(validInput());

    expect(result).toEqual({ error: "Not authenticated." });
    expect(mockHousehold.update).not.toHaveBeenCalled();
  });

  test("HSET-03 revalidatePath called for settings + dashboard", async () => {
    mockSession();
    mockRoleAccess("OWNER");
    mockHousehold.update.mockResolvedValueOnce({} as never);

    await updateHouseholdSettings(validInput());

    const calls = vi.mocked(revalidatePath).mock.calls;
    expect(calls).toContainEqual(["/h/[householdSlug]/settings", "page"]);
    expect(calls).toContainEqual(["/h/[householdSlug]/dashboard", "page"]);
  });
});

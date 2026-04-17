import { expect, test, describe, vi, beforeEach } from "vitest";

vi.mock("@/generated/prisma/client", () => ({ PrismaClient: vi.fn() }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    household: { findUnique: vi.fn(), create: vi.fn() },
    householdMember: { create: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("../auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

beforeEach(() => { vi.clearAllMocks(); });

describe("createHousehold (HSLD-02, D-06)", () => {
  test("creates Household + OWNER HouseholdMember in a single $transaction", async () => {
    const { auth } = await import("../auth");
    const { db } = await import("@/lib/db");

    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "user_1", isDemo: false },
    } as Awaited<ReturnType<typeof auth>>);

    const txMock = {
      household: {
        findUnique: vi.fn().mockResolvedValue(null), // no slug collision
        create: vi.fn().mockResolvedValue({
          id: "hh_new",
          slug: "ABCD1234",
          name: "My Second House",
          timezone: "America/New_York",
          cycleDuration: 7,
          rotationStrategy: "sequential",
        }),
      },
      householdMember: { create: vi.fn().mockResolvedValue({}) },
    };
    vi.mocked(db.$transaction).mockImplementation(
      async (cb: (tx: typeof txMock) => unknown) => cb(txMock) as never
    );

    const { createHousehold } = await import("@/features/household/actions");
    const result = await createHousehold({
      name: "My Second House",
      timezone: "America/New_York",
    });

    expect(result).toMatchObject({ success: true });
    expect(txMock.household.create).toHaveBeenCalledTimes(1);
    expect(txMock.householdMember.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user_1",
          householdId: "hh_new",
          role: "OWNER",
          rotationOrder: 0,
        }),
      })
    );
  });

  test("generateHouseholdSlug collision loop throws after 10 attempts", async () => {
    const { auth } = await import("../auth");
    const { db } = await import("@/lib/db");

    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "user_1", isDemo: false },
    } as Awaited<ReturnType<typeof auth>>);

    const txMock = {
      household: {
        findUnique: vi.fn().mockResolvedValue({ id: "existing" }), // ALWAYS collide
        create: vi.fn(),
      },
      householdMember: { create: vi.fn() },
    };
    vi.mocked(db.$transaction).mockImplementation(
      async (cb: (tx: typeof txMock) => unknown) => cb(txMock) as never
    );

    const { createHousehold } = await import("@/features/household/actions");
    await expect(
      createHousehold({ name: "Doomed", timezone: "UTC" })
    ).rejects.toThrow(/Slug generation failed after 10 attempts/);

    // 11 attempts total (0..10 inclusive) before the throw — findUnique called at least 11 times
    expect(txMock.household.findUnique.mock.calls.length).toBeGreaterThanOrEqual(11);
    expect(txMock.household.create).not.toHaveBeenCalled();
  });

  test("returns { error: 'Not authenticated.' } when no session", async () => {
    const { auth } = await import("../auth");
    vi.mocked(auth).mockResolvedValueOnce(null);

    const { createHousehold } = await import("@/features/household/actions");
    const result = await createHousehold({ name: "X", timezone: "UTC" });

    expect(result).toEqual({ error: "Not authenticated." });
  });

  test("returns demo-mode error when session.user.isDemo", async () => {
    const { auth } = await import("../auth");
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "demo", isDemo: true },
    } as Awaited<ReturnType<typeof auth>>);

    const { createHousehold } = await import("@/features/household/actions");
    const result = await createHousehold({ name: "X", timezone: "UTC" });

    expect(result).toEqual({
      error: "Demo mode — sign up to save your changes.",
    });
  });

  test("new createHousehold membership has isDefault: false (secondary household)", async () => {
    const { auth } = await import("../auth");
    const { db } = await import("@/lib/db");

    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "user_1", isDemo: false },
    } as Awaited<ReturnType<typeof auth>>);

    const txMock = {
      household: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "hh_new", slug: "S", name: "N" }),
      },
      householdMember: { create: vi.fn().mockResolvedValue({}) },
    };
    vi.mocked(db.$transaction).mockImplementation(
      async (cb: (tx: typeof txMock) => unknown) => cb(txMock) as never
    );

    const { createHousehold } = await import("@/features/household/actions");
    await createHousehold({ name: "Second", timezone: "UTC" });

    expect(txMock.householdMember.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isDefault: false }),
      })
    );
  });
});

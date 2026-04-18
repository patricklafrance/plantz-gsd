/**
 * AVLB-04 manual skip Server Action (mocked Prisma + mocked auth + mocked
 * transitionCycle + mocked guards). Covers the 5 negative paths plus the
 * happy path. Does NOT touch Postgres.
 */
import { expect, test, describe, vi, beforeEach } from "vitest";

vi.mock("@/generated/prisma/client", () => ({ PrismaClient: vi.fn() }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    cycle: { findFirst: vi.fn() },
  },
}));
vi.mock("../../auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// Mock the engine so we can assert the exact call shape without running the
// full FOR UPDATE SKIP LOCKED path.
vi.mock("@/features/household/cycle", async () => {
  const actual = await vi.importActual<typeof import("@/features/household/cycle")>(
    "@/features/household/cycle",
  );
  return {
    ...actual,
    transitionCycle: vi.fn(),
  };
});

// Mock the guards module so ForbiddenError is constructable and
// requireHouseholdAccess can be controlled per-test.
vi.mock("@/features/household/guards", () => {
  class ForbiddenError extends Error {
    readonly name = "ForbiddenError" as const;
    readonly statusCode = 403 as const;
    constructor(message = "Access denied") {
      super(message);
      Object.setPrototypeOf(this, ForbiddenError.prototype);
    }
  }
  return {
    ForbiddenError,
    requireHouseholdAccess: vi.fn(),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("skipCurrentCycle (AVLB-04, D-14)", () => {
  const HOUSEHOLD_ID = "clh1234567890abcdefghijkl";
  const HOUSEHOLD_SLUG = "test-slug";
  const USER_ID = "user_1";
  const OTHER_USER_ID = "user_2";

  test("no session → { error: 'Not authenticated.' } and transitionCycle NOT called", async () => {
    const { auth } = await import("../../auth");
    const { transitionCycle } = await import("@/features/household/cycle");

    vi.mocked(auth).mockResolvedValue(null as unknown as Awaited<ReturnType<typeof auth>>);

    const { skipCurrentCycle } = await import("@/features/household/actions");
    const result = await skipCurrentCycle({
      householdId: HOUSEHOLD_ID,
      householdSlug: HOUSEHOLD_SLUG,
    });

    expect(result).toEqual({ error: "Not authenticated." });
    expect(transitionCycle).not.toHaveBeenCalled();
  });

  test("demo user → demo error and transitionCycle NOT called", async () => {
    const { auth } = await import("../../auth");
    const { transitionCycle } = await import("@/features/household/cycle");

    vi.mocked(auth).mockResolvedValue({
      user: { id: USER_ID, isDemo: true },
    } as unknown as Awaited<ReturnType<typeof auth>>);

    const { skipCurrentCycle } = await import("@/features/household/actions");
    const result = await skipCurrentCycle({
      householdId: HOUSEHOLD_ID,
      householdSlug: HOUSEHOLD_SLUG,
    });

    expect(result).toEqual({
      error: "Demo mode — sign up to save your changes.",
    });
    expect(transitionCycle).not.toHaveBeenCalled();
  });

  test("invalid Zod input → { error: 'Invalid input.' }", async () => {
    const { auth } = await import("../../auth");
    const { transitionCycle } = await import("@/features/household/cycle");

    vi.mocked(auth).mockResolvedValue({
      user: { id: USER_ID, isDemo: false },
    } as unknown as Awaited<ReturnType<typeof auth>>);

    const { skipCurrentCycle } = await import("@/features/household/actions");
    const result = await skipCurrentCycle({
      householdId: "not-a-cuid",
      householdSlug: "x",
    });

    expect(result).toEqual({ error: "Invalid input." });
    expect(transitionCycle).not.toHaveBeenCalled();
  });

  test("requireHouseholdAccess throws ForbiddenError → { error } forwarded, transitionCycle NOT called", async () => {
    const { auth } = await import("../../auth");
    const { transitionCycle } = await import("@/features/household/cycle");
    const { requireHouseholdAccess, ForbiddenError } = await import(
      "@/features/household/guards"
    );

    vi.mocked(auth).mockResolvedValue({
      user: { id: USER_ID, isDemo: false },
    } as unknown as Awaited<ReturnType<typeof auth>>);

    vi.mocked(requireHouseholdAccess).mockRejectedValueOnce(
      new ForbiddenError("Not a member of this household"),
    );

    const { skipCurrentCycle } = await import("@/features/household/actions");
    const result = await skipCurrentCycle({
      householdId: HOUSEHOLD_ID,
      householdSlug: HOUSEHOLD_SLUG,
    });

    expect(result).toEqual({ error: "Not a member of this household" });
    expect(transitionCycle).not.toHaveBeenCalled();
  });

  test("current assignee != session.user.id → error, transitionCycle NOT called", async () => {
    const { auth } = await import("../../auth");
    const { db } = await import("@/lib/db");
    const { transitionCycle } = await import("@/features/household/cycle");
    const { requireHouseholdAccess } = await import(
      "@/features/household/guards"
    );

    vi.mocked(auth).mockResolvedValue({
      user: { id: USER_ID, isDemo: false },
    } as unknown as Awaited<ReturnType<typeof auth>>);
    vi.mocked(requireHouseholdAccess).mockResolvedValueOnce({
      household: { id: HOUSEHOLD_ID } as never,
      member: {} as never,
      role: "MEMBER",
    });
    vi.mocked(db.cycle.findFirst).mockResolvedValueOnce({
      id: "cyc_1",
      assignedUserId: OTHER_USER_ID,
      status: "active",
    } as never);

    const { skipCurrentCycle } = await import("@/features/household/actions");
    const result = await skipCurrentCycle({
      householdId: HOUSEHOLD_ID,
      householdSlug: HOUSEHOLD_SLUG,
    });

    expect(result).toEqual({
      error: "Only the active assignee can skip this cycle.",
    });
    expect(transitionCycle).not.toHaveBeenCalled();
  });

  test("happy path (assignee matches) → transitionCycle(householdId, 'manual_skip') + revalidatePath(dashboard, 'page') + { success: true }", async () => {
    const { auth } = await import("../../auth");
    const { db } = await import("@/lib/db");
    const { transitionCycle } = await import("@/features/household/cycle");
    const { requireHouseholdAccess } = await import(
      "@/features/household/guards"
    );
    const { revalidatePath } = await import("next/cache");
    const { HOUSEHOLD_PATHS } = await import("@/features/household/paths");

    vi.mocked(auth).mockResolvedValue({
      user: { id: USER_ID, isDemo: false },
    } as unknown as Awaited<ReturnType<typeof auth>>);
    vi.mocked(requireHouseholdAccess).mockResolvedValueOnce({
      household: { id: HOUSEHOLD_ID } as never,
      member: {} as never,
      role: "OWNER",
    });
    vi.mocked(db.cycle.findFirst).mockResolvedValueOnce({
      id: "cyc_1",
      assignedUserId: USER_ID, // caller IS the assignee
      status: "active",
    } as never);
    vi.mocked(transitionCycle).mockResolvedValueOnce({
      transitioned: true,
      fromCycleNumber: 1,
      toCycleNumber: 2,
      reason: "manual_skip",
      assignedUserId: OTHER_USER_ID,
      status: "active",
    });

    const { skipCurrentCycle } = await import("@/features/household/actions");
    const result = await skipCurrentCycle({
      householdId: HOUSEHOLD_ID,
      householdSlug: HOUSEHOLD_SLUG,
    });

    expect(result).toEqual({ success: true });
    expect(transitionCycle).toHaveBeenCalledTimes(1);
    expect(transitionCycle).toHaveBeenCalledWith(HOUSEHOLD_ID, "manual_skip");
    expect(revalidatePath).toHaveBeenCalledWith(HOUSEHOLD_PATHS.dashboard, "page");
  });
});

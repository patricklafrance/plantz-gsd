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
    $transaction: vi.fn(),
  },
}));
vi.mock("../../auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// Mock the cycle engine so we can assert call shape without running the real
// rotation walk or the FOR UPDATE SKIP LOCKED path.
vi.mock("@/features/household/cycle", async () => {
  const actual = await vi.importActual<typeof import("@/features/household/cycle")>(
    "@/features/household/cycle",
  );
  return {
    ...actual,
    transitionCycle: vi.fn(),
    findNextAssignee: vi.fn(),
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

  test("current assignee != session.user.id → error surfaces, no cycle.update, no transitionCycle", async () => {
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

    const cycleUpdate = vi.fn();
    const notificationCreate = vi.fn();
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          id: "cyc_1",
          assignedUserId: OTHER_USER_ID,
          startDate: new Date("2026-04-20T00:00:00Z"),
          endDate: new Date("2026-04-27T00:00:00Z"),
        },
      ]),
      householdMember: { findMany: vi.fn() },
      cycle: { update: cycleUpdate },
      householdNotification: { create: notificationCreate },
    };
    vi.mocked(db.$transaction).mockImplementation(
      (async (cb: (tx: unknown) => unknown) => cb(tx)) as never,
    );

    const { skipCurrentCycle } = await import("@/features/household/actions");
    const result = await skipCurrentCycle({
      householdId: HOUSEHOLD_ID,
      householdSlug: HOUSEHOLD_SLUG,
    });

    expect(result).toEqual({
      error: "Only the active assignee can skip this cycle.",
    });
    expect(cycleUpdate).not.toHaveBeenCalled();
    expect(notificationCreate).not.toHaveBeenCalled();
    expect(transitionCycle).not.toHaveBeenCalled();
  });

  test("happy path → cycle.update reassigns to next member, notification emitted, transitionCycle NOT called", async () => {
    const { auth } = await import("../../auth");
    const { db } = await import("@/lib/db");
    const { transitionCycle, findNextAssignee } = await import(
      "@/features/household/cycle"
    );
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
    vi.mocked(findNextAssignee).mockResolvedValueOnce({
      userId: OTHER_USER_ID,
      fallback: false,
    });

    const cycleUpdate = vi.fn().mockResolvedValue({});
    const notificationCreate = vi.fn().mockResolvedValue({});
    const memberFindMany = vi.fn().mockResolvedValue([
      { userId: USER_ID, rotationOrder: 1, role: "OWNER" },
      { userId: OTHER_USER_ID, rotationOrder: 2, role: "MEMBER" },
    ]);
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          id: "cyc_1",
          assignedUserId: USER_ID, // caller IS the assignee
          startDate: new Date("2026-04-20T00:00:00Z"),
          endDate: new Date("2026-04-27T00:00:00Z"),
        },
      ]),
      householdMember: { findMany: memberFindMany },
      cycle: { update: cycleUpdate },
      householdNotification: { create: notificationCreate },
    };
    vi.mocked(db.$transaction).mockImplementation(
      (async (cb: (tx: unknown) => unknown) => cb(tx)) as never,
    );

    const { skipCurrentCycle } = await import("@/features/household/actions");
    const result = await skipCurrentCycle({
      householdId: HOUSEHOLD_ID,
      householdSlug: HOUSEHOLD_SLUG,
    });

    expect(result).toEqual({ success: true });
    expect(cycleUpdate).toHaveBeenCalledWith({
      where: { id: "cyc_1" },
      data: { assignedUserId: OTHER_USER_ID },
    });
    expect(notificationCreate).toHaveBeenCalledTimes(1);
    expect(notificationCreate.mock.calls[0][0].data).toMatchObject({
      householdId: HOUSEHOLD_ID,
      recipientUserId: OTHER_USER_ID,
      cycleId: "cyc_1",
      priorAssigneeUserId: USER_ID,
    });
    // Phase 8 deliberate behavior: findNextAssignee receives today's date (who
    // can take over RIGHT NOW), not cycle.endDate. Pinning so a future "use
    // cycle.endDate" regression is caught at unit-test level.
    expect(findNextAssignee).toHaveBeenCalledTimes(1);
    const ndaArgs = vi.mocked(findNextAssignee).mock.calls[0];
    expect(ndaArgs[3].assignedUserId).toBe(USER_ID);
    expect(ndaArgs[3].endDate.getTime()).not.toBe(
      new Date("2026-04-27T00:00:00Z").getTime(),
    );
    expect(Math.abs(ndaArgs[3].endDate.getTime() - Date.now())).toBeLessThan(5_000);
    expect(transitionCycle).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith(HOUSEHOLD_PATHS.dashboard, "page");
  });

  test("no active cycle → error, no cycle.update, no notification", async () => {
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

    const cycleUpdate = vi.fn();
    const notificationCreate = vi.fn();
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      householdMember: { findMany: vi.fn() },
      cycle: { update: cycleUpdate },
      householdNotification: { create: notificationCreate },
    };
    vi.mocked(db.$transaction).mockImplementation(
      (async (cb: (tx: unknown) => unknown) => cb(tx)) as never,
    );

    const { skipCurrentCycle } = await import("@/features/household/actions");
    const result = await skipCurrentCycle({
      householdId: HOUSEHOLD_ID,
      householdSlug: HOUSEHOLD_SLUG,
    });

    expect(result).toEqual({ error: "No active cycle to skip." });
    expect(cycleUpdate).not.toHaveBeenCalled();
    expect(notificationCreate).not.toHaveBeenCalled();
    expect(transitionCycle).not.toHaveBeenCalled();
  });

  test("solo household → error, no cycle.update, no notification", async () => {
    const { auth } = await import("../../auth");
    const { db } = await import("@/lib/db");
    const { transitionCycle, findNextAssignee } = await import(
      "@/features/household/cycle"
    );
    const { requireHouseholdAccess } = await import(
      "@/features/household/guards"
    );

    vi.mocked(auth).mockResolvedValue({
      user: { id: USER_ID, isDemo: false },
    } as unknown as Awaited<ReturnType<typeof auth>>);
    vi.mocked(requireHouseholdAccess).mockResolvedValueOnce({
      household: { id: HOUSEHOLD_ID } as never,
      member: {} as never,
      role: "OWNER",
    });

    const cycleUpdate = vi.fn();
    const notificationCreate = vi.fn();
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          id: "cyc_1",
          assignedUserId: USER_ID,
          startDate: new Date("2026-04-20T00:00:00Z"),
          endDate: new Date("2026-04-27T00:00:00Z"),
        },
      ]),
      householdMember: {
        findMany: vi.fn().mockResolvedValue([
          { userId: USER_ID, rotationOrder: 1, role: "OWNER" },
        ]),
      },
      cycle: { update: cycleUpdate },
      householdNotification: { create: notificationCreate },
    };
    vi.mocked(db.$transaction).mockImplementation(
      (async (cb: (tx: unknown) => unknown) => cb(tx)) as never,
    );

    const { skipCurrentCycle } = await import("@/features/household/actions");
    const result = await skipCurrentCycle({
      householdId: HOUSEHOLD_ID,
      householdSlug: HOUSEHOLD_SLUG,
    });

    expect(result).toEqual({
      error:
        "You're the only member of this household — invite someone first.",
    });
    expect(cycleUpdate).not.toHaveBeenCalled();
    expect(notificationCreate).not.toHaveBeenCalled();
    expect(findNextAssignee).not.toHaveBeenCalled();
    expect(transitionCycle).not.toHaveBeenCalled();
  });
});

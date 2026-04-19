import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/generated/prisma/client", () => ({ PrismaClient: vi.fn() }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: { householdNotification: { updateMany: vi.fn() } },
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
const { markNotificationsRead } = await import(
  "@/features/household/actions"
);

beforeEach(() => {
  vi.clearAllMocks();
});

const USER_A = "user_A";
const HH_ID = "ckabcdefghijklmnopqrstuvw";
const HH_SLUG = "hh-1";
const N1 = "ckn1abcdefghijklmnopqrstu";
const N2 = "ckn2abcdefghijklmnopqrstu";

function mockAuthedSession(userId = USER_A, isDemo = false) {
  vi.mocked(auth).mockResolvedValue({
    user: { id: userId, isDemo },
  } as unknown as Awaited<ReturnType<typeof auth>>);
}

function mockAccessOk() {
  vi.mocked(requireHouseholdAccess).mockResolvedValue({
    household: { id: HH_ID } as never,
    member: {} as never,
    role: "MEMBER",
  });
}

describe("markNotificationsRead (D-20, D-24)", () => {
  test("HNTF-01 unauthenticated session → returns { error: 'Not authenticated.' }", async () => {
    vi.mocked(auth).mockResolvedValue(null as unknown as Awaited<ReturnType<typeof auth>>);

    const result = await markNotificationsRead({
      householdId: HH_ID,
      householdSlug: HH_SLUG,
      notificationIds: [N1],
    });

    expect(result).toEqual({ error: "Not authenticated." });
    expect(db.householdNotification.updateMany).not.toHaveBeenCalled();
  });

  test("HNTF-01 demo user → returns { error: 'Demo mode — sign up to save your changes.' }", async () => {
    mockAuthedSession(USER_A, true);

    const result = await markNotificationsRead({
      householdId: HH_ID,
      householdSlug: HH_SLUG,
      notificationIds: [N1],
    });

    expect(result).toEqual({
      error: "Demo mode — sign up to save your changes.",
    });
    expect(db.householdNotification.updateMany).not.toHaveBeenCalled();
  });

  test("HNTF-01 invalid input (missing notificationIds) → returns { error: 'Invalid input.' }", async () => {
    mockAuthedSession();

    const result = await markNotificationsRead({
      householdId: HH_ID,
      householdSlug: HH_SLUG,
      // notificationIds missing
    });

    expect(result).toEqual({ error: "Invalid input." });
    expect(db.householdNotification.updateMany).not.toHaveBeenCalled();
  });

  test("HNTF-01 non-member viewer → requireHouseholdAccess throws ForbiddenError → returns { error }", async () => {
    mockAuthedSession();
    vi.mocked(requireHouseholdAccess).mockRejectedValue(
      new ForbiddenError("Not a member of this household"),
    );

    const result = await markNotificationsRead({
      householdId: HH_ID,
      householdSlug: HH_SLUG,
      notificationIds: [N1],
    });

    expect(result).toEqual({ error: "Not a member of this household" });
    expect(db.householdNotification.updateMany).not.toHaveBeenCalled();
  });

  test("HNTF-01 member-but-not-recipient → updateMany called with recipientUserId filter, zero rows updated, returns { success: true }", async () => {
    mockAuthedSession();
    mockAccessOk();
    vi.mocked(db.householdNotification.updateMany).mockResolvedValue({
      count: 0,
    } as never);

    const result = await markNotificationsRead({
      householdId: HH_ID,
      householdSlug: HH_SLUG,
      notificationIds: [N1, N2],
    });

    const callArg = vi.mocked(db.householdNotification.updateMany).mock.calls[0][0] as {
      where: { recipientUserId: string };
    };
    expect(callArg.where.recipientUserId).toBe(USER_A);
    expect(result).toEqual({ success: true });
  });

  test("HNTF-01 authenticated recipient → updateMany called with { id: { in: ids }, recipientUserId, readAt: null }, data: { readAt: new Date() }", async () => {
    mockAuthedSession();
    mockAccessOk();
    vi.mocked(db.householdNotification.updateMany).mockResolvedValue({
      count: 2,
    } as never);

    const result = await markNotificationsRead({
      householdId: HH_ID,
      householdSlug: HH_SLUG,
      notificationIds: [N1, N2],
    });

    expect(db.householdNotification.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: [N1, N2] },
        recipientUserId: USER_A,
        readAt: null,
      },
      data: { readAt: expect.any(Date) },
    });
    expect(result).toEqual({ success: true });
  });

  test("HNTF-01 success path revalidates HOUSEHOLD_PATHS.dashboard with 'page' type", async () => {
    mockAuthedSession();
    mockAccessOk();
    vi.mocked(db.householdNotification.updateMany).mockResolvedValue({
      count: 1,
    } as never);

    await markNotificationsRead({
      householdId: HH_ID,
      householdSlug: HH_SLUG,
      notificationIds: [N1],
    });

    expect(revalidatePath).toHaveBeenCalledWith(
      "/h/[householdSlug]/dashboard",
      "page",
    );
  });

  test("HNTF-01 re-open with already-read ids → updateMany predicate filters them; idempotent zero-count success", async () => {
    mockAuthedSession();
    mockAccessOk();
    vi.mocked(db.householdNotification.updateMany).mockResolvedValue({
      count: 0,
    } as never);

    const result = await markNotificationsRead({
      householdId: HH_ID,
      householdSlug: HH_SLUG,
      notificationIds: [N1],
    });

    const callArg = vi.mocked(db.householdNotification.updateMany).mock.calls[0][0] as {
      where: { readAt: null };
    };
    expect(callArg.where.readAt).toBeNull();
    expect(result).toEqual({ success: true });
  });
});

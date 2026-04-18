/**
 * AVLB-02 overlap rejection (mocked-Prisma unit test). Exercises createAvailability's
 * D-06 overlap precheck end-to-end without touching a real DB.
 */
import { expect, test, describe, vi, beforeEach } from "vitest";
import { addDays, startOfDay } from "date-fns";

vi.mock("@/generated/prisma/client", () => ({ PrismaClient: vi.fn() }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    availability: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    householdMember: { findFirst: vi.fn() },
    household: { findUnique: vi.fn() },
  },
}));
vi.mock("../../auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createAvailability overlap rejection (AVLB-02, D-06, Pitfall 11)", () => {
  const HOUSEHOLD_ID = "clh1234567890abcdefghijkl";
  const HOUSEHOLD_SLUG = "test-slug";
  const USER_ID = "user_1";

  function futureRange(daysFromToday: number, lengthDays: number) {
    const start = addDays(startOfDay(new Date()), daysFromToday);
    const end = addDays(start, lengthDays);
    return { startDate: start, endDate: end };
  }

  test("overlap hit → { error } contains D-06 message with formatted dates", async () => {
    const { auth } = await import("../../auth");
    const { db } = await import("@/lib/db");

    // createAvailability calls auth() once directly, and requireHouseholdAccess
    // calls it again — use mockResolvedValue (not Once) so both hits resolve.
    vi.mocked(auth).mockResolvedValue({
      user: { id: USER_ID, isDemo: false },
    } as unknown as Awaited<ReturnType<typeof auth>>);

    // requireHouseholdAccess uses householdMember.findFirst under the hood
    vi.mocked(db.householdMember.findFirst).mockResolvedValueOnce({
      id: "mem_1",
      userId: USER_ID,
      householdId: HOUSEHOLD_ID,
      role: "OWNER",
      rotationOrder: 0,
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      household: { id: HOUSEHOLD_ID },
    } as never);

    // Overlap precheck hits
    const existingStart = addDays(startOfDay(new Date()), 5);
    const existingEnd = addDays(startOfDay(new Date()), 10);
    vi.mocked(db.availability.findFirst).mockResolvedValueOnce({
      id: "avl_existing",
      startDate: existingStart,
      endDate: existingEnd,
    } as never);

    const { createAvailability } = await import("@/features/household/actions");
    const result = await createAvailability({
      householdId: HOUSEHOLD_ID,
      householdSlug: HOUSEHOLD_SLUG,
      ...futureRange(3, 5),
    });

    expect(result).toHaveProperty("error");
    const errorStr = (result as { error: string }).error;
    expect(errorStr).toContain("You already have an availability period covering those dates");
    expect(errorStr).toMatch(/Delete it first, or pick non-overlapping dates\.$/);
    // Dates are formatted as "MMM d, yyyy"; spot-check with a month name
    expect(errorStr).toMatch(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}, \d{4}\b/);
    // create must NOT have been called
    expect(db.availability.create).not.toHaveBeenCalled();
  });

  test("no overlap → db.availability.create called with correct payload, returns success", async () => {
    const { auth } = await import("../../auth");
    const { db } = await import("@/lib/db");

    vi.mocked(auth).mockResolvedValue({
      user: { id: USER_ID, isDemo: false },
    } as unknown as Awaited<ReturnType<typeof auth>>);

    vi.mocked(db.householdMember.findFirst).mockResolvedValueOnce({
      id: "mem_1",
      userId: USER_ID,
      householdId: HOUSEHOLD_ID,
      role: "MEMBER",
      rotationOrder: 1,
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      household: { id: HOUSEHOLD_ID },
    } as never);

    vi.mocked(db.availability.findFirst).mockResolvedValueOnce(null);
    vi.mocked(db.availability.create).mockResolvedValueOnce({
      id: "avl_new",
    } as never);

    const { startDate, endDate } = futureRange(3, 5);
    const { createAvailability } = await import("@/features/household/actions");
    const result = await createAvailability({
      householdId: HOUSEHOLD_ID,
      householdSlug: HOUSEHOLD_SLUG,
      startDate,
      endDate,
      reason: "vacation",
    });

    expect(result).toMatchObject({ success: true });
    expect(db.availability.create).toHaveBeenCalledTimes(1);
    expect(db.availability.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: USER_ID,
          householdId: HOUSEHOLD_ID,
          startDate,
          endDate,
          reason: "vacation",
        }),
      }),
    );
  });

  test("D-06 literal operators: findFirst called with startDate lte input.endDate AND endDate gte input.startDate", async () => {
    const { auth } = await import("../../auth");
    const { db } = await import("@/lib/db");

    vi.mocked(auth).mockResolvedValue({
      user: { id: USER_ID, isDemo: false },
    } as unknown as Awaited<ReturnType<typeof auth>>);

    vi.mocked(db.householdMember.findFirst).mockResolvedValueOnce({
      id: "mem_1",
      userId: USER_ID,
      householdId: HOUSEHOLD_ID,
      role: "MEMBER",
      rotationOrder: 1,
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      household: { id: HOUSEHOLD_ID },
    } as never);

    vi.mocked(db.availability.findFirst).mockResolvedValueOnce(null);
    vi.mocked(db.availability.create).mockResolvedValueOnce({ id: "x" } as never);

    const { startDate, endDate } = futureRange(3, 5);
    const { createAvailability } = await import("@/features/household/actions");
    await createAvailability({
      householdId: HOUSEHOLD_ID,
      householdSlug: HOUSEHOLD_SLUG,
      startDate,
      endDate,
    });

    // D-06 closed-interval semantics: lte/gte (NOT lt/gt)
    expect(db.availability.findFirst).toHaveBeenCalledTimes(1);
    const call = vi.mocked(db.availability.findFirst).mock.calls[0][0];
    expect(call).toBeDefined();
    const where = (call as { where: Record<string, unknown> }).where;
    expect(where.userId).toBe(USER_ID);
    expect(where.householdId).toBe(HOUSEHOLD_ID);
    expect(where.startDate).toEqual({ lte: endDate });
    expect(where.endDate).toEqual({ gte: startDate });
  });
});

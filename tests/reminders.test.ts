import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/generated/prisma/client", () => ({ PrismaClient: vi.fn() }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: vi.fn() },
    plant: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    reminder: { findUnique: vi.fn() },
  },
}));
vi.mock("../auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Reminder queries", () => {
  describe("getReminderCount", () => {
    it.todo("returns 0 when user has remindersEnabled=false");
    it.todo("counts overdue plants with enabled reminders");
    it.todo("counts due-today plants with enabled reminders");
    it.todo("excludes snoozed plants from count when snoozedUntil is in the future");
    it.todo("includes plants whose snoozedUntil has expired");
    it.todo("excludes plants with reminder enabled=false");
    it.todo("excludes archived plants from count");
  });

  describe("getReminderItems", () => {
    it.todo("returns ReminderItem[] with nickname, roomName, statusLabel");
    it.todo("sorts overdue plants before due-today plants");
    it.todo("excludes snoozed plants");
    it.todo("returns empty array when no plants need attention");
  });
});

describe("Reminder actions", () => {
  describe("snoozeReminder", () => {
    it.todo("sets snoozedUntil on the Reminder record");
    it.todo("rejects snooze with days < 1");
    it.todo("rejects snooze with days > 365");
    it.todo("rejects snooze for plant not owned by user");
    it.todo("creates Reminder record via upsert if none exists");
  });

  describe("togglePlantReminder", () => {
    it.todo("sets enabled=true on the Reminder record");
    it.todo("sets enabled=false on the Reminder record");
    it.todo("rejects toggle for plant not owned by user");
  });

  describe("toggleGlobalReminders", () => {
    it.todo("sets remindersEnabled=true on the User record");
    it.todo("sets remindersEnabled=false on the User record");
  });
});

describe("Zod schemas", () => {
  describe("snoozeSchema", () => {
    it("rejects empty plantId", async () => {
      const { snoozeSchema } = await import("@/features/reminders/schemas");
      const result = snoozeSchema.safeParse({ plantId: "", days: 1 });
      expect(result.success).toBe(false);
    });

    it("rejects days=0", async () => {
      const { snoozeSchema } = await import("@/features/reminders/schemas");
      const result = snoozeSchema.safeParse({ plantId: "abc", days: 0 });
      expect(result.success).toBe(false);
    });

    it("accepts valid input", async () => {
      const { snoozeSchema } = await import("@/features/reminders/schemas");
      const result = snoozeSchema.safeParse({ householdId: "clxxxxxxxxxxxxxxxxxxxxxxxxx", plantId: "abc", days: 7 });
      expect(result.success).toBe(true);
    });
  });

  describe("toggleReminderSchema", () => {
    it("accepts valid input", async () => {
      const { toggleReminderSchema } = await import("@/features/reminders/schemas");
      const result = toggleReminderSchema.safeParse({ householdId: "clxxxxxxxxxxxxxxxxxxxxxxxxx", plantId: "abc", enabled: true });
      expect(result.success).toBe(true);
    });
  });
});

describe("Phase 2 — reminders queries honor householdId scope (D-10, D-14, D-15, D-16)", () => {
  it("getReminderCount uses householdId (NOT userId) in where clause", async () => {
    const { db } = await import("@/lib/db");
    vi.mocked(db.plant.count).mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    const { getReminderCount } = await import("@/features/reminders/queries");
    const todayStart = new Date("2026-04-16T00:00:00Z");
    const todayEnd = new Date("2026-04-17T00:00:00Z");
    await getReminderCount("hh_TEST", todayStart, todayEnd);
    expect(db.plant.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ householdId: "hh_TEST" }),
      })
    );
    // Assert no userId in the where — proves D-15 regression is intentional
    const call = vi.mocked(db.plant.count).mock.calls[0][0];
    expect(JSON.stringify(call)).not.toMatch(/"userId"\s*:/);
  });

  it("getReminderItems uses householdId (NOT userId) in where clause", async () => {
    const { db } = await import("@/lib/db");
    vi.mocked(db.plant.findMany).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const { getReminderItems } = await import("@/features/reminders/queries");
    const todayStart = new Date("2026-04-16T00:00:00Z");
    const todayEnd = new Date("2026-04-17T00:00:00Z");
    await getReminderItems("hh_TEST", todayStart, todayEnd);
    expect(db.plant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ householdId: "hh_TEST" }),
      })
    );
  });

  it("D-15 regression notice: getReminderCount body has NO assignee-gate — every member sees the same count", async () => {
    // This is a documentation-style test that locks the D-15 contract. Phase 5 will
    // modify the function body to add an assignee gate; that change should DELETE this
    // test and replace it with an assignee-positive + assignee-zero pair.
    const { db } = await import("@/lib/db");
    vi.mocked(db.plant.count).mockResolvedValueOnce(21).mockResolvedValueOnce(21);
    const { getReminderCount } = await import("@/features/reminders/queries");
    const r = await getReminderCount("hh_TEST", new Date(), new Date());
    // Sanity: the function returned the mocked count without further filtering
    expect(r).toBe(42);
    // No Cycle model or assignedUserId referenced in the where
    const call = vi.mocked(db.plant.count).mock.calls[0][0];
    expect(JSON.stringify(call)).not.toMatch(/cycle|assignedUserId/i);
  });
});

describe("Phase 2 — reminders actions reject non-members with ForbiddenError (D-17, Pitfall 16)", () => {
  it.todo("snoozeReminder throws ForbiddenError when requireHouseholdAccess throws");
  it.todo("snoozeCustomReminder throws ForbiddenError when requireHouseholdAccess throws");
  it.todo("togglePlantReminder throws ForbiddenError when requireHouseholdAccess throws");
});

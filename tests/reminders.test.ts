import { describe, it, expect } from "vitest";

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
      const result = snoozeSchema.safeParse({ plantId: "abc", days: 7 });
      expect(result.success).toBe(true);
    });
  });

  describe("toggleReminderSchema", () => {
    it("accepts valid input", async () => {
      const { toggleReminderSchema } = await import("@/features/reminders/schemas");
      const result = toggleReminderSchema.safeParse({ plantId: "abc", enabled: true });
      expect(result.success).toBe(true);
    });
  });
});

describe("Phase 2 — reminders queries honor householdId scope (D-10, D-14, D-15, D-16)", () => {
  it.todo("getReminderCount uses householdId (NOT userId) in where clause");
  it.todo("getReminderItems uses householdId (NOT userId) in where clause");
  it.todo("Phase 5 regression notice: no assignee gate — every member sees the same count (D-15)");
});

describe("Phase 2 — reminders actions reject non-members with ForbiddenError (D-17, Pitfall 16)", () => {
  it.todo("snoozeReminder throws ForbiddenError when requireHouseholdAccess throws");
  it.todo("snoozeCustomReminder throws ForbiddenError when requireHouseholdAccess throws");
  it.todo("togglePlantReminder throws ForbiddenError when requireHouseholdAccess throws");
});

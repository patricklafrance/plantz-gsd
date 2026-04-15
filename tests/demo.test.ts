import { describe, it, expect } from "vitest";

describe("Demo mode", () => {
  describe("mutation guards", () => {
    it.todo("createPlant returns error when session.user.isDemo is true");
    it.todo("logWatering returns error when session.user.isDemo is true");
    it.todo("createNote returns error when session.user.isDemo is true");
    it.todo("snoozeReminder returns error when session.user.isDemo is true");
    it.todo("togglePlantReminder returns error when session.user.isDemo is true");
    it.todo("toggleGlobalReminders returns error when session.user.isDemo is true");
  });

  describe("seedStarterPlants", () => {
    it.todo("creates plants from STARTER_PLANTS CareProfile catalog entries");
    it.todo("creates Reminder records for each seeded plant");
    it.todo("rejects if user is a demo user");
  });

  describe("seed data constants", () => {
    it("DEMO_PLANTS has 8 entries", async () => {
      const { DEMO_PLANTS } = await import("@/features/demo/seed-data");
      expect(DEMO_PLANTS).toHaveLength(8);
    });

    it("STARTER_PLANTS has 5 entries", async () => {
      const { STARTER_PLANTS } = await import("@/features/demo/seed-data");
      expect(STARTER_PLANTS).toHaveLength(5);
    });

    it("DEMO_EMAIL is demo@plantminder.app", async () => {
      const { DEMO_EMAIL } = await import("@/features/demo/seed-data");
      expect(DEMO_EMAIL).toBe("demo@plantminder.app");
    });
  });
});

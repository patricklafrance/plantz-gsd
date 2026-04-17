import { expect, test, describe, vi, beforeEach } from "vitest";
import { addDays, subDays } from "date-fns";

// Mock Prisma client and db before any imports that reference them
vi.mock("@/generated/prisma/client", () => ({
  PrismaClient: vi.fn(),
}));

vi.mock("@prisma/adapter-pg", () => ({
  PrismaPg: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    plant: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    wateringLog: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Mock auth for Server Action tests
// actions.ts imports "../../../auth" which resolves to root auth.ts
// From tests/ directory, root auth.ts is "../auth"
vi.mock("../auth", () => ({
  auth: vi.fn(),
}));

// Mock revalidatePath for Server Action tests
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// ============================================================
// Schema validation tests
// ============================================================

describe("logWateringSchema", () => {
  test("accepts valid input with plantId only", async () => {
    const { logWateringSchema } = await import(
      "@/features/watering/schemas"
    );
    const result = logWateringSchema.safeParse({ householdId: "clxxxxxxxxxxxxxxxxxxxxxxxxx", plantId: "plant-1" });
    expect(result.success).toBe(true);
  });

  test("accepts valid input with plantId, past date, and note", async () => {
    const { logWateringSchema } = await import(
      "@/features/watering/schemas"
    );
    const yesterday = subDays(new Date(), 1);
    const result = logWateringSchema.safeParse({
      householdId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
      plantId: "plant-1",
      wateredAt: yesterday.toISOString(),
      note: "Used filtered water",
    });
    expect(result.success).toBe(true);
  });

  test("rejects empty plantId", async () => {
    const { logWateringSchema } = await import(
      "@/features/watering/schemas"
    );
    const result = logWateringSchema.safeParse({ plantId: "" });
    expect(result.success).toBe(false);
  });

  test("rejects note longer than 280 characters", async () => {
    const { logWateringSchema } = await import(
      "@/features/watering/schemas"
    );
    const result = logWateringSchema.safeParse({
      plantId: "plant-1",
      note: "x".repeat(281),
    });
    expect(result.success).toBe(false);
  });

  test("rejects future date", async () => {
    const { logWateringSchema } = await import(
      "@/features/watering/schemas"
    );
    const tomorrow = addDays(new Date(), 1);
    const result = logWateringSchema.safeParse({
      plantId: "plant-1",
      wateredAt: tomorrow.toISOString(),
    });
    expect(result.success).toBe(false);
  });
});

describe("editWateringLogSchema", () => {
  test("accepts valid input with logId and past date", async () => {
    const { editWateringLogSchema } = await import(
      "@/features/watering/schemas"
    );
    const yesterday = subDays(new Date(), 1);
    const result = editWateringLogSchema.safeParse({
      householdId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
      logId: "log-1",
      wateredAt: yesterday.toISOString(),
    });
    expect(result.success).toBe(true);
  });

  test("rejects empty logId", async () => {
    const { editWateringLogSchema } = await import(
      "@/features/watering/schemas"
    );
    const result = editWateringLogSchema.safeParse({
      logId: "",
      wateredAt: new Date().toISOString(),
    });
    expect(result.success).toBe(false);
  });

  test("rejects future date", async () => {
    const { editWateringLogSchema } = await import(
      "@/features/watering/schemas"
    );
    const tomorrow = addDays(new Date(), 1);
    const result = editWateringLogSchema.safeParse({
      logId: "log-1",
      wateredAt: tomorrow.toISOString(),
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================
// classifyAndSort tests (pure function — no DB mock needed)
// ============================================================

describe("classifyAndSort", () => {
  // Helper to create a mock plant matching the PlantWithIncludes shape
  function mockPlant(overrides: Record<string, unknown> = {}) {
    return {
      id: "p1",
      nickname: "Test Plant",
      species: null,
      roomId: null,
      room: null,
      userId: "u1",
      wateringInterval: 7,
      lastWateredAt: null,
      nextWateringAt: null,
      archivedAt: null,
      careProfileId: null,
      careProfile: null,
      wateringLogs: [],
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
      ...overrides,
    };
  }

  // Fixed reference dates for deterministic tests
  const todayStart = new Date("2026-04-14T00:00:00Z");
  const todayEnd = new Date("2026-04-14T23:59:59.999Z");

  test("classifies plant 3 days overdue as 'overdue' with daysUntil -3", async () => {
    const { classifyAndSort } = await import(
      "@/features/watering/queries"
    );
    const plant = mockPlant({
      id: "p-overdue",
      nextWateringAt: subDays(todayStart, 3), // 3 days ago
    });

    const result = classifyAndSort([plant as never], todayStart, todayEnd);
    expect(result.overdue).toHaveLength(1);
    expect(result.overdue[0].urgency).toBe("overdue");
    expect(result.overdue[0].daysUntil).toBe(-3);
  });

  test("classifies plant due today (within todayStart..todayEnd) as 'dueToday'", async () => {
    const { classifyAndSort } = await import(
      "@/features/watering/queries"
    );
    const plant = mockPlant({
      id: "p-today",
      nextWateringAt: new Date("2026-04-14T12:00:00Z"), // midday today
    });

    const result = classifyAndSort([plant as never], todayStart, todayEnd);
    expect(result.dueToday).toHaveLength(1);
    expect(result.dueToday[0].urgency).toBe("dueToday");
    expect(result.dueToday[0].daysUntil).toBe(0);
  });

  test("classifies plant due in 2 days as 'upcoming' with daysUntil 2", async () => {
    const { classifyAndSort } = await import(
      "@/features/watering/queries"
    );
    const plant = mockPlant({
      id: "p-upcoming",
      nextWateringAt: addDays(todayStart, 2),
    });

    const result = classifyAndSort([plant as never], todayStart, todayEnd);
    expect(result.upcoming).toHaveLength(1);
    expect(result.upcoming[0].urgency).toBe("upcoming");
    expect(result.upcoming[0].daysUntil).toBe(2);
  });

  test("classifies recently watered plant as 'recentlyWatered'", async () => {
    const { classifyAndSort } = await import(
      "@/features/watering/queries"
    );
    const plant = mockPlant({
      id: "p-recent",
      lastWateredAt: todayStart, // watered today
      nextWateringAt: addDays(todayStart, 7), // next in 7 days
    });

    const result = classifyAndSort([plant as never], todayStart, todayEnd);
    expect(result.recentlyWatered).toHaveLength(1);
    expect(result.recentlyWatered[0].urgency).toBe("recentlyWatered");
  });

  test("sorts overdue plants by most days late first (ascending daysUntil)", async () => {
    const { classifyAndSort } = await import(
      "@/features/watering/queries"
    );
    const plants = [
      mockPlant({
        id: "p1",
        nickname: "A",
        nextWateringAt: subDays(todayStart, 1), // 1 day overdue
      }),
      mockPlant({
        id: "p2",
        nickname: "B",
        nextWateringAt: subDays(todayStart, 5), // 5 days overdue
      }),
      mockPlant({
        id: "p3",
        nickname: "C",
        nextWateringAt: subDays(todayStart, 3), // 3 days overdue
      }),
    ];

    const result = classifyAndSort(plants as never[], todayStart, todayEnd);
    expect(result.overdue.map((p) => p.daysUntil)).toEqual([-5, -3, -1]);
  });

  test("sorts dueToday plants alphabetically by nickname", async () => {
    const { classifyAndSort } = await import(
      "@/features/watering/queries"
    );
    const plants = [
      mockPlant({
        id: "p1",
        nickname: "Zebra Plant",
        nextWateringAt: new Date("2026-04-14T08:00:00Z"),
      }),
      mockPlant({
        id: "p2",
        nickname: "Aloe Vera",
        nextWateringAt: new Date("2026-04-14T10:00:00Z"),
      }),
      mockPlant({
        id: "p3",
        nickname: "Monstera",
        nextWateringAt: new Date("2026-04-14T06:00:00Z"),
      }),
    ];

    const result = classifyAndSort(plants as never[], todayStart, todayEnd);
    expect(result.dueToday.map((p) => p.nickname)).toEqual([
      "Aloe Vera",
      "Monstera",
      "Zebra Plant",
    ]);
  });

  test("sorts upcoming plants by soonest due first", async () => {
    const { classifyAndSort } = await import(
      "@/features/watering/queries"
    );
    const plants = [
      mockPlant({
        id: "p1",
        nickname: "A",
        nextWateringAt: addDays(todayStart, 5),
      }),
      mockPlant({
        id: "p2",
        nickname: "B",
        nextWateringAt: addDays(todayStart, 1),
      }),
      mockPlant({
        id: "p3",
        nickname: "C",
        nextWateringAt: addDays(todayStart, 3),
      }),
    ];

    const result = classifyAndSort(plants as never[], todayStart, todayEnd);
    expect(result.upcoming.map((p) => p.daysUntil)).toEqual([1, 3, 5]);
  });

  test("timezone boundary: same plant classified differently for UTC+0 vs UTC-5", async () => {
    const { classifyAndSort } = await import(
      "@/features/watering/queries"
    );
    // Plant due at midnight UTC on April 14
    const plant = mockPlant({
      id: "p-tz",
      nextWateringAt: new Date("2026-04-14T00:00:00Z"),
    });

    // UTC+0 user: April 14 is today -> dueToday
    const utcTodayStart = new Date("2026-04-14T00:00:00Z");
    const utcTodayEnd = new Date("2026-04-14T23:59:59.999Z");
    const utcResult = classifyAndSort(
      [plant as never],
      utcTodayStart,
      utcTodayEnd
    );
    expect(utcResult.dueToday).toHaveLength(1);

    // UTC-5 user at 10pm on April 13: their "today" is April 13 UTC-5 = April 13 05:00Z to April 14 04:59Z
    const est13Start = new Date("2026-04-13T05:00:00Z");
    const est13End = new Date("2026-04-14T04:59:59.999Z");
    const estResult = classifyAndSort(
      [plant as never],
      est13Start,
      est13End
    );
    // Plant at midnight UTC is within the est13 "today" boundary (it's between 05:00Z Apr 13 and 05:00Z Apr 14)
    // So it should be dueToday for this user too, since midnight UTC falls within their "today"
    // Actually: midnight UTC = April 14 00:00Z. est13End = April 14 04:59Z. So yes it's within.
    // But for a user whose "today" is April 15 (UTC-5, their local date is April 15):
    const est15Start = new Date("2026-04-15T05:00:00Z");
    const est15End = new Date("2026-04-16T04:59:59.999Z");
    const est15Result = classifyAndSort(
      [plant as never],
      est15Start,
      est15End
    );
    // Plant due April 14 00:00Z, today is April 15 for user -> overdue
    expect(est15Result.overdue).toHaveLength(1);
    expect(est15Result.overdue[0].daysUntil).toBeLessThan(0);
  });

  test("upcoming plant watered within 48h is classified as recentlyWatered", async () => {
    const { classifyAndSort } = await import("@/features/watering/queries");
    const plant = mockPlant({
      id: "p-recent-upcoming",
      lastWateredAt: todayStart, // watered today (within 48h)
      nextWateringAt: addDays(todayStart, 5), // next in 5 days (would be "upcoming")
    });

    const result = classifyAndSort([plant as never], todayStart, todayEnd);
    expect(result.recentlyWatered).toHaveLength(1);
    expect(result.upcoming).toHaveLength(0);
    expect(result.recentlyWatered[0].urgency).toBe("recentlyWatered");
  });
});

// ============================================================
// addDays recalculation test
// ============================================================

describe("nextWateringAt recalculation", () => {
  test("addDays(wateredAt, interval) produces correct nextWateringAt", () => {
    const wateredAt = new Date("2026-04-10T14:30:00Z");
    const interval = 7;
    const expected = new Date("2026-04-17T14:30:00Z");
    const result = addDays(wateredAt, interval);
    expect(result.getTime()).toBe(expected.getTime());
  });
});

// ============================================================
// Server Action tests
// ============================================================

describe("Server Actions", () => {
  // Get mocked modules
  let db: Record<string, Record<string, ReturnType<typeof vi.fn>>>;
  let authMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();

    const dbModule = await import("@/lib/db");
    db = (dbModule as unknown as { db: typeof db }).db;

    const authModule = await import("../auth");
    authMock = (authModule as unknown as { auth: ReturnType<typeof vi.fn> }).auth;
  });

  describe("logWatering", () => {
    test("returns auth error when not authenticated", async () => {
      authMock.mockResolvedValue(null);

      const { logWatering } = await import("@/features/watering/actions");
      const result = await logWatering({ householdId: "clxxxxxxxxxxxxxxxxxxxxxxxxx", plantId: "p1" });
      expect(result).toEqual({ error: "Not authenticated." });
    });

    test("returns error for unowned plant", async () => {
      authMock.mockResolvedValue({ user: { id: "u1" } });
      db.plant.findFirst.mockResolvedValue(null);

      const { logWatering } = await import("@/features/watering/actions");
      const result = await logWatering({ householdId: "clxxxxxxxxxxxxxxxxxxxxxxxxx", plantId: "p1" });
      expect(result).toEqual({ error: "Plant not found." });
    });

    test("returns DUPLICATE when a log already exists for the same calendar date", async () => {
      authMock.mockResolvedValue({ user: { id: "u1" } });
      db.plant.findFirst.mockResolvedValue({
        id: "p1",
        userId: "u1",
        wateringInterval: 7,
        nickname: "Monstera",
      });
      // Simulate an existing log on the same day
      db.wateringLog.findFirst.mockResolvedValue({
        id: "log-existing",
        plantId: "p1",
        wateredAt: new Date(),
      });

      const { logWatering } = await import("@/features/watering/actions");
      const result = await logWatering({ householdId: "clxxxxxxxxxxxxxxxxxxxxxxxxx", plantId: "p1" });
      expect(result).toEqual({ error: "DUPLICATE" });
    });

    test("creates log and updates plant in transaction on success", async () => {
      authMock.mockResolvedValue({ user: { id: "u1" } });
      db.plant.findFirst.mockResolvedValue({
        id: "p1",
        userId: "u1",
        wateringInterval: 7,
        nickname: "Monstera",
      });
      // First call: duplicate check → null (no duplicate)
      // Second call: most recent log for recalculation → the newly created log
      const wateredAt = new Date();
      db.wateringLog.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: "wl-1", plantId: "p1", wateredAt, createdAt: wateredAt });
      db.wateringLog.create.mockResolvedValue({ id: "wl-1" });

      const { logWatering } = await import("@/features/watering/actions");
      const result = await logWatering({ householdId: "clxxxxxxxxxxxxxxxxxxxxxxxxx", plantId: "p1" });

      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("plantNickname", "Monstera");
      expect(result).toHaveProperty("nextWateringAt");
      expect(db.wateringLog.create).toHaveBeenCalledOnce();
      expect(db.plant.update).toHaveBeenCalledOnce();
    });

    test("uses custom past wateredAt for nextWateringAt calculation", async () => {
      authMock.mockResolvedValue({ user: { id: "u1" } });
      db.plant.findFirst.mockResolvedValue({
        id: "p1",
        userId: "u1",
        wateringInterval: 7,
        nickname: "Monstera",
      });
      const pastDate = new Date("2026-04-10T12:00:00Z");
      // First call: duplicate check → null; Second call: most recent log → the custom date log
      db.wateringLog.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: "wl-1", plantId: "p1", wateredAt: pastDate, createdAt: pastDate });
      db.wateringLog.create.mockResolvedValue({ id: "wl-1" });
      const expectedNext = addDays(pastDate, 7);

      const { logWatering } = await import("@/features/watering/actions");
      const result = await logWatering({
        householdId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
        plantId: "p1",
        wateredAt: pastDate.toISOString(),
      });

      expect(result).toHaveProperty("success", true);
      expect((result as { nextWateringAt: Date }).nextWateringAt.getTime()).toBe(
        expectedNext.getTime()
      );
    });

    test("retroactive log does not change nextWateringAt when a newer log exists", async () => {
      const yesterday = subDays(new Date(), 1);
      const threeDaysAgo = subDays(new Date(), 3);

      authMock.mockResolvedValue({ user: { id: "u1" } });
      db.plant.findFirst.mockResolvedValue({
        id: "p1",
        userId: "u1",
        wateringInterval: 7,
        nickname: "Monstera",
      });
      // Duplicate check: no duplicate for 3 days ago
      // Most recent log query: returns yesterday's log (newer than the retroactive one)
      db.wateringLog.findFirst
        .mockResolvedValueOnce(null) // duplicate check
        .mockResolvedValueOnce({ id: "wl-existing", plantId: "p1", wateredAt: yesterday }); // most recent
      db.wateringLog.create.mockResolvedValue({ id: "wl-new" });
      db.plant.update.mockResolvedValue({});

      const { logWatering } = await import("@/features/watering/actions");
      const result = await logWatering({
        householdId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
        plantId: "p1",
        wateredAt: threeDaysAgo.toISOString(),
      });

      expect(result).toHaveProperty("success", true);
      // nextWateringAt should be based on yesterday (the most recent log), NOT threeDaysAgo
      expect(db.plant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lastWateredAt: yesterday,
            nextWateringAt: addDays(yesterday, 7),
          }),
        })
      );
    });
  });

  describe("editWateringLog", () => {
    test("returns error for unowned log", async () => {
      authMock.mockResolvedValue({ user: { id: "u1" } });
      db.wateringLog.findFirst.mockResolvedValue(null);

      const { editWateringLog } = await import(
        "@/features/watering/actions"
      );
      const yesterday = subDays(new Date(), 1);
      const result = await editWateringLog({
        householdId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
        logId: "log-1",
        wateredAt: yesterday.toISOString(),
      });
      expect(result).toEqual({ error: "Log not found." });
    });

    test("updates log and recalculates nextWateringAt", async () => {
      authMock.mockResolvedValue({ user: { id: "u1" } });
      // First findFirst (ownership check) returns the log
      db.wateringLog.findFirst
        .mockResolvedValueOnce({
          id: "log-1",
          plantId: "p1",
          plant: { id: "p1", wateringInterval: 7 },
        })
        // Second findFirst (most recent log after update)
        .mockResolvedValueOnce({
          id: "log-1",
          wateredAt: new Date("2026-04-12T10:00:00Z"),
        });
      db.wateringLog.update.mockResolvedValue({});
      db.plant.update.mockResolvedValue({});

      const { editWateringLog } = await import(
        "@/features/watering/actions"
      );
      const yesterday = subDays(new Date(), 1);
      const result = await editWateringLog({
        householdId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
        logId: "log-1",
        wateredAt: yesterday.toISOString(),
      });

      expect(result).toEqual({ success: true });
      expect(db.wateringLog.update).toHaveBeenCalledOnce();
      expect(db.plant.update).toHaveBeenCalledOnce();
    });
  });

  describe("deleteWateringLog", () => {
    test("returns error for unowned log", async () => {
      authMock.mockResolvedValue({ user: { id: "u1" } });
      db.wateringLog.findFirst.mockResolvedValue(null);

      const { deleteWateringLog } = await import(
        "@/features/watering/actions"
      );
      const result = await deleteWateringLog("log-1");
      expect(result).toEqual({ error: "Log not found." });
    });

    test("resets nextWateringAt when no logs remain", async () => {
      authMock.mockResolvedValue({ user: { id: "u1" } });
      // First findFirst (ownership check)
      db.wateringLog.findFirst
        .mockResolvedValueOnce({
          id: "log-1",
          plantId: "p1",
          plant: { id: "p1", wateringInterval: 7 },
        })
        // Second findFirst (find most recent after delete) — no logs remain
        .mockResolvedValueOnce(null);
      db.wateringLog.delete.mockResolvedValue({});
      db.plant.update.mockResolvedValue({});

      const { deleteWateringLog } = await import(
        "@/features/watering/actions"
      );
      const result = await deleteWateringLog("log-1");

      expect(result).toEqual({ success: true });
      expect(db.plant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lastWateredAt: null,
          }),
        })
      );
    });

    test("recalculates from remaining logs after deletion", async () => {
      const remainingLogDate = new Date("2026-04-08T10:00:00Z");
      authMock.mockResolvedValue({ user: { id: "u1" } });
      db.wateringLog.findFirst
        .mockResolvedValueOnce({
          id: "log-2",
          plantId: "p1",
          plant: { id: "p1", wateringInterval: 7 },
        })
        .mockResolvedValueOnce({
          id: "log-1",
          wateredAt: remainingLogDate,
        });
      db.wateringLog.delete.mockResolvedValue({});
      db.plant.update.mockResolvedValue({});

      const { deleteWateringLog } = await import(
        "@/features/watering/actions"
      );
      const result = await deleteWateringLog("log-2");

      expect(result).toEqual({ success: true });
      expect(db.plant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lastWateredAt: remainingLogDate,
            nextWateringAt: addDays(remainingLogDate, 7),
          }),
        })
      );
    });
  });
});

describe("Phase 2 — watering queries honor householdId scope via nested plant (D-10, D-16)", () => {
  test("getWateringHistory uses plant: { householdId } nested filter", async () => {
    const { db } = await import("@/lib/db");
    vi.mocked(db.wateringLog.findMany).mockResolvedValueOnce([]);
    vi.mocked(db.wateringLog.count).mockResolvedValueOnce(0);
    const { getWateringHistory } = await import("@/features/watering/queries");
    await getWateringHistory("plant_1", "hh_TEST");
    expect(db.wateringLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          plantId: "plant_1",
          plant: expect.objectContaining({ householdId: "hh_TEST" }),
        }),
      })
    );
  });

  test("getWateringHistory count also applies plant: { householdId } filter", async () => {
    const { db } = await import("@/lib/db");
    vi.mocked(db.wateringLog.findMany).mockResolvedValueOnce([]);
    vi.mocked(db.wateringLog.count).mockResolvedValueOnce(0);
    const { getWateringHistory } = await import("@/features/watering/queries");
    await getWateringHistory("plant_1", "hh_TEST");
    expect(db.wateringLog.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          plant: expect.objectContaining({ householdId: "hh_TEST" }),
        }),
      })
    );
  });
});

describe("Phase 2 — watering actions reject non-members with ForbiddenError (D-17, Pitfall 16)", () => {
  test.todo("logWatering throws ForbiddenError when requireHouseholdAccess throws");
  test.todo("editWateringLog throws ForbiddenError when requireHouseholdAccess throws");
  test.todo("deleteWateringLog throws ForbiddenError when requireHouseholdAccess throws");
});

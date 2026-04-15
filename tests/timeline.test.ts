import { expect, test, describe, vi } from "vitest";

// Mock DB to prevent DATABASE_URL errors when importing queries module
vi.mock("@/generated/prisma/client", () => ({ PrismaClient: vi.fn() }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    wateringLog: { findMany: vi.fn(), count: vi.fn() },
    note: { findMany: vi.fn(), count: vi.fn() },
  },
}));

// Tests for the mergeTimeline pure function — no DB interaction needed.
// mergeTimeline is a pure utility exported from @/features/notes/queries.

describe("getTimeline merge and sort", () => {
  const wateringLogs = [
    {
      id: "w1",
      plantId: "p1",
      wateredAt: new Date("2026-04-14"),
      note: null,
      createdAt: new Date("2026-04-14"),
    },
    {
      id: "w2",
      plantId: "p1",
      wateredAt: new Date("2026-04-10"),
      note: "Filtered water",
      createdAt: new Date("2026-04-10"),
    },
  ];

  const notes = [
    {
      id: "n1",
      plantId: "p1",
      content: "Leaves looking great",
      createdAt: new Date("2026-04-12"),
      updatedAt: new Date("2026-04-12"),
    },
    {
      id: "n2",
      plantId: "p1",
      content: "Repotted",
      createdAt: new Date("2026-04-08"),
      updatedAt: new Date("2026-04-08"),
    },
  ];

  test("merges watering logs and notes into a single sorted array", async () => {
    const { mergeTimeline } = await import("@/features/notes/queries");
    const result = mergeTimeline(wateringLogs, notes, 0, 20);
    expect(result.total).toBe(4);
    expect(result.entries).toHaveLength(4);
    // Sorted descending: w1 (Apr 14), n1 (Apr 12), w2 (Apr 10), n2 (Apr 8)
    expect(result.entries[0].id).toBe("w1");
    expect(result.entries[1].id).toBe("n1");
    expect(result.entries[2].id).toBe("w2");
    expect(result.entries[3].id).toBe("n2");
  });

  test("respects skip and take for pagination (D-03)", async () => {
    const { mergeTimeline } = await import("@/features/notes/queries");
    // First page: skip=0, take=2 → first 2 entries
    const firstPage = mergeTimeline(wateringLogs, notes, 0, 2);
    expect(firstPage.entries).toHaveLength(2);
    expect(firstPage.entries[0].id).toBe("w1");
    expect(firstPage.entries[1].id).toBe("n1");
    expect(firstPage.total).toBe(4);

    // Second page: skip=2, take=2 → last 2 entries
    const secondPage = mergeTimeline(wateringLogs, notes, 2, 2);
    expect(secondPage.entries).toHaveLength(2);
    expect(secondPage.entries[0].id).toBe("w2");
    expect(secondPage.entries[1].id).toBe("n2");
    expect(secondPage.total).toBe(4);
  });

  test("returns correct total count across both types", async () => {
    const { mergeTimeline } = await import("@/features/notes/queries");
    const result = mergeTimeline(wateringLogs, notes, 0, 20);
    expect(result.total).toBe(wateringLogs.length + notes.length);
  });

  test("handles empty notes with only watering logs", async () => {
    const { mergeTimeline } = await import("@/features/notes/queries");
    const result = mergeTimeline(wateringLogs, [], 0, 20);
    expect(result.total).toBe(2);
    expect(result.entries).toHaveLength(2);
    expect(result.entries.every((e) => e.type === "watering")).toBe(true);
  });

  test("handles empty watering logs with only notes", async () => {
    const { mergeTimeline } = await import("@/features/notes/queries");
    const result = mergeTimeline([], notes, 0, 20);
    expect(result.total).toBe(2);
    expect(result.entries).toHaveLength(2);
    expect(result.entries.every((e) => e.type === "note")).toBe(true);
  });
});

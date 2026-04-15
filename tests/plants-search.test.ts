import { expect, test, describe, vi, beforeEach } from "vitest";

vi.mock("@/generated/prisma/client", () => ({ PrismaClient: vi.fn() }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    plant: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn() },
    $transaction: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getPlants with search", () => {
  test.todo("filters plants by nickname containing search term (SRCH-01)");
  test.todo("filters plants by species containing search term (SRCH-01)");
  test.todo("search is case-insensitive (D-09)");
});

describe("getPlants with status filter", () => {
  test.todo("status=overdue returns plants with nextWateringAt before todayStart (SRCH-02)");
  test.todo("status=due-today returns plants with nextWateringAt between todayStart and todayEnd (SRCH-02)");
  test.todo("status=upcoming returns plants with nextWateringAt after todayEnd (SRCH-02)");
  test.todo("status=archived returns only archived plants (SRCH-02)");
  test.todo("default (no status) excludes archived plants (SRCH-02)");
});

describe("getPlants with sort", () => {
  test.todo("sort=name returns plants sorted by nickname ascending (SRCH-03)");
  test.todo("sort=recently-added returns plants sorted by createdAt descending (SRCH-03)");
  test.todo("default sort is nextWateringAt ascending (SRCH-03)");
});

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
  test("filters plants by nickname containing search term (SRCH-01)", async () => {
    const { db } = await import("@/lib/db");
    const { getPlants } = await import("@/features/plants/queries");

    vi.mocked(db.plant.findMany).mockResolvedValue([]);

    await getPlants("user-1", { search: "monstera" });

    expect(db.plant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { nickname: { contains: "monstera", mode: "insensitive" } },
          ]),
        }),
      })
    );
  });

  test("filters plants by species containing search term (SRCH-01)", async () => {
    const { db } = await import("@/lib/db");
    const { getPlants } = await import("@/features/plants/queries");

    vi.mocked(db.plant.findMany).mockResolvedValue([]);

    await getPlants("user-1", { search: "deliciosa" });

    expect(db.plant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { species: { contains: "deliciosa", mode: "insensitive" } },
          ]),
        }),
      })
    );
  });

  test("search is case-insensitive (D-09)", async () => {
    const { db } = await import("@/lib/db");
    const { getPlants } = await import("@/features/plants/queries");

    vi.mocked(db.plant.findMany).mockResolvedValue([]);

    await getPlants("user-1", { search: "MONSTERA" });

    expect(db.plant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { nickname: { contains: "MONSTERA", mode: "insensitive" } },
            { species: { contains: "MONSTERA", mode: "insensitive" } },
          ],
        }),
      })
    );
  });
});

describe("getPlants with status filter", () => {
  const todayStart = new Date("2026-04-14T00:00:00.000Z");
  const todayEnd = new Date("2026-04-15T00:00:00.000Z");

  test("status=overdue returns plants with nextWateringAt before todayStart (SRCH-02)", async () => {
    const { db } = await import("@/lib/db");
    const { getPlants } = await import("@/features/plants/queries");

    vi.mocked(db.plant.findMany).mockResolvedValue([]);

    await getPlants("user-1", { status: "overdue", todayStart, todayEnd });

    expect(db.plant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          nextWateringAt: { lt: todayStart },
        }),
      })
    );
  });

  test("status=due-today returns plants with nextWateringAt between todayStart and todayEnd (SRCH-02)", async () => {
    const { db } = await import("@/lib/db");
    const { getPlants } = await import("@/features/plants/queries");

    vi.mocked(db.plant.findMany).mockResolvedValue([]);

    await getPlants("user-1", { status: "due-today", todayStart, todayEnd });

    expect(db.plant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          nextWateringAt: { gte: todayStart, lt: todayEnd },
        }),
      })
    );
  });

  test("status=upcoming returns plants with nextWateringAt after todayEnd (SRCH-02)", async () => {
    const { db } = await import("@/lib/db");
    const { getPlants } = await import("@/features/plants/queries");

    vi.mocked(db.plant.findMany).mockResolvedValue([]);

    await getPlants("user-1", { status: "upcoming", todayStart, todayEnd });

    expect(db.plant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          nextWateringAt: { gte: todayEnd },
        }),
      })
    );
  });

  test("status=archived returns only archived plants (SRCH-02)", async () => {
    const { db } = await import("@/lib/db");
    const { getPlants } = await import("@/features/plants/queries");

    vi.mocked(db.plant.findMany).mockResolvedValue([]);

    await getPlants("user-1", { status: "archived" });

    const call = vi.mocked(db.plant.findMany).mock.calls[0]?.[0];
    expect(call?.where).toMatchObject({ archivedAt: { not: null } });
    // Must NOT include archivedAt: null
    expect(call?.where).not.toMatchObject({ archivedAt: null });
  });

  test("default (no status) excludes archived plants (SRCH-02)", async () => {
    const { db } = await import("@/lib/db");
    const { getPlants } = await import("@/features/plants/queries");

    vi.mocked(db.plant.findMany).mockResolvedValue([]);

    await getPlants("user-1");

    expect(db.plant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          archivedAt: null,
        }),
      })
    );
  });
});

describe("getPlants with sort", () => {
  test("sort=name returns plants sorted by nickname ascending (SRCH-03)", async () => {
    const { db } = await import("@/lib/db");
    const { getPlants } = await import("@/features/plants/queries");

    vi.mocked(db.plant.findMany).mockResolvedValue([]);

    await getPlants("user-1", { sort: "name" });

    expect(db.plant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { nickname: "asc" },
      })
    );
  });

  test("sort=recently-added returns plants sorted by createdAt descending (SRCH-03)", async () => {
    const { db } = await import("@/lib/db");
    const { getPlants } = await import("@/features/plants/queries");

    vi.mocked(db.plant.findMany).mockResolvedValue([]);

    await getPlants("user-1", { sort: "recently-added" });

    expect(db.plant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: "desc" },
      })
    );
  });

  test("default sort is nextWateringAt ascending (SRCH-03)", async () => {
    const { db } = await import("@/lib/db");
    const { getPlants } = await import("@/features/plants/queries");

    vi.mocked(db.plant.findMany).mockResolvedValue([]);

    await getPlants("user-1");

    expect(db.plant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { nextWateringAt: "asc" },
      })
    );
  });
});

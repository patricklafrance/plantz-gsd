import { expect, test, describe, vi, beforeEach } from "vitest";

vi.mock("@/generated/prisma/client", () => ({ PrismaClient: vi.fn() }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    plant: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    room: {
      findMany: vi.fn(),
    },
    careProfile: {
      findMany: vi.fn(),
    },
    householdMember: {
      findFirst: vi.fn(),
    },
  },
}));
vi.mock("@/features/household/guards", async () => {
  const actual = await vi.importActual<typeof import("@/features/household/guards")>(
    "@/features/household/guards"
  );
  return {
    ...actual,
    requireHouseholdAccess: vi.fn(),
  };
});
vi.mock("../auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
});

// Schema validation tests (run immediately)
describe("plant schema validation", () => {
  test("createPlantSchema accepts valid plant data", async () => {
    const { createPlantSchema } = await import("@/features/plants/schemas");
    const result = createPlantSchema.safeParse({
      householdId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
      nickname: "My Pothos",
      species: "Epipremnum aureum",
      wateringInterval: 10,
    });
    expect(result.success).toBe(true);
  });

  test("createPlantSchema rejects empty nickname", async () => {
    const { createPlantSchema } = await import("@/features/plants/schemas");
    const result = createPlantSchema.safeParse({
      nickname: "",
      wateringInterval: 10,
    });
    expect(result.success).toBe(false);
  });

  test("createPlantSchema rejects interval outside 1-365 range", async () => {
    const { createPlantSchema } = await import("@/features/plants/schemas");
    const zeroResult = createPlantSchema.safeParse({
      nickname: "Test",
      wateringInterval: 0,
    });
    expect(zeroResult.success).toBe(false);

    const highResult = createPlantSchema.safeParse({
      nickname: "Test",
      wateringInterval: 400,
    });
    expect(highResult.success).toBe(false);
  });

  test("editPlantSchema requires id field", async () => {
    const { editPlantSchema } = await import("@/features/plants/schemas");
    const result = editPlantSchema.safeParse({
      nickname: "Updated",
      wateringInterval: 7,
    });
    expect(result.success).toBe(false);
  });
});

// Server Action stubs (Phase 3 Plan 02 will implement these)
describe("createPlant action (PLNT-01, PLNT-07, PLNT-08)", () => {
  test.todo("creates a plant for authenticated user with valid data");
  test.todo("returns error if user is not authenticated");
  test.todo("revalidates /plants and /dashboard paths after creation");
  test.todo("links careProfileId when creating from catalog selection");
  test.todo("creates plant without careProfileId for custom entry");
});

describe("updatePlant action (PLNT-02)", () => {
  test.todo("updates plant fields for the owning user");
  test.todo("returns error if plant does not belong to user");
  test.todo("revalidates /plants and /dashboard paths after update");
});

describe("archivePlant action (PLNT-03)", () => {
  test.todo("sets archivedAt timestamp on the plant");
  test.todo("returns error if plant does not belong to user");
});

describe("unarchivePlant action (PLNT-03 undo)", () => {
  test.todo("clears archivedAt timestamp on the plant");
});

describe("deletePlant action (PLNT-04)", () => {
  test.todo("permanently deletes plant and cascades to watering logs");
  test.todo("returns error if plant does not belong to user");
  test.todo("revalidates /plants and /dashboard paths after deletion");
});

describe("plant queries (PLNT-05, PLNT-06)", () => {
  test.todo("getPlants returns only non-archived plants for the user");
  test.todo("getPlant returns single plant with room and careProfile relations");
  test.todo("getCatalog returns all CareProfile entries");
});

describe("Phase 2 — plants queries honor householdId scope (D-10, D-16)", () => {
  test("getPlants includes householdId in findMany where clause", async () => {
    const { db } = await import("@/lib/db");
    vi.mocked(db.plant.findMany).mockResolvedValueOnce([]);
    vi.mocked(db.plant.count).mockResolvedValueOnce(0);
    const { getPlants } = await import("@/features/plants/queries");
    await getPlants("hh_TEST");
    expect(db.plant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ householdId: "hh_TEST" }),
      })
    );
  });

  test("getPlants count includes householdId in where clause", async () => {
    const { db } = await import("@/lib/db");
    vi.mocked(db.plant.findMany).mockResolvedValueOnce([]);
    vi.mocked(db.plant.count).mockResolvedValueOnce(0);
    const { getPlants } = await import("@/features/plants/queries");
    await getPlants("hh_TEST");
    expect(db.plant.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ householdId: "hh_TEST" }),
      })
    );
  });

  test("getPlant filters by plantId AND householdId", async () => {
    const { db } = await import("@/lib/db");
    vi.mocked(db.plant.findFirst).mockResolvedValueOnce(null);
    const { getPlant } = await import("@/features/plants/queries");
    await getPlant("plant_1", "hh_TEST");
    expect(db.plant.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "plant_1", householdId: "hh_TEST" }),
      })
    );
  });

  test("getRoomsForSelect filters by householdId", async () => {
    const { db } = await import("@/lib/db");
    vi.mocked(db.room.findMany).mockResolvedValueOnce([]);
    const { getRoomsForSelect } = await import("@/features/rooms/queries");
    await getRoomsForSelect("hh_TEST");
    expect(db.room.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ householdId: "hh_TEST" }),
      })
    );
  });
});

describe("Phase 2 — plants actions reject non-members with ForbiddenError (D-17, Pitfall 16)", () => {
  test.todo("createPlant throws ForbiddenError when requireHouseholdAccess throws");
  test.todo("updatePlant throws ForbiddenError when requireHouseholdAccess throws");
  test.todo("archivePlant throws ForbiddenError when requireHouseholdAccess throws");
  test.todo("unarchivePlant throws ForbiddenError when requireHouseholdAccess throws");
  test.todo("deletePlant throws ForbiddenError when requireHouseholdAccess throws");
});

describe("Plan 05a — plantTargetSchema (D-12 blob payload for archive/unarchive/delete)", () => {
  test("plantTargetSchema accepts valid householdId + plantId", async () => {
    const { plantTargetSchema } = await import("@/features/plants/schemas");
    const result = plantTargetSchema.safeParse({
      householdId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
      plantId: "plt_abc",
    });
    expect(result.success).toBe(true);
  });

  test("plantTargetSchema rejects missing householdId", async () => {
    const { plantTargetSchema } = await import("@/features/plants/schemas");
    const result = plantTargetSchema.safeParse({ plantId: "plt_abc" });
    expect(result.success).toBe(false);
  });

  test("plantTargetSchema rejects empty plantId", async () => {
    const { plantTargetSchema } = await import("@/features/plants/schemas");
    const result = plantTargetSchema.safeParse({
      householdId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
      plantId: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("Plan 05a — plants actions use householdId scope (D-12, Pitfall 16)", () => {
  const HOUSEHOLD_ID = "clxxxxxxxxxxxxxxxxxxxxxxxxx";
  const mockHousehold = { id: HOUSEHOLD_ID, name: "Test Household", slug: "test" };

  test("archivePlant calls requireHouseholdAccess with householdId from payload", async () => {
    const { auth } = await import("../auth");
    const { requireHouseholdAccess } = await import("@/features/household/guards");
    const { db } = await import("@/lib/db");

    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "user_1", isDemo: false },
    } as Awaited<ReturnType<typeof auth>>);
    vi.mocked(requireHouseholdAccess).mockResolvedValueOnce({
      household: mockHousehold,
      member: { id: "m1", householdId: HOUSEHOLD_ID, userId: "user_1", role: "OWNER", isDefault: true, rotationOrder: 0, createdAt: new Date() },
      role: "OWNER",
    } as never);
    vi.mocked(db.plant.findFirst).mockResolvedValueOnce({
      id: "plt_1", nickname: "Pothos", archivedAt: null,
    } as never);
    vi.mocked(db.plant.update).mockResolvedValueOnce({} as never);

    const { archivePlant } = await import("@/features/plants/actions");
    const result = await archivePlant({ householdId: HOUSEHOLD_ID, plantId: "plt_1" });

    expect(requireHouseholdAccess).toHaveBeenCalledWith(HOUSEHOLD_ID);
    expect(result).toMatchObject({ success: true });
  });

  test("archivePlant returns error when plant not found in household scope", async () => {
    const { auth } = await import("../auth");
    const { requireHouseholdAccess } = await import("@/features/household/guards");
    const { db } = await import("@/lib/db");

    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "user_1", isDemo: false },
    } as Awaited<ReturnType<typeof auth>>);
    vi.mocked(requireHouseholdAccess).mockResolvedValueOnce({
      household: mockHousehold,
      member: {} as never,
      role: "OWNER",
    } as never);
    vi.mocked(db.plant.findFirst).mockResolvedValueOnce(null);

    const { archivePlant } = await import("@/features/plants/actions");
    const result = await archivePlant({ householdId: HOUSEHOLD_ID, plantId: "plt_unknown" });

    expect(result).toMatchObject({ error: "Plant not found." });
  });
});

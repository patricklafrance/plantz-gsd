import { expect, test, describe } from "vitest";

// Schema validation tests (run immediately)
describe("plant schema validation", () => {
  test("createPlantSchema accepts valid plant data", async () => {
    const { createPlantSchema } = await import("@/features/plants/schemas");
    const result = createPlantSchema.safeParse({
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

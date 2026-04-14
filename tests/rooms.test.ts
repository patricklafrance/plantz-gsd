import { expect, test, describe } from "vitest";

// Schema validation tests (run immediately)
describe("room schema validation", () => {
  test("createRoomSchema accepts valid room name", async () => {
    const { createRoomSchema } = await import("@/features/rooms/schemas");
    const result = createRoomSchema.safeParse({ name: "Living Room" });
    expect(result.success).toBe(true);
  });

  test("createRoomSchema rejects empty name", async () => {
    const { createRoomSchema } = await import("@/features/rooms/schemas");
    const result = createRoomSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  test("createRoomSchema rejects name over 50 characters", async () => {
    const { createRoomSchema } = await import("@/features/rooms/schemas");
    const result = createRoomSchema.safeParse({ name: "A".repeat(51) });
    expect(result.success).toBe(false);
  });

  test("editRoomSchema requires id field", async () => {
    const { editRoomSchema } = await import("@/features/rooms/schemas");
    const result = editRoomSchema.safeParse({ name: "Updated Room" });
    expect(result.success).toBe(false);
  });
});

// Server Action stubs (Phase 3 Plan 02 will implement these)
describe("createRoom action (ROOM-01, ROOM-02)", () => {
  test.todo("creates a room for authenticated user");
  test.todo("returns error if user is not authenticated");
  test.todo("revalidates /rooms and /plants paths after creation");
});

describe("updateRoom action (ROOM-01)", () => {
  test.todo("updates room name for the owning user");
  test.todo("returns error if room does not belong to user");
});

describe("deleteRoom action (ROOM-01)", () => {
  test.todo("deletes room and unassigns plants (sets roomId to null)");
  test.todo("returns error if room does not belong to user");
  test.todo("revalidates /rooms and /plants paths after deletion");
});

describe("room queries (ROOM-04, ROOM-05)", () => {
  test.todo("getRooms returns all rooms for the user with plant counts");
  test.todo("getRoom returns single room with its plants");
});

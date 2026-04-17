import { expect, test, describe, vi, beforeEach } from "vitest";

vi.mock("@/generated/prisma/client", () => ({ PrismaClient: vi.fn() }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    room: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    householdMember: {
      findFirst: vi.fn(),
    },
  },
}));
vi.mock("../auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/household/guards", async () => {
  const actual = await vi.importActual<typeof import("@/features/household/guards")>(
    "@/features/household/guards"
  );
  return {
    ...actual,
    requireHouseholdAccess: vi.fn(),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

// Schema validation tests (run immediately)
describe("room schema validation", () => {
  test("createRoomSchema accepts valid room name", async () => {
    const { createRoomSchema } = await import("@/features/rooms/schemas");
    const result = createRoomSchema.safeParse({ householdId: "clxxxxxxxxxxxxxxxxxxxxxxxxx", name: "Living Room" });
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

describe("Phase 2 — rooms queries honor householdId scope (D-10, D-16)", () => {
  test("getRooms includes householdId in findMany where clause", async () => {
    const { db } = await import("@/lib/db");
    vi.mocked(db.room.findMany).mockResolvedValueOnce([]);
    const { getRooms } = await import("@/features/rooms/queries");
    await getRooms("hh_TEST");
    expect(db.room.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ householdId: "hh_TEST" }) })
    );
  });

  test("getRoom filters by roomId AND householdId", async () => {
    const { db } = await import("@/lib/db");
    vi.mocked(db.room.findFirst).mockResolvedValueOnce(null);
    const { getRoom } = await import("@/features/rooms/queries");
    await getRoom("room_1", "hh_TEST");
    expect(db.room.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "room_1", householdId: "hh_TEST" }),
      })
    );
  });
});

describe("Phase 2 — rooms actions reject non-members with ForbiddenError (D-17, Pitfall 16)", () => {
  test.todo("createRoom throws ForbiddenError when requireHouseholdAccess throws");
  test.todo("updateRoom throws ForbiddenError when requireHouseholdAccess throws");
  test.todo("deleteRoom throws ForbiddenError when requireHouseholdAccess throws");
});

describe("Plan 05a — roomTargetSchema (D-12 blob payload for deleteRoom)", () => {
  test("roomTargetSchema accepts valid householdId + roomId", async () => {
    const { roomTargetSchema } = await import("@/features/rooms/schemas");
    const result = roomTargetSchema.safeParse({
      householdId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
      roomId: "room_abc",
    });
    expect(result.success).toBe(true);
  });

  test("roomTargetSchema rejects missing householdId", async () => {
    const { roomTargetSchema } = await import("@/features/rooms/schemas");
    const result = roomTargetSchema.safeParse({ roomId: "room_abc" });
    expect(result.success).toBe(false);
  });

  test("roomTargetSchema rejects empty roomId", async () => {
    const { roomTargetSchema } = await import("@/features/rooms/schemas");
    const result = roomTargetSchema.safeParse({
      householdId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
      roomId: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("Plan 05a — rooms actions use householdId scope (D-12, Pitfall 16)", () => {
  const HOUSEHOLD_ID = "clxxxxxxxxxxxxxxxxxxxxxxxxx";
  const mockHousehold = { id: HOUSEHOLD_ID, name: "Test Household", slug: "test" };

  test("deleteRoom calls requireHouseholdAccess with householdId from payload", async () => {
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
    vi.mocked(db.room.findFirst).mockResolvedValueOnce({
      id: "room_1",
      name: "Living Room",
      _count: { plants: 0 },
    } as never);
    vi.mocked(db.room.delete).mockResolvedValueOnce({} as never);

    const { deleteRoom } = await import("@/features/rooms/actions");
    const result = await deleteRoom({ householdId: HOUSEHOLD_ID, roomId: "room_1" });

    expect(requireHouseholdAccess).toHaveBeenCalledWith(HOUSEHOLD_ID);
    expect(result).toMatchObject({ success: true, hadPlants: false });
  });

  test("createRoom wires createdByUserId audit column", async () => {
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
    vi.mocked(db.room.create).mockResolvedValueOnce({ id: "room_new" } as never);

    const { createRoom } = await import("@/features/rooms/actions");
    await createRoom({ householdId: HOUSEHOLD_ID, name: "Kitchen" });

    expect(db.room.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          createdByUserId: "user_1",
          householdId: HOUSEHOLD_ID,
        }),
      })
    );
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/generated/prisma/client", () => ({ PrismaClient: vi.fn() }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    plant: { count: vi.fn(), findMany: vi.fn() },
    cycle: { findFirst: vi.fn() },
  },
}));
vi.mock("@/features/household/queries", () => ({
  getCurrentCycle: vi.fn(),
}));

const { db } = await import("@/lib/db");
const { getCurrentCycle } = await import("@/features/household/queries");
const { getReminderCount, getReminderItems } = await import(
  "@/features/reminders/queries"
);

beforeEach(() => {
  vi.clearAllMocks();
});

const HH_ID = "hh_1";
const ASSIGNEE_ID = "user_A";
const OTHER_ID = "user_B";
const TODAY_START = new Date("2026-04-19T00:00:00Z");
const TODAY_END = new Date("2026-04-20T00:00:00Z");

function mockActiveCycleAssignedTo(assignedUserId: string | null) {
  vi.mocked(getCurrentCycle).mockResolvedValue({
    id: "cycle_1",
    householdId: HH_ID,
    status: "active",
    assignedUserId,
  } as never);
}

function mockPausedCycle() {
  vi.mocked(getCurrentCycle).mockResolvedValue({
    id: "cycle_1",
    householdId: HH_ID,
    status: "paused",
    assignedUserId: ASSIGNEE_ID,
  } as never);
}

function mockNoCycle() {
  vi.mocked(getCurrentCycle).mockResolvedValue(null);
}

describe("getReminderCount — assignee gate (HNTF-01 / D-08, D-09, D-10)", () => {
  it("HNTF-01 active cycle, viewer IS assignee → plant.count called, returns non-zero", async () => {
    mockActiveCycleAssignedTo(ASSIGNEE_ID);
    vi.mocked(db.plant.count)
      .mockResolvedValueOnce(3) // overdue
      .mockResolvedValueOnce(2); // dueToday

    const result = await getReminderCount(HH_ID, ASSIGNEE_ID, TODAY_START, TODAY_END);

    expect(db.plant.count).toHaveBeenCalled();
    expect(result).toBe(5);
  });

  it("HNTF-01 active cycle, viewer is NOT assignee → plant.count NOT called, returns 0", async () => {
    mockActiveCycleAssignedTo(ASSIGNEE_ID);
    vi.mocked(db.plant.count).mockResolvedValue(999);

    const result = await getReminderCount(HH_ID, OTHER_ID, TODAY_START, TODAY_END);

    expect(db.plant.count).not.toHaveBeenCalled();
    expect(result).toBe(0);
  });

  it("HNTF-01 paused cycle → plant.count called for ALL viewers (D-09 fallback)", async () => {
    mockPausedCycle();
    vi.mocked(db.plant.count)
      .mockResolvedValueOnce(1) // overdue
      .mockResolvedValueOnce(4); // dueToday

    const result = await getReminderCount(HH_ID, OTHER_ID, TODAY_START, TODAY_END);

    expect(db.plant.count).toHaveBeenCalled();
    expect(result).toBe(5);
  });

  it("HNTF-01 no active cycle (null) → returns 0 without calling plant.count (D-10)", async () => {
    mockNoCycle();
    vi.mocked(db.plant.count).mockResolvedValue(999);

    const result = await getReminderCount(HH_ID, ASSIGNEE_ID, TODAY_START, TODAY_END);

    expect(db.plant.count).not.toHaveBeenCalled();
    expect(result).toBe(0);
  });
});

describe("getReminderItems — assignee gate (HNTF-01 / D-08, D-09, D-10)", () => {
  it("HNTF-01 active cycle, viewer IS assignee → plant.findMany called, returns items", async () => {
    mockActiveCycleAssignedTo(ASSIGNEE_ID);
    vi.mocked(db.plant.findMany)
      .mockResolvedValueOnce([
        {
          id: "p1",
          nickname: "Fern",
          nextWateringAt: new Date("2026-04-17T00:00:00Z"),
          room: { name: "Living" },
        },
      ] as never)
      .mockResolvedValueOnce([]);

    const result = await getReminderItems(HH_ID, ASSIGNEE_ID, TODAY_START, TODAY_END);

    expect(db.plant.findMany).toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0].nickname).toBe("Fern");
  });

  it("HNTF-01 active cycle, viewer is NOT assignee → plant.findMany NOT called, returns []", async () => {
    mockActiveCycleAssignedTo(ASSIGNEE_ID);
    vi.mocked(db.plant.findMany).mockResolvedValue([
      { id: "p1", nickname: "Fern" } as never,
    ]);

    const result = await getReminderItems(HH_ID, OTHER_ID, TODAY_START, TODAY_END);

    expect(db.plant.findMany).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it("HNTF-01 paused cycle → plant.findMany called for ALL viewers", async () => {
    mockPausedCycle();
    vi.mocked(db.plant.findMany)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "p2",
          nickname: "Cactus",
          nextWateringAt: TODAY_START,
          room: null,
        },
      ] as never);

    const result = await getReminderItems(HH_ID, OTHER_ID, TODAY_START, TODAY_END);

    expect(db.plant.findMany).toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0].statusLabel).toBe("Due today");
  });

  it("HNTF-01 no active cycle (null) → returns [] without calling plant.findMany", async () => {
    mockNoCycle();
    vi.mocked(db.plant.findMany).mockResolvedValue([{ id: "p1" } as never]);

    const result = await getReminderItems(HH_ID, ASSIGNEE_ID, TODAY_START, TODAY_END);

    expect(db.plant.findMany).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });
});

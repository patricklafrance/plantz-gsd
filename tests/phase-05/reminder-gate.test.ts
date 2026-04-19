import { describe, it, vi, beforeEach } from "vitest";

vi.mock("@/generated/prisma/client", () => ({ PrismaClient: vi.fn() }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    plant: { count: vi.fn(), findMany: vi.fn() },
    cycle: { findFirst: vi.fn() },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getReminderCount — assignee gate (HNTF-01 / D-08, D-09, D-10)", () => {
  it.todo(
    "HNTF-01 active cycle, viewer IS assignee → plant.count called, returns non-zero",
  );
  it.todo(
    "HNTF-01 active cycle, viewer is NOT assignee → plant.count NOT called, returns 0",
  );
  it.todo(
    "HNTF-01 paused cycle → plant.count called for ALL viewers (D-09 fallback)",
  );
  it.todo(
    "HNTF-01 no active cycle (null) → returns 0 without calling plant.count (D-10)",
  );
});

describe("getReminderItems — assignee gate (HNTF-01 / D-08, D-09, D-10)", () => {
  it.todo(
    "HNTF-01 active cycle, viewer IS assignee → plant.findMany called, returns items",
  );
  it.todo(
    "HNTF-01 active cycle, viewer is NOT assignee → plant.findMany NOT called, returns []",
  );
  it.todo(
    "HNTF-01 paused cycle → plant.findMany called for ALL viewers",
  );
  it.todo(
    "HNTF-01 no active cycle (null) → returns [] without calling plant.findMany",
  );
});

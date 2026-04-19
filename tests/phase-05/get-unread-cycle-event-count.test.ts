import { describe, it, vi, beforeEach } from "vitest";

vi.mock("@/generated/prisma/client", () => ({ PrismaClient: vi.fn() }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: { householdNotification: { count: vi.fn() } },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getUnreadCycleEventCount (D-28)", () => {
  it.todo(
    "HNTF-01 returns count with where { householdId, recipientUserId, readAt: null, cycle: { status: 'active' } }",
  );
  it.todo("HNTF-01 returns 0 when user has no unread rows");
});

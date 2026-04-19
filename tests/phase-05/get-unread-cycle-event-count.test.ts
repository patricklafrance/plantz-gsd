import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/generated/prisma/client", () => ({ PrismaClient: vi.fn() }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: { householdNotification: { count: vi.fn() } },
}));

const { db } = await import("@/lib/db");
const { getUnreadCycleEventCount } = await import(
  "@/features/household/queries"
);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getUnreadCycleEventCount (D-28)", () => {
  it("HNTF-01 returns count with where { householdId, recipientUserId, readAt: null, cycle: { status: 'active' } }", async () => {
    vi.mocked(db.householdNotification.count).mockResolvedValue(3);

    const result = await getUnreadCycleEventCount("hh_1", "user_A");

    expect(db.householdNotification.count).toHaveBeenCalledWith({
      where: {
        householdId: "hh_1",
        recipientUserId: "user_A",
        readAt: null,
        cycle: { status: "active" },
      },
    });
    expect(result).toBe(3);
  });

  it("HNTF-01 returns 0 when user has no unread rows", async () => {
    vi.mocked(db.householdNotification.count).mockResolvedValue(0);

    const result = await getUnreadCycleEventCount("hh_1", "user_A");

    expect(result).toBe(0);
  });
});

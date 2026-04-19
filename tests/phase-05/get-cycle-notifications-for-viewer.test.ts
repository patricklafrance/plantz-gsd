import { describe, it, vi, beforeEach } from "vitest";

vi.mock("@/generated/prisma/client", () => ({ PrismaClient: vi.fn() }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: { householdNotification: { findMany: vi.fn() } },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getCycleNotificationsForViewer (D-29)", () => {
  it.todo(
    "HNTF-02 returns findMany result with where { householdId, recipientUserId, cycleId } + cycle/household/members include",
  );
  it.todo("HNTF-03 orders by createdAt desc");
  it.todo(
    "HNTF-02 filters to only the given cycleId (previous-cycle rows excluded — D-06 derivational clearing)",
  );
});

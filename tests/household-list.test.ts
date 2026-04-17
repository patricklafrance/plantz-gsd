import { expect, test, describe, vi, beforeEach } from "vitest";

vi.mock("@/generated/prisma/client", () => ({ PrismaClient: vi.fn() }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    householdMember: { findMany: vi.fn() },
  },
}));

beforeEach(() => { vi.clearAllMocks(); });

describe("getUserHouseholds (HSLD-03, D-08)", () => {
  test.todo("returns { household, role, isDefault, joinedAt } array sorted by joinedAt asc");
  test.todo("returns empty array when user has no memberships");
  test.todo("includes both OWNER and MEMBER memberships with correct role field");
});

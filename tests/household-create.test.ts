import { expect, test, describe, vi, beforeEach } from "vitest";

vi.mock("@/generated/prisma/client", () => ({ PrismaClient: vi.fn() }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    household: { findUnique: vi.fn(), create: vi.fn() },
    householdMember: { create: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("../auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

beforeEach(() => { vi.clearAllMocks(); });

describe("createHousehold (HSLD-02, D-06)", () => {
  test.todo("creates Household + OWNER HouseholdMember in a single $transaction");
  test.todo("generateHouseholdSlug collision loop is bounded at 10 attempts");
  test.todo("rejects when no session (returns { error: 'Not authenticated.' })");
  test.todo("rejects when session.user.isDemo (returns demo-mode error)");
  test.todo("new membership row has isDefault: false (secondary household)");
});

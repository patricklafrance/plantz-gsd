import { expect, test, describe, vi, beforeEach } from "vitest";

// Wave 0 stub — every case `test.todo` keyed to ROTA-01 / D-11.

vi.mock("@/generated/prisma/client", () => ({ PrismaClient: vi.fn() }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    householdMember: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));
vi.mock("../../auth", () => ({ auth: vi.fn(), unstable_update: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/features/household/guards", () => {
  class ForbiddenError extends Error {
    readonly name = "ForbiddenError" as const;
    readonly statusCode = 403 as const;
    constructor(message = "Access denied") {
      super(message);
      Object.setPrototypeOf(this, ForbiddenError.prototype);
    }
  }
  return { ForbiddenError, requireHouseholdAccess: vi.fn() };
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("reorderRotation (ROTA-01 / D-11)", () => {
  test.todo("ROTA-01 happy path: updateMany-per-row writes rotationOrder matching input array index");
  test.todo("ROTA-01 members changed (length mismatch): throws MEMBERS_CHANGED then error Member list changed - reload and try again.");
  test.todo("ROTA-01 members changed (set mismatch): tx.findMany returns different user-id set then error");
  test.todo("ROTA-01 non-OWNER: returns error Only household owners can reorder the rotation.");
  test.todo("ROTA-01 demo mode: returns error without touching DB");
  test.todo("ROTA-01 invalid input: empty array rejected by Zod nonempty() then error");
  test.todo("ROTA-01 revalidatePath called for settings + dashboard");
});

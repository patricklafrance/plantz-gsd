import { expect, test, describe, vi, beforeEach } from "vitest";

// NOTE: This is a Wave 0 stub file — every case is `test.todo(...)` keyed to a
// requirement id (HSET-02 / D-06). Wave 1 (Plan 02) replaces each todo with a
// real `test(...)` by grep-and-replace per STATE.md handoff policy.

vi.mock("@/generated/prisma/client", () => ({ PrismaClient: vi.fn() }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    householdMember: {
      updateMany: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
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

describe("setDefaultHousehold (HSET-02 / D-06)", () => {
  test.todo("HSET-02 happy path: clears prior default then sets new default atomically");
  test.todo("HSET-02 non-member: requireHouseholdAccess throws ForbiddenError then error");
  test.todo("HSET-02 demo mode: returns error without touching DB");
  test.todo("HSET-02 invalid input: Zod safeParse failure then error Invalid input.");
  test.todo("HSET-02 revalidatePath called for settings + dashboard");
});

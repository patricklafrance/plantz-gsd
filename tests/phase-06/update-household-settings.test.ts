import { expect, test, describe, vi, beforeEach } from "vitest";

// Wave 0 stub — every case `test.todo` keyed to HSET-03 / D-13.

vi.mock("@/generated/prisma/client", () => ({ PrismaClient: vi.fn() }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    household: { update: vi.fn() },
    cycle: { update: vi.fn() }, // must NOT be called — Pitfall 3
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

describe("updateHouseholdSettings (HSET-03 / D-13)", () => {
  test.todo("HSET-03 happy path: all three fields written to household row");
  test.todo("HSET-03 non-OWNER: access.role is not OWNER then error Only household owners can edit settings.");
  test.todo("HSET-03 invalid cycleDuration: Zod enum rejects values outside 1/3/7/14");
  test.todo("HSET-03 preserves active cycle: db.cycle.update is NOT called (Pitfall 3)");
  test.todo("HSET-03 demo mode: returns error without touching DB");
  test.todo("HSET-03 invalid timezone: Intl.DateTimeFormat pre-check returns user-friendly error (defense-in-depth per RESEARCH Open Question 1)");
  test.todo("HSET-03 revalidatePath called for settings + dashboard");
});

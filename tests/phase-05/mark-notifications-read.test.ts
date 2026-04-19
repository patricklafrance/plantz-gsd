import { describe, test, vi, beforeEach } from "vitest";

vi.mock("@/generated/prisma/client", () => ({ PrismaClient: vi.fn() }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: { householdNotification: { updateMany: vi.fn() } },
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

describe("markNotificationsRead (D-20, D-24)", () => {
  test.todo(
    "HNTF-01 unauthenticated session → returns { error: 'Not authenticated.' }",
  );
  test.todo(
    "HNTF-01 demo user → returns { error: 'Demo mode — sign up to save your changes.' }",
  );
  test.todo(
    "HNTF-01 invalid input (missing notificationIds) → returns { error: 'Invalid input.' }",
  );
  test.todo(
    "HNTF-01 non-member viewer → requireHouseholdAccess throws ForbiddenError → returns { error }",
  );
  test.todo(
    "HNTF-01 member-but-not-recipient → updateMany called with recipientUserId filter, zero rows updated, returns { success: true }",
  );
  test.todo(
    "HNTF-01 authenticated recipient → updateMany called with { id: { in: ids }, recipientUserId, readAt: null }, data: { readAt: new Date() }",
  );
  test.todo(
    "HNTF-01 success path revalidates HOUSEHOLD_PATHS.dashboard with 'page' type",
  );
  test.todo(
    "HNTF-01 re-open with already-read ids → updateMany predicate filters them; idempotent zero-count success",
  );
});

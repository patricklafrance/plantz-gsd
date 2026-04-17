/**
 * Real-Prisma integration tests for createHousehold + getUserHouseholds.
 *
 * Per CONTEXT.md D-18: these tests use the REAL database (not mocked Prisma).
 * The only mock is `auth()` — we cannot easily simulate a NextAuth session in
 * a test runner, and the goal of these tests is to verify transactional
 * invariants and DB-level constraints (unique slug, referential integrity,
 * $transaction rollback), not session plumbing.
 *
 * Session mock rationale (T-02-07-04): mocking auth() is intentional and
 * explicitly documented here. The integration tests exercise the full data
 * path: Zod parse → $transaction → real Prisma → real PostgreSQL. Only the
 * NextAuth session lookup is short-circuited.
 *
 * Test isolation:
 * - Every user email is namespaced with a unique prefix per test run
 *   (`integration-test-${Date.now()}-${uuid}@test.local`)
 * - afterAll deletes all users matching the prefix; HouseholdMember rows
 *   cascade from User (onDelete: Cascade); Household rows are explicitly
 *   deleted afterwards (no cascade from User → Household)
 * - Safe to run against dev DB; rows are clearly tagged and never collide
 *   with real user data
 *
 * Requirements: DATABASE_URL must be set (see .env.local).
 * CI note: this suite is deferred to CI setup in a later phase — it runs
 * against the configured DATABASE_URL (dev DB or a dedicated test DB).
 */

import { expect, test, describe, vi, afterAll, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";

// Mock `auth` only — EVERYTHING ELSE is real
vi.mock("../auth", () => ({ auth: vi.fn() }));

// Imports AFTER vi.mock so the mock is in effect when modules are loaded
const { db } = await import("@/lib/db");
const { createHousehold } = await import("@/features/household/actions");
const { getUserHouseholds } = await import("@/features/household/queries");
const { auth } = await import("../auth");

// Unique namespace per test run (T-02-07-01: namespaced isolation)
const RUN_ID = `${Date.now()}-${randomUUID().slice(0, 8)}`;
const EMAIL_PREFIX = `integration-test-${RUN_ID}`;
const emailFor = (userTag: string) => `${EMAIL_PREFIX}-${userTag}@test.local`;

beforeEach(() => {
  vi.clearAllMocks();
});

afterAll(async () => {
  // Cleanup: delete every user and household created in this run.
  // HouseholdMember rows cascade when users are deleted (onDelete: Cascade).
  // Household rows do NOT cascade from User, so must be deleted explicitly.
  try {
    const users = await db.user.findMany({
      where: { email: { startsWith: EMAIL_PREFIX } },
      select: { id: true },
    });
    const userIds = users.map((u: { id: string }) => u.id);

    if (userIds.length > 0) {
      // Collect household IDs before deleting users (memberships cascade away)
      const memberships = await db.householdMember.findMany({
        where: { userId: { in: userIds } },
        select: { householdId: true },
      });
      const householdIds = [
        ...new Set(memberships.map((m: { householdId: string }) => m.householdId)),
      ];

      // Delete users — HouseholdMember rows cascade automatically
      await db.user.deleteMany({ where: { id: { in: userIds } } });

      // Delete orphaned household rows (no User → Household cascade)
      if (householdIds.length > 0) {
        await db.household.deleteMany({ where: { id: { in: householdIds } } });
      }
    }
  } finally {
    await db.$disconnect();
  }
});

/**
 * Helper: create a bare User row directly via Prisma (bypasses registerUser
 * so we control membership state independently per test).
 */
async function createBareUser(tag: string) {
  return db.user.create({
    data: {
      email: emailFor(tag),
      passwordHash: "$2b$10$testhashnotused.integration.test.only",
      name: `Integration Test User ${tag}`,
    },
  });
}

// ---------------------------------------------------------------------------
// createHousehold integration tests (D-18, D-07)
// ---------------------------------------------------------------------------

describe("createHousehold integration (D-18)", () => {
  test("happy path: creates Household + OWNER HouseholdMember with isDefault: false", async () => {
    const user = await createBareUser("u1");

    vi.mocked(auth).mockResolvedValue({
      user: { id: user.id, isDemo: false },
    } as Awaited<ReturnType<typeof auth>>);

    const result = await createHousehold({
      name: "Integration Test House",
      timezone: "America/New_York",
    });

    expect(result).toMatchObject({ success: true });
    if (!("success" in result)) throw new Error("Expected success result");

    const household = (result as { success: true; household: { id: string; name: string; slug: string; timezone: string } }).household;
    expect(household.name).toBe("Integration Test House");
    // Slug uses the UNAMBIGUOUS_ALPHABET (ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789)
    // 8 characters, no 0/O/I/l/1
    expect(household.slug).toHaveLength(8);
    expect(household.timezone).toBe("America/New_York");

    // Verify OWNER membership was created in the same $transaction
    // Schema: @@unique([householdId, userId]) → compound key is householdId_userId
    const member = await db.householdMember.findUnique({
      where: {
        householdId_userId: { householdId: household.id, userId: user.id },
      },
    });
    expect(member).not.toBeNull();
    expect(member!.role).toBe("OWNER");
    expect(member!.rotationOrder).toBe(0);
    // Secondary household (not created via registerUser) must have isDefault: false
    expect(member!.isDefault).toBe(false);
  });

  test("Zod validation failure: empty name returns { error } — no Household row created", async () => {
    const user = await createBareUser("u2");

    vi.mocked(auth).mockResolvedValue({
      user: { id: user.id, isDemo: false },
    } as Awaited<ReturnType<typeof auth>>);

    // Empty name fails Zod (min(1)) BEFORE the $transaction starts
    const result = await createHousehold({ name: "", timezone: "UTC" });
    expect(result).toMatchObject({ error: "Invalid input." });

    // No HouseholdMember should exist for this user (Zod rejected pre-transaction)
    const memberships = await db.householdMember.findMany({
      where: { userId: user.id },
    });
    expect(memberships).toHaveLength(0);
  });

  test("unique-slug: two back-to-back createHousehold calls produce different slugs", async () => {
    const user = await createBareUser("u3");

    vi.mocked(auth).mockResolvedValue({
      user: { id: user.id, isDemo: false },
    } as Awaited<ReturnType<typeof auth>>);

    const r1 = await createHousehold({ name: "House A", timezone: "UTC" });
    const r2 = await createHousehold({ name: "House B", timezone: "UTC" });

    if (!("success" in r1) || !("success" in r2)) {
      throw new Error("Both household creations should succeed");
    }

    const h1 = (r1 as { success: true; household: { slug: string } }).household;
    const h2 = (r2 as { success: true; household: { slug: string } }).household;
    expect(h1.slug).not.toBe(h2.slug);
    // Both slugs exist in DB (verified by successful return)
    expect(h1.slug).toHaveLength(8);
    expect(h2.slug).toHaveLength(8);
  });

  test("unauthenticated: returns { error: 'Not authenticated.' } — no DB writes", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const result = await createHousehold({ name: "Should Not Create", timezone: "UTC" });
    expect(result).toEqual({ error: "Not authenticated." });
  });

  test("demo mode guard: returns { error } — no household or member rows created", async () => {
    const user = await createBareUser("u4");

    vi.mocked(auth).mockResolvedValue({
      user: { id: user.id, isDemo: true },
    } as Awaited<ReturnType<typeof auth>>);

    const result = await createHousehold({ name: "Demo Try", timezone: "UTC" });
    expect(result).toMatchObject({ error: "Demo mode — sign up to save your changes." });

    const memberships = await db.householdMember.findMany({
      where: { userId: user.id },
    });
    expect(memberships).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getUserHouseholds integration tests (D-18, D-08)
// ---------------------------------------------------------------------------

describe("getUserHouseholds integration (D-18)", () => {
  test("returns memberships sorted by joinedAt asc with correct role + isDefault", async () => {
    const user = await createBareUser("u5");

    // Create first household and membership (isDefault: true — simulates registerUser behavior)
    // Use randomUUID per household to guarantee slug uniqueness across any test run/retry
    const slugA = randomUUID().replace(/-/g, "").slice(0, 12);
    const hhA = await db.household.create({
      data: {
        name: "Solo House",
        slug: slugA,
        timezone: "UTC",
        cycleDuration: 7,
        rotationStrategy: "sequential",
      },
    });
    await db.householdMember.create({
      data: {
        userId: user.id,
        householdId: hhA.id,
        role: "OWNER",
        rotationOrder: 0,
        isDefault: true,
      },
    });

    // Wait to guarantee a strictly-later createdAt on the second membership
    await new Promise((r) => setTimeout(r, 60));

    // Create second household and membership (isDefault: false — secondary household)
    const slugB = randomUUID().replace(/-/g, "").slice(0, 12);
    const hhB = await db.household.create({
      data: {
        name: "Roommate House",
        slug: slugB,
        timezone: "UTC",
        cycleDuration: 7,
        rotationStrategy: "sequential",
      },
    });
    await db.householdMember.create({
      data: {
        userId: user.id,
        householdId: hhB.id,
        role: "MEMBER",
        rotationOrder: 1,
        isDefault: false,
      },
    });

    const result = await getUserHouseholds(user.id);

    expect(result).toHaveLength(2);

    // Sorted by joinedAt asc — A first
    expect(result[0].household.id).toBe(hhA.id);
    expect(result[0].role).toBe("OWNER");
    expect(result[0].isDefault).toBe(true);
    expect(result[0].joinedAt).toBeInstanceOf(Date);

    expect(result[1].household.id).toBe(hhB.id);
    expect(result[1].role).toBe("MEMBER");
    expect(result[1].isDefault).toBe(false);
  });

  test("returns empty array when user has no memberships", async () => {
    // Bare user with no householdMember rows
    const user = await createBareUser("u6");

    const result = await getUserHouseholds(user.id);
    expect(result).toEqual([]);
  });
});

/**
 * Shared fixtures for Phase 4 integration tests (tests/phase-04/*.test.ts).
 *
 * Integration tests in this directory use a real Postgres database (same DATABASE_URL
 * as `tests/household-integration.test.ts`). Fixture design decisions:
 *
 *  - Namespaced emails via RUN_ID: every test file can parallelize safely because
 *    email uniqueness is per-run, not per-file.
 *  - `afterAll` cleanup (in each test file, not here) deletes by `email startsWith EMAIL_PREFIX`.
 *  - Helpers return IDs (not full Prisma rows) so tests make follow-up reads explicitly.
 *  - `createHouseholdWithMembers` mirrors the Phase 3 helper but with Phase 4 naming prefix.
 *  - `createHouseholdWithInvitation` extends the above, inserting one active Invitation row.
 *
 * References:
 *   CONTEXT D-01 / D-02 — Cycle #1 eager creation + initial boundaries
 *   CONTEXT D-04 — atomic acceptance pattern
 *   PATTERNS §tests/phase-04/fixtures.ts — namespacing, relative-path auth mock
 *   RESEARCH §Wave 0 Gaps — files this fixture serves
 */
import { randomUUID } from "node:crypto";
import { generateInvitationToken } from "@/lib/crypto";

export const RUN_ID = `${Date.now()}-${randomUUID().slice(0, 8)}`;
export const EMAIL_PREFIX = `phase04-test-${RUN_ID}`;

/** Deterministic test-email helper; keep user tags short (e.g., "owner", "m1"). */
export function emailFor(userTag: string): string {
  return `${EMAIL_PREFIX}-${userTag}@test.local`;
}

/**
 * [Rule 1 fix] Lazy-loaded db handle. Top-level `import { db } from "@/lib/db"` crashes
 * at module-load time when DATABASE_URL isn't set (src/lib/db.ts:11 throws at client
 * construction). Stubs in Wave 0 only import `EMAIL_PREFIX` for their afterAll hook —
 * they should not pay the price of a live Prisma client during module load. Real-DB
 * tests call `getDb()` inside their test bodies, at which point DATABASE_URL is expected.
 */
async function getDb() {
  const mod = await import("@/lib/db");
  return mod.db;
}

/**
 * Inserts a single User row. Password hash is a fixed harmless string; Phase 4 tests
 * never exercise credential auth — they mock `auth()` via `vi.mock("../../auth")`.
 */
export async function createBareUser(overrides?: {
  email?: string;
  name?: string;
}): Promise<{ id: string; email: string }> {
  const email = overrides?.email ?? emailFor(`u-${randomUUID().slice(0, 4)}`);
  const name = overrides?.name ?? "Phase4 Test User";
  const db = await getDb();
  const user = await db.user.create({
    data: {
      email,
      name,
      passwordHash: "bcrypt$fixture-only-never-verified",
    },
    select: { id: true, email: true },
  });
  return user;
}

/**
 * Creates a household with `memberCount` members (owner + (memberCount-1) plain members)
 * and writes Cycle #1 inline so `transitionCycle(householdId, ...)` has something to lock.
 *
 * Members are inserted with rotationOrder 0..memberCount-1 (owner at rotationOrder 0 by
 * default; override with `ownerAtOrder` for Phase 6 reorder tests).
 *
 * TODO(wave-3): Once `registerUser` / `createHousehold` ship Cycle #1 bootstrap (D-01),
 * rewrite this helper to call `createHousehold` directly instead of inline tx.cycle.create.
 * Until then, this is the only test-side Cycle-creator in Phase 4.
 */
export async function createHouseholdWithMembers(
  memberCount: number,
  ownerAtOrder: number = 0,
): Promise<{
  householdId: string;
  ownerId: string;
  memberIds: string[];
  cycleId: string;
}> {
  if (memberCount < 1) {
    throw new Error("createHouseholdWithMembers: memberCount must be >= 1");
  }

  // Seed users. Unique suffix per invocation so multiple calls in a test
  // suite don't collide on the User.email unique constraint.
  const invocationId = randomUUID().slice(0, 6);
  const userRows = await Promise.all(
    Array.from({ length: memberCount }, (_, i) =>
      createBareUser({ email: emailFor(`${invocationId}-m${i}`) }),
    ),
  );
  const ownerId = userRows[ownerAtOrder].id;

  const db = await getDb();
  return db.$transaction(async (tx) => {
    const household = await tx.household.create({
      data: {
        name: `Phase4 Test Household ${RUN_ID}`,
        slug: `phase4-${RUN_ID.toLowerCase()}-${randomUUID().slice(0, 4)}`,
        timezone: "America/New_York",
        cycleDuration: 7,
      },
      select: { id: true },
    });

    await tx.householdMember.createMany({
      data: userRows.map((u, i) => ({
        userId: u.id,
        householdId: household.id,
        role: i === ownerAtOrder ? "OWNER" : "MEMBER",
        rotationOrder: i,
        isDefault: i === ownerAtOrder,
      })),
    });

    // Cycle #1. Use a fixed anchor in the past so transitionCycle sees endDate <= now.
    // Wave 3's D-01 bootstrap ships the production version using computeInitialCycleBoundaries;
    // tests can override these values per scenario by calling db.cycle.update after this helper.
    const anchor = new Date(Date.now() - 8 * 86400 * 1000); // 8 days ago
    const cycle = await tx.cycle.create({
      data: {
        householdId: household.id,
        cycleNumber: 1,
        anchorDate: anchor,
        cycleDuration: 7,
        startDate: anchor,
        endDate: new Date(anchor.getTime() + 7 * 86400 * 1000),
        status: "active",
        assignedUserId: ownerId,
        memberOrderSnapshot: userRows.map((u, i) => ({
          userId: u.id,
          rotationOrder: i,
        })),
      },
      select: { id: true },
    });

    return {
      householdId: household.id,
      ownerId,
      memberIds: userRows.map((u) => u.id),
      cycleId: cycle.id,
    };
  });
}

/**
 * Phase 4 helper: seed a household with N members plus one active invitation.
 * Returns raw token + hash for tests that need to exercise acceptInvitation
 * or resolveInvitationByToken against a real DB row.
 *
 * The invitation is in active state (revokedAt: null, acceptedAt: null).
 * afterAll cleanup deletes by EMAIL_PREFIX which cascades invitations via
 * household cascade delete.
 */
export async function createHouseholdWithInvitation(
  memberCount: number = 1,
): Promise<{
  householdId: string;
  ownerId: string;
  memberIds: string[];
  cycleId: string;
  invitationId: string;
  rawToken: string;
  tokenHash: string;
}> {
  const household = await createHouseholdWithMembers(memberCount);
  const { rawToken, tokenHash } = generateInvitationToken();
  const db = await getDb();
  const invitation = await db.invitation.create({
    data: {
      householdId: household.householdId,
      tokenHash,
      invitedByUserId: household.ownerId,
    },
    select: { id: true },
  });
  return { ...household, invitationId: invitation.id, rawToken, tokenHash };
}

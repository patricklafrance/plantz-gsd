// One-shot destructive helper for Phase 3 UAT regression.
//
// Context: Plan 02 D-01 Option B deleted 9 cycle-less households but left
// their owning User rows orphaned (zero HouseholdMember rows). Post-deletion
// these users can authenticate but every main-area route bounces them to
// /login?error=no_household with no escape (no standalone new-household
// route exists pre-Phase-06). Surfaced by Phase 3 UAT Test 1.
//
// This script deletes User rows with zero memberships. Matches Plan 02's
// "dev DB is disposable" rationale. Not intended for production.
//
// Safety rails:
//   - Drift guard: EXPECTED_COUNT pinned to 9. Abort if counts differ.
//   - Single $transaction with re-verify inside txn.
//   - Explicit id list — never a subquery delete.
//   - Cascades on User FKs (accounts/sessions/reminders/etc.) clean up.
//
// Run: npx tsx scripts/delete-orphaned-users.ts

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const EXPECTED_COUNT = 9;

async function main() {
  const { db } = await import("../src/lib/db");

  // -------- Step 1: fresh inventory --------
  const snapshot = await db.$queryRaw<
    Array<{ id: string; email: string; createdAt: Date }>
  >`
    SELECT u.id, u.email, u."createdAt"
    FROM "User" u
    LEFT JOIN "HouseholdMember" hm ON hm."userId" = u.id
    WHERE hm.id IS NULL
    ORDER BY u."createdAt";
  `;

  console.log("=== Pre-delete inventory (orphaned users) ===");
  console.log(`Count: ${snapshot.length}`);
  console.log(JSON.stringify(snapshot, null, 2));

  if (snapshot.length !== EXPECTED_COUNT) {
    console.error(
      `\nABORT: expected ${EXPECTED_COUNT} orphaned users, found ${snapshot.length}.` +
        ` Drift detected — refusing to delete. Re-plan before proceeding.`,
    );
    await db.$disconnect();
    process.exit(2);
  }

  const targetIds = snapshot.map((u) => u.id);

  // -------- Step 2: before counts --------
  const beforeCount = await db.user.count();
  console.log(`\n=== BEFORE user count: ${beforeCount} ===`);

  // -------- Step 3: atomic re-verify + delete --------
  const deleteResult = await db.$transaction(async (tx) => {
    const reverify = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT u.id
      FROM "User" u
      LEFT JOIN "HouseholdMember" hm ON hm."userId" = u.id
      WHERE hm.id IS NULL;
    `;
    const reverifyIds = reverify.map((r) => r.id).sort();
    const snapshotIdsSorted = [...targetIds].sort();

    const setsMatch =
      reverifyIds.length === snapshotIdsSorted.length &&
      reverifyIds.every((id, i) => id === snapshotIdsSorted[i]);

    if (!setsMatch) {
      throw new Error(
        `ABORT (inside txn): orphaned-user set drifted between outer snapshot and txn re-verify.\n` +
          `Outer: ${JSON.stringify(snapshotIdsSorted)}\n` +
          `Inner: ${JSON.stringify(reverifyIds)}`,
      );
    }

    console.log(
      `\n=== Re-verify inside txn passed (${reverifyIds.length} ids match) ===`,
    );

    const deleted = await tx.user.deleteMany({
      where: { id: { in: targetIds } },
    });

    console.log(
      `\n=== deleteMany result: ${deleted.count} users deleted ===`,
    );
    return deleted.count;
  });

  // -------- Step 4: after counts --------
  const afterCount = await db.user.count();
  console.log(`\n=== AFTER user count: ${afterCount} (delta ${afterCount - beforeCount}) ===`);

  // -------- Step 5: post-delete re-inventory --------
  const postCheck = await db.$queryRaw<Array<{ id: string }>>`
    SELECT u.id
    FROM "User" u
    LEFT JOIN "HouseholdMember" hm ON hm."userId" = u.id
    WHERE hm.id IS NULL;
  `;
  console.log(
    `\n=== Post-delete orphaned-user inventory count: ${postCheck.length} (expected 0) ===`,
  );

  await db.$disconnect();

  if (postCheck.length !== 0) {
    console.error("FAIL: orphaned users still exist after delete.");
    process.exit(3);
  }

  console.log(`\nOK: deleted ${deleteResult} orphaned users cleanly.`);
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});

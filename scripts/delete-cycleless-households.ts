// One-shot destructive helper for Phase 3 Wave 1 (plan 03-02).
//
// Purpose: resolve D-01 (pre-Phase-3 cycle-less households) via Option B —
// delete the 9 pre-existing cycle-less households so the schema-only migration
// is safe to apply. User approved Option B explicitly; dev DB is disposable.
//
// Safety rails (enforced here):
//   - Resolve the cycle-less household ids FRESH at script start.
//   - Drift guard: if count != EXPECTED_COUNT, abort before delete.
//   - Everything runs inside a single $transaction. If the pre-delete
//     re-verify inside the transaction disagrees with the outer snapshot,
//     abort.
//   - Delete uses an explicit id list (not a LEFT JOIN filter) so newly
//     created cycle-less households during runtime are never scooped.
//   - Cascades on Household FKs (members/rooms/plants/availability/
//     invitations/cycles/notifications) clean everything else up.
//
// Run: npx tsx scripts/delete-cycleless-households.ts

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const EXPECTED_COUNT = 9;

async function main() {
  const { db } = await import("../src/lib/db");

  // -------- Step 1: fresh inventory (outside txn, for logging) --------
  const snapshot = await db.$queryRaw<
    Array<{
      id: string;
      slug: string;
      timezone: string;
      cycleDuration: number;
      ownerUserId: string | null;
    }>
  >`
    SELECT
      h.id,
      h.slug,
      h.timezone,
      h."cycleDuration",
      hm."userId" AS "ownerUserId"
    FROM "Household" h
    LEFT JOIN "Cycle" c ON c."householdId" = h.id AND c."cycleNumber" = 1
    LEFT JOIN "HouseholdMember" hm ON hm."householdId" = h.id AND hm.role = 'OWNER'
    WHERE c.id IS NULL
    ORDER BY h.slug;
  `;

  console.log("=== Pre-delete inventory (cycle-less households) ===");
  console.log(`Count: ${snapshot.length}`);
  console.log(JSON.stringify(snapshot, null, 2));

  if (snapshot.length !== EXPECTED_COUNT) {
    console.error(
      `\nABORT: expected ${EXPECTED_COUNT} cycle-less households, found ${snapshot.length}.` +
        ` Drift detected — refusing to delete. Re-plan before proceeding.`
    );
    await db.$disconnect();
    process.exit(2);
  }

  const targetIds = snapshot.map((h) => h.id);
  console.log(`\nTarget household ids (${targetIds.length}):`);
  console.log(targetIds);

  // -------- Step 2: before counts --------
  const beforeCounts = await db.$transaction([
    db.household.count(),
    db.householdMember.count(),
    db.room.count(),
    db.plant.count(),
    db.availability.count(),
    db.invitation.count(),
  ]);
  console.log("\n=== BEFORE counts ===");
  console.log({
    households: beforeCounts[0],
    householdMembers: beforeCounts[1],
    rooms: beforeCounts[2],
    plants: beforeCounts[3],
    availability: beforeCounts[4],
    invitations: beforeCounts[5],
  });

  // -------- Step 3: atomic re-verify + delete --------
  const deleteResult = await db.$transaction(async (tx) => {
    const reverify = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT h.id
      FROM "Household" h
      LEFT JOIN "Cycle" c ON c."householdId" = h.id AND c."cycleNumber" = 1
      WHERE c.id IS NULL;
    `;
    const reverifyIds = reverify.map((r) => r.id).sort();
    const snapshotIdsSorted = [...targetIds].sort();

    const setsMatch =
      reverifyIds.length === snapshotIdsSorted.length &&
      reverifyIds.every((id, i) => id === snapshotIdsSorted[i]);

    if (!setsMatch) {
      throw new Error(
        `ABORT (inside txn): cycle-less household set drifted between outer snapshot and txn re-verify.\n` +
          `Outer: ${JSON.stringify(snapshotIdsSorted)}\n` +
          `Inner: ${JSON.stringify(reverifyIds)}`
      );
    }

    console.log(
      `\n=== Re-verify inside txn passed (${reverifyIds.length} ids match) ===`
    );

    // Explicit id list — NEVER a LEFT JOIN delete filter.
    const deleted = await tx.household.deleteMany({
      where: { id: { in: targetIds } },
    });

    console.log(
      `\n=== deleteMany result: ${deleted.count} households deleted ===`
    );
    return deleted.count;
  });

  // -------- Step 4: after counts --------
  const afterCounts = await db.$transaction([
    db.household.count(),
    db.householdMember.count(),
    db.room.count(),
    db.plant.count(),
    db.availability.count(),
    db.invitation.count(),
  ]);
  console.log("\n=== AFTER counts ===");
  console.log({
    households: afterCounts[0],
    householdMembers: afterCounts[1],
    rooms: afterCounts[2],
    plants: afterCounts[3],
    availability: afterCounts[4],
    invitations: afterCounts[5],
  });

  console.log("\n=== Delta ===");
  console.log({
    households: afterCounts[0] - beforeCounts[0],
    householdMembers: afterCounts[1] - beforeCounts[1],
    rooms: afterCounts[2] - beforeCounts[2],
    plants: afterCounts[3] - beforeCounts[3],
    availability: afterCounts[4] - beforeCounts[4],
    invitations: afterCounts[5] - beforeCounts[5],
  });

  // -------- Step 5: post-delete inventory must be empty --------
  const postCheck = await db.$queryRaw<Array<{ id: string }>>`
    SELECT h.id
    FROM "Household" h
    LEFT JOIN "Cycle" c ON c."householdId" = h.id AND c."cycleNumber" = 1
    WHERE c.id IS NULL;
  `;
  console.log(
    `\n=== Post-delete cycle-less inventory count: ${postCheck.length} (expected 0) ===`
  );

  await db.$disconnect();

  if (postCheck.length !== 0) {
    console.error("FAIL: cycle-less households still exist after delete.");
    process.exit(3);
  }

  console.log(`\nOK: deleted ${deleteResult} cycle-less households cleanly.`);
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});

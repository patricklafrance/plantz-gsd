// One-shot inventory: list households that lack a Cycle #1 row, with
// the data the backfill needs (timezone, cycleDuration, owner userId).
// Run: npx tsx scripts/inventory-cycleless-households.ts

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

async function main() {
  const { db } = await import("../src/lib/db");
  const rows = await db.$queryRaw<
    Array<{
      id: string;
      slug: string;
      timezone: string;
      cycleDuration: number;
      ownerUserId: string | null;
      ownerRotationOrder: number | null;
    }>
  >`
    SELECT
      h.id,
      h.slug,
      h.timezone,
      h."cycleDuration",
      hm."userId" AS "ownerUserId",
      hm."rotationOrder" AS "ownerRotationOrder"
    FROM "Household" h
    LEFT JOIN "Cycle" c ON c."householdId" = h.id AND c."cycleNumber" = 1
    LEFT JOIN "HouseholdMember" hm ON hm."householdId" = h.id AND hm.role = 'OWNER'
    WHERE c.id IS NULL;
  `;
  console.log(`Cycle-less households: ${rows.length}`);
  console.log(JSON.stringify(rows, null, 2));
  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

// One-shot: re-sync Prisma's _prisma_migrations checksum for a migration
// whose file was edited after apply. Avoids the nuclear `migrate reset`.
//
// Prisma's checksum is SHA-256 of the migration.sql file contents, hex-encoded.
// If the DB checksum matches the file checksum, `migrate dev` will proceed.
//
// Run: npx tsx scripts/resync-migration-checksum.ts <migration_name>

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { createHash } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";

async function main() {
  const migrationName = process.argv[2];
  if (!migrationName) {
    console.error("Usage: npx tsx scripts/resync-migration-checksum.ts <migration_name>");
    process.exit(1);
  }

  const sqlPath = join(
    process.cwd(),
    "prisma",
    "migrations",
    migrationName,
    "migration.sql"
  );
  const sql = readFileSync(sqlPath);
  const fileChecksum = createHash("sha256").update(sql).digest("hex");

  const { db } = await import("../src/lib/db");

  const rows = await db.$queryRaw<
    Array<{ id: string; migration_name: string; checksum: string; applied_steps_count: number }>
  >`
    SELECT id, migration_name, checksum, applied_steps_count
    FROM "_prisma_migrations"
    WHERE migration_name = ${migrationName};
  `;

  if (rows.length === 0) {
    console.error(`No _prisma_migrations row found for ${migrationName}`);
    await db.$disconnect();
    process.exit(2);
  }

  const row = rows[0];
  console.log(`Found migration row:`);
  console.log(`  id: ${row.id}`);
  console.log(`  migration_name: ${row.migration_name}`);
  console.log(`  DB checksum:   ${row.checksum}`);
  console.log(`  File checksum: ${fileChecksum}`);
  console.log(`  applied_steps: ${row.applied_steps_count}`);

  if (row.checksum === fileChecksum) {
    console.log("\nAlready in sync — no update needed.");
    await db.$disconnect();
    return;
  }

  console.log("\nUpdating checksum...");
  await db.$executeRaw`
    UPDATE "_prisma_migrations"
    SET checksum = ${fileChecksum}
    WHERE migration_name = ${migrationName};
  `;
  console.log("OK: checksum re-synced.");
  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

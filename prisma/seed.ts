import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma";
import pg from "pg";
import { catalogData } from "./data/catalog";

const pool = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding care catalog...");

  for (const entry of catalogData) {
    await db.careProfile.upsert({
      where: { name: entry.name },
      update: {
        species: entry.species,
        wateringInterval: entry.wateringInterval,
        lightRequirement: entry.lightRequirement,
        notes: entry.notes,
      },
      create: {
        name: entry.name,
        species: entry.species,
        wateringInterval: entry.wateringInterval,
        lightRequirement: entry.lightRequirement,
        notes: entry.notes,
      },
    });
  }

  console.log(`Seeded ${catalogData.length} catalog entries.`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

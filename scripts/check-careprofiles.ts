import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

async function main() {
  const count = await db.careProfile.count();
  const sample = await db.careProfile.findMany({ take: 5, select: { name: true, species: true, wateringInterval: true } });
  console.log("CareProfile total:", count);
  console.log("Sample:", sample);
}

main().catch(console.error).finally(() => db.$disconnect());

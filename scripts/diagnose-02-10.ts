import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

async function main() {
  const email = process.argv[2];
  const phase = process.argv[3] ?? "before";
  if (!email) {
    console.error("Usage: tsx scripts/diagnose-02-10.ts <email> [before|after]");
    process.exit(1);
  }
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, email: true, createdAt: true },
  });
  if (!user) {
    console.log("User not found:", email);
    process.exit(0);
  }
  const hm = await db.householdMember.findFirst({
    where: { userId: user.id },
    select: { householdId: true, role: true, isDefault: true, household: { select: { slug: true } } },
  });
  if (!hm) {
    console.log("NO HouseholdMember for user:", user.id);
    process.exit(0);
  }
  const plantCount = await db.plant.count({ where: { householdId: hm.householdId } });
  console.log(phase.toUpperCase(), {
    userId: user.id,
    email: user.email,
    householdId: hm.householdId,
    slug: hm.household.slug,
    role: hm.role,
    isDefault: hm.isDefault,
    plantCount,
    householdMemberVisible: true,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });

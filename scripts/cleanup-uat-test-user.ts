import "dotenv/config";
import { db } from "../src/lib/db";

async function main() {
  const users = await db.user.findMany({
    where: { email: { startsWith: "uat-" } },
    select: { id: true, email: true },
  });

  for (const u of users) {
    const memberships = await db.householdMember.findMany({
      where: { userId: u.id },
      select: { householdId: true, role: true },
    });

    for (const m of memberships) {
      if (m.role === "OWNER") {
        const otherMembers = await db.householdMember.count({
          where: { householdId: m.householdId, userId: { not: u.id } },
        });
        if (otherMembers === 0) {
          await db.household.delete({ where: { id: m.householdId } });
          console.log(`Deleted household ${m.householdId} (sole-owner auto-created)`);
        }
      }
    }

    await db.user.delete({ where: { id: u.id } });
    console.log(`Deleted user ${u.email}`);
  }

  await db.$disconnect();
}

main();

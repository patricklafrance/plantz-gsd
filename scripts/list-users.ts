import "dotenv/config";
import { db } from "../src/lib/db";

async function main() {
  const users = await db.user.findMany({
    select: {
      id: true,
      email: true,
      memberships: {
        select: {
          role: true,
          household: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  });

  for (const u of users) {
    console.log(`User: ${u.email}`);
    console.log(`  userId: ${u.id}`);
    for (const m of u.memberships) {
      console.log(
        `  - [${m.role}] ${m.household.name}  (householdId: ${m.household.id}, slug: ${m.household.slug})`,
      );
    }
    console.log("");
  }

  await db.$disconnect();
}

main();

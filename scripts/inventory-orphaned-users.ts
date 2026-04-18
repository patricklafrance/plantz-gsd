import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

async function main() {
  const users = await db.user.findMany({
    select: {
      id: true,
      email: true,
      createdAt: true,
      _count: { select: { memberships: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  const orphaned = users.filter((u) => u._count.memberships === 0);
  console.log(`Total users: ${users.length}`);
  console.log(`Orphaned (no household membership): ${orphaned.length}`);
  if (orphaned.length > 0) {
    console.log("\nOrphaned user emails:");
    orphaned.forEach((u) =>
      console.log(`  - ${u.email} (id=${u.id}, created=${u.createdAt.toISOString()})`),
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

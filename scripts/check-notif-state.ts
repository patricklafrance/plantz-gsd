import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env["DATABASE_URL"]! });
const db = new PrismaClient({ adapter });

async function main() {
  const notifs = await db.householdNotification.findMany({
    select: { id: true, type: true, recipientUserId: true, readAt: true, createdAt: true, cycleId: true },
    orderBy: { createdAt: "desc" },
  });
  console.log(JSON.stringify(notifs, null, 2));
  await db.$disconnect();
}
main();

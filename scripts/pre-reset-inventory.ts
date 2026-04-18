// One-shot: enumerate what `prisma migrate reset` would destroy.
// Run: npx tsx scripts/pre-reset-inventory.ts
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

async function main() {
  const { db } = await import("../src/lib/db");
  const counts = {
    users: await db.user.count(),
    households: await db.household.count(),
    householdMembers: await db.householdMember.count(),
    plants: await db.plant.count(),
    rooms: await db.room.count(),
    wateringLogs: await db.wateringLog.count(),
    notes: await db.note.count(),
    healthLogs: await db.healthLog.count(),
    careProfiles: await db.careProfile.count(),
    reminders: await db.reminder.count(),
    cycles: await db.cycle.count(),
    availability: await db.availability.count(),
    invitations: await db.invitation.count(),
  };
  console.log(JSON.stringify(counts, null, 2));
  await db.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});

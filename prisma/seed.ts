import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { catalogData } from "./data/catalog";
import bcryptjs from "bcryptjs";
import { addDays, subDays } from "date-fns";
import { DEMO_EMAIL, DEMO_PASSWORD, DEMO_PLANTS } from "../src/features/demo/seed-data";

const connectionString = process.env["DATABASE_URL"];
if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString });
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

  // Seed demo user
  console.log("Seeding demo user...");

  const existingDemo = await db.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (!existingDemo) {
    const passwordHash = await bcryptjs.hash(DEMO_PASSWORD, 12);
    const demoUser = await db.user.create({
      data: {
        email: DEMO_EMAIL,
        passwordHash,
        name: "Demo User",
        onboardingCompleted: true,
        remindersEnabled: true,
      },
    });

    // Create rooms for the demo user
    const livingRoom = await db.room.create({
      data: { name: "Living Room", userId: demoUser.id },
    });
    const bedroom = await db.room.create({
      data: { name: "Bedroom", userId: demoUser.id },
    });

    const rooms = [livingRoom, bedroom];
    const now = new Date();

    for (let i = 0; i < DEMO_PLANTS.length; i++) {
      const demoPlant = DEMO_PLANTS[i];

      // Look up the CareProfile by name
      const careProfile = await db.careProfile.findUnique({
        where: { name: demoPlant.catalogName },
      });

      const lastWateredAt = subDays(now, demoPlant.daysAgoWatered);
      const nextWateringAt = addDays(lastWateredAt, demoPlant.intervalDays);

      const plant = await db.plant.create({
        data: {
          nickname: demoPlant.nickname,
          species: careProfile?.species ?? demoPlant.catalogName,
          roomId: rooms[i % rooms.length].id,
          wateringInterval: demoPlant.intervalDays,
          careProfileId: careProfile?.id ?? null,
          userId: demoUser.id,
          lastWateredAt,
          nextWateringAt,
          reminders: {
            create: {
              userId: demoUser.id,
              enabled: true,
            },
          },
        },
      });

      // Create a watering log entry for the last watering
      await db.wateringLog.create({
        data: {
          plantId: plant.id,
          wateredAt: lastWateredAt,
        },
      });
    }

    console.log(`Seeded demo user with ${DEMO_PLANTS.length} plants.`);
  } else {
    console.log("Demo user already exists, skipping.");
  }
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

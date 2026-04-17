import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { catalogData } from "./data/catalog";
import bcryptjs from "bcryptjs";
import { addDays, subDays } from "date-fns";
import { DEMO_EMAIL, DEMO_PASSWORD, DEMO_PLANTS } from "../src/features/demo/seed-data";
import { generateHouseholdSlug } from "../src/lib/slug";

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

    // Create demo user + household + householdMember atomically
    const { demoUser, household } = await db.$transaction(async (tx) => {
      const demoUser = await tx.user.create({
        data: {
          email: DEMO_EMAIL,
          passwordHash,
          name: "Demo User",
          onboardingCompleted: true,
          remindersEnabled: true,
        },
      });

      // Slug collision loop
      let slug: string;
      let attempts = 0;
      do {
        slug = generateHouseholdSlug();
        const existing = await tx.household.findUnique({
          where: { slug },
          select: { id: true },
        });
        if (!existing) break;
        if (++attempts > 10) throw new Error("Slug generation failed after 10 attempts");
      } while (true);

      const household = await tx.household.create({
        data: {
          name: "Demo Plants",
          slug: slug!,
          timezone: "UTC",
          cycleDuration: 7,
          rotationStrategy: "sequential",
        },
      });

      await tx.householdMember.create({
        data: {
          userId: demoUser.id,
          householdId: household.id,
          role: "OWNER",
          rotationOrder: 0,
          isDefault: true,
        },
      });

      return { demoUser, household };
    });

    // Create rooms for the demo household
    const livingRoom = await db.room.create({
      data: {
        name: "Living Room",
        householdId: household.id,
        createdByUserId: demoUser.id,
      },
    });
    const bedroom = await db.room.create({
      data: {
        name: "Bedroom",
        householdId: household.id,
        createdByUserId: demoUser.id,
      },
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
          householdId: household.id,        // CHANGED: was userId
          createdByUserId: demoUser.id,     // AUDT-02
          lastWateredAt,
          nextWateringAt,
          reminders: {
            create: {
              userId: demoUser.id,          // D-13: per-user reminder
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
          performedByUserId: demoUser.id,   // AUDT-01
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

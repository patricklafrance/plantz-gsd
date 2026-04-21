import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { catalogData } from "./data/catalog";
import bcryptjs from "bcryptjs";
import crypto from "node:crypto";
import { addDays, subDays } from "date-fns";
import {
  DEMO_EMAIL,
  DEMO_PASSWORD,
  DEMO_PLANTS,
  DEMO_SAMPLE_MEMBERS,
} from "../src/features/demo/seed-data";
import { generateHouseholdSlug } from "../src/lib/slug";
import { computeInitialCycleBoundaries } from "../src/features/household/cycle";

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
    const demoPasswordHash = await bcryptjs.hash(DEMO_PASSWORD, 12);

    // T-07-01: Unusable hash for sample members. The bcrypt source secret is
    // a fresh 64-char CSPRNG value that is never stored; bcryptjs.compare against
    // any known string will return false. RESEARCH.md §Pattern 1.
    const unusableHash = await bcryptjs.hash(
      crypto.randomBytes(32).toString("hex"),
      12,
    );

    // Create demo user + 2 sample users + household + 3 members + Cycle #1 + Availability atomically
    const { demoUser, household, aliceUser, bobUser } = await db.$transaction(
      async (tx) => {
        // 1. Demo user (existing shape — unchanged)
        const demoUser = await tx.user.create({
          data: {
            email: DEMO_EMAIL,
            passwordHash: demoPasswordHash,
            name: "Demo User",
            onboardingCompleted: true,
            remindersEnabled: true,
          },
        });

        // 2. Sample users (alice, bob) — DEMO_SAMPLE_MEMBERS order.
        // Passwords are unusable; these rows exist as data only (T-07-01, D-02/D-03).
        const [aliceSpec, bobSpec] = DEMO_SAMPLE_MEMBERS;
        const aliceUser = await tx.user.create({
          data: {
            email: aliceSpec.email,
            passwordHash: unusableHash,
            name: aliceSpec.name,
            onboardingCompleted: true,
            remindersEnabled: true,
          },
        });
        const bobUser = await tx.user.create({
          data: {
            email: bobSpec.email,
            passwordHash: unusableHash,
            name: bobSpec.name,
            onboardingCompleted: true,
            remindersEnabled: true,
          },
        });

        // 3. Slug collision loop — bounded at 10 attempts (existing pattern, WR-02)
        let slug: string;
        let attempts = 0;
        do {
          slug = generateHouseholdSlug();
          const existing = await tx.household.findUnique({
            where: { slug },
            select: { id: true },
          });
          if (!existing) break;
          if (attempts++ >= 9) throw new Error("Slug generation failed after 10 attempts");
        } while (true);

        // 4. Demo Household (existing shape — unchanged)
        const household = await tx.household.create({
          data: {
            name: "Demo Plants",
            slug: slug!,
            timezone: "UTC",
            cycleDuration: 7,
            rotationStrategy: "sequential",
          },
        });

        // 5. 3 HouseholdMember rows — rotationOrder 0/1/2 per D-05
        await tx.householdMember.create({
          data: {
            userId: demoUser.id,
            householdId: household.id,
            role: "OWNER",
            rotationOrder: 0,
            isDefault: true, // demo user's only household is their default
          },
        });
        await tx.householdMember.create({
          data: {
            userId: aliceUser.id,
            householdId: household.id,
            role: "MEMBER",
            rotationOrder: aliceSpec.rotationOrder, // 1
            isDefault: true, // alice has only this household — keep default invariant
          },
        });
        await tx.householdMember.create({
          data: {
            userId: bobUser.id,
            householdId: household.id,
            role: "MEMBER",
            rotationOrder: bobSpec.rotationOrder, // 2
            isDefault: true, // bob has only this household
          },
        });

        // 6. Cycle #1 — D-04 mid-window (now-3d / now+4d) with demo user as assignee.
        // RESEARCH.md §Pattern 2 (Option B): call computeInitialCycleBoundaries for
        // anchorDate correctness, then override startDate/endDate for the mid-window shift.
        // Pitfall 2: anchorDate MUST stay as "tomorrow UTC" (drives computeAssigneeIndex
        // for future cycle transitions) — only startDate/endDate are shifted.
        const now = new Date();
        const { anchorDate } = computeInitialCycleBoundaries(now, "UTC", 7);
        const cycleStartDate = subDays(now, 3);
        const cycleEndDate = addDays(now, 4);

        await tx.cycle.create({
          data: {
            householdId: household.id,
            cycleNumber: 1,
            anchorDate, // tomorrow UTC — from computeInitialCycleBoundaries
            cycleDuration: 7,
            startDate: cycleStartDate, // now - 3 days
            endDate: cycleEndDate, // now + 4 days
            status: "active",
            assignedUserId: demoUser.id, // D-04: demo user is active assignee
            memberOrderSnapshot: [
              { userId: demoUser.id, rotationOrder: 0 },
              { userId: aliceUser.id, rotationOrder: 1 },
              { userId: bobUser.id, rotationOrder: 2 },
            ],
          },
        });

        // 7. Availability — D-06 future window (now+10d / now+17d) on Alice (sample member, NOT demo user)
        await tx.availability.create({
          data: {
            userId: aliceUser.id,
            householdId: household.id,
            startDate: addDays(now, 10),
            endDate: addDays(now, 17),
            reason: "Out of town",
          },
        });

        return { demoUser, household, aliceUser, bobUser };
      },
    );

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

    console.log(
      `Seeded Demo Household with 3 members (demo + ${DEMO_SAMPLE_MEMBERS.length} samples), mid-window Cycle #1, 1 Availability, and ${DEMO_PLANTS.length} plants.`,
    );
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

"use server";

import { signIn, auth } from "../../../auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { DEMO_EMAIL, DEMO_PASSWORD, DEMO_PLANTS, STARTER_PLANTS } from "./seed-data";
import { generateHouseholdSlug } from "@/lib/slug";

/**
 * Ensures the demo user exists in the database, creating it with a Household,
 * HouseholdMember, and sample plants if needed, then signs in and redirects.
 * Called from the /demo route page — fully self-bootstrapping.
 */
export async function startDemoSession() {
  try {
    // Auto-create demo user if it doesn't exist yet
    const existing = await db.user.findUnique({ where: { email: DEMO_EMAIL } });
    if (!existing) {
      const bcryptjs = (await import("bcryptjs")).default;
      const { subDays, addDays } = await import("date-fns");
      const passwordHash = await bcryptjs.hash(DEMO_PASSWORD, 12);

      // Create user + household + householdMember atomically
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

        // Slug collision loop (mirrors auth/actions.ts pattern)
        let slug: string;
        let attempts = 0;
        do {
          slug = generateHouseholdSlug();
          const existingHousehold = await tx.household.findUnique({
            where: { slug },
            select: { id: true },
          });
          if (!existingHousehold) break;
          if (++attempts > 10) {
            throw new Error("Slug generation failed after 10 attempts");
          }
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
            isDefault: true, // demo user's only household is their default
          },
        });

        return { demoUser, household };
      });

      // Create rooms outside the transaction (non-critical if partial failure)
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
        const dp = DEMO_PLANTS[i];
        const careProfile = await db.careProfile.findUnique({
          where: { name: dp.catalogName },
        });
        const lastWateredAt = subDays(now, dp.daysAgoWatered);
        const nextWateringAt = addDays(lastWateredAt, dp.intervalDays);

        const plant = await db.plant.create({
          data: {
            nickname: dp.nickname,
            species: careProfile?.species ?? dp.catalogName,
            roomId: rooms[i % rooms.length].id,
            wateringInterval: dp.intervalDays,
            careProfileId: careProfile?.id ?? null,
            householdId: household.id,      // CHANGED: was userId
            createdByUserId: demoUser.id,   // AUDT-02
            lastWateredAt,
            nextWateringAt,
            reminders: {
              create: { userId: demoUser.id, enabled: true }, // D-13: per-user
            },
          },
        });

        await db.wateringLog.create({
          data: {
            plantId: plant.id,
            wateredAt: lastWateredAt,
            performedByUserId: demoUser.id, // AUDT-01
          },
        });
      }
    }

    await signIn("credentials", {
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    // signIn throws NEXT_REDIRECT on success — re-throw it
    const { isRedirectError } = await import("next/dist/client/components/redirect-error");
    if (isRedirectError(error)) {
      throw error;
    }
    return { error: "Could not start demo session. Please try again." };
  }
}

/**
 * Seeds the current user's collection with common starter plants from the CareProfile catalog.
 * Called during onboarding (DEMO-03). Rejects demo users.
 * @param plantCountRange - Optional range string from onboarding (e.g. "30+ plants")
 * @param householdId - The household to seed plants into
 */
export async function seedStarterPlants(plantCountRange?: string, householdId?: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };
  if (session.user.isDemo) return { error: "Demo mode — sign up to save your changes." };

  const TARGET_COUNTS: Record<string, number> = {
    "1-5 plants": 5,
    "6-15 plants": 10,
    "16-30 plants": 20,
    "30+ plants": 35,
  };
  const targetCount = TARGET_COUNTS[plantCountRange ?? "1-5 plants"] ?? 5;

  // Resolve householdId: use provided value or fall back to session's active household
  const targetHouseholdId = householdId ?? session.user.activeHouseholdId;
  if (!targetHouseholdId) return { error: "No household found." };

  const { addDays } = await import("date-fns");
  const now = new Date();

  // Look up CareProfile entries for each starter plant
  const careProfiles = await db.careProfile.findMany({
    where: { name: { in: [...STARTER_PLANTS] } },
  });

  // If targetCount exceeds the base STARTER_PLANTS set, fetch additional profiles
  let allProfiles = [...careProfiles];

  if (targetCount > allProfiles.length) {
    const additionalNeeded = targetCount - allProfiles.length;
    const existingNames = allProfiles.map((p) => p.name);
    const additionalProfiles = await db.careProfile.findMany({
      where: { name: { notIn: existingNames } },
      take: additionalNeeded,
      orderBy: { name: "asc" },
    });
    allProfiles = [...allProfiles, ...additionalProfiles];
  }

  const createdPlants: string[] = [];

  for (const profile of allProfiles) {
    const nextWateringAt = addDays(now, profile.wateringInterval);

    const plant = await db.plant.create({
      data: {
        nickname: profile.name,
        species: profile.species,
        wateringInterval: profile.wateringInterval,
        careProfileId: profile.id,
        householdId: targetHouseholdId,   // CHANGED: was userId
        createdByUserId: session.user.id, // AUDT-02
        lastWateredAt: now,
        nextWateringAt,
        reminders: {
          create: {
            userId: session.user.id, // D-13: per-user
            enabled: true,
          },
        },
      },
    });

    createdPlants.push(plant.id);
  }

  revalidatePath("/h/[householdSlug]/dashboard", "page");
  revalidatePath("/h/[householdSlug]/plants", "page");

  return { success: true, count: createdPlants.length };
}

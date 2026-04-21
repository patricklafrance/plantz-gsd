"use server";

import { signIn, auth } from "../../../auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { DEMO_EMAIL, DEMO_PASSWORD, STARTER_PLANTS } from "./seed-data";
import { requireHouseholdAccess } from "@/features/household/guards";
import { HOUSEHOLD_PATHS } from "@/features/household/paths";

/**
 * Signs the demo user in and redirects to the dashboard (D-11).
 *
 * The demo user + Demo Household + Cycle + Availability + plants are seeded
 * by `prisma/seed.ts` (HDMO-01). If the demo user is missing from the DB,
 * returns a seed-missing error and the `/demo` route redirects to the login
 * page with `?error=demo_failed`.
 *
 * This function is the demo entry point itself — it is intentionally NOT
 * guarded against `session.user.isDemo` (there is no session yet). The static
 * guard audit test at `tests/phase-07/demo-guard-audit.test.ts` lists
 * `startDemoSession` in SKIP_FUNCTIONS for this reason.
 */
export async function startDemoSession() {
  try {
    const demo = await db.user.findUnique({ where: { email: DEMO_EMAIL } });
    if (!demo) {
      return {
        error:
          "Demo data not found. Run `npx prisma db seed` to set up the demo.",
      };
    }

    await signIn("credentials", {
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    // signIn throws NEXT_REDIRECT on success — re-throw it
    const { isRedirectError } = await import(
      "next/dist/client/components/redirect-error"
    );
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

  // Surface empty-catalog as a seed error instead of silently returning count: 0.
  // Matches UAT-10 observed failure mode when the CareProfile table has not been
  // seeded (run `npx prisma db seed`).
  if (allProfiles.length === 0) {
    return { error: "Starter plant catalog is empty. Run `npx prisma db seed` to populate it." };
  }

  const createdPlants: string[] = [];

  // CR-01: Live membership check immediately before the write loop — Pitfall 16 / D-14.
  // Positioned in the 2 lines preceding the first db.plant.create call so a mechanical
  // grep (see Plan 02-10 acceptance criteria) can verify the guard has not drifted away
  // from the write it protects. The fallback to session.user.activeHouseholdId is a
  // landing-target hint, not an authorization source; this throws ForbiddenError if
  // the caller is not a member of targetHouseholdId.
  await requireHouseholdAccess(targetHouseholdId);
  for (const profile of allProfiles) {
    const plant = await db.plant.create({
      data: {
        nickname: profile.name,
        species: profile.species,
        wateringInterval: profile.wateringInterval,
        careProfileId: profile.id,
        householdId: targetHouseholdId,   // CHANGED: was userId
        createdByUserId: session.user.id, // AUDT-02
        lastWateredAt: now,
        nextWateringAt: addDays(now, profile.wateringInterval),
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

  revalidatePath(HOUSEHOLD_PATHS.dashboard, "page");
  revalidatePath(HOUSEHOLD_PATHS.plants, "page");

  return { success: true, count: createdPlants.length };
}

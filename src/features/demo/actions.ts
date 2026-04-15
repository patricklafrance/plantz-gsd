"use server";

import { signIn, auth } from "../../../auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { DEMO_EMAIL, DEMO_PASSWORD, STARTER_PLANTS } from "./seed-data";

/**
 * Signs in as the demo user, redirecting to /dashboard.
 * Called from the /demo route page on mount.
 */
export async function startDemoSession() {
  try {
    await signIn("credentials", {
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    // signIn throws NEXT_REDIRECT on success — re-throw it
    // (same pattern as registerUser in auth/actions.ts)
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
 */
export async function seedStarterPlants() {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };
  if (session.user.isDemo) return { error: "Demo mode — sign up to save your changes." };

  const { addDays } = await import("date-fns");
  const now = new Date();

  // Look up CareProfile entries for each starter plant
  const careProfiles = await db.careProfile.findMany({
    where: { name: { in: [...STARTER_PLANTS] } },
  });

  const createdPlants: string[] = [];

  for (const profile of careProfiles) {
    const nextWateringAt = addDays(now, profile.wateringInterval);

    const plant = await db.plant.create({
      data: {
        nickname: profile.name,
        species: profile.species,
        wateringInterval: profile.wateringInterval,
        careProfileId: profile.id,
        userId: session.user.id,
        lastWateredAt: now,
        nextWateringAt,
        reminders: {
          create: {
            userId: session.user.id,
            enabled: true,
          },
        },
      },
    });

    createdPlants.push(plant.id);
  }

  revalidatePath("/dashboard");
  revalidatePath("/plants");

  return { success: true, count: createdPlants.length };
}

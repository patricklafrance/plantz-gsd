"use server";

import { auth, signIn } from "../../../auth";
import { db } from "@/lib/db";
import bcryptjs from "bcryptjs";
import { registerSchema } from "./schemas";
import { onboardingSchema } from "./schemas";
import { generateHouseholdSlug } from "@/lib/slug";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { revalidatePath } from "next/cache";

export async function registerUser(data: {
  email: string;
  password: string;
  confirmPassword: string;
  timezone?: string;
}) {
  // 1. Validate input
  const parsed = registerSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid input." };
  }

  try {
    // 2. Check email uniqueness (UX optimization; DB unique constraint is the authority)
    const existingUser = await db.user.findUnique({
      where: { email: parsed.data.email },
    });
    if (existingUser) {
      return {
        error:
          "An account with this email already exists. Sign in instead?",
      };
    }

    // 3. Hash password with bcryptjs (12 rounds)
    const passwordHash = await bcryptjs.hash(parsed.data.password, 12);
    const detectedTimezone = parsed.data.timezone ?? "UTC";

    // 4. D-08: transactional User + Household + HouseholdMember creation.
    // Any failure rolls back ALL three writes (Prisma $transaction guarantee).
    // Per RESEARCH §Pattern 1, the interactive form is required because
    // HouseholdMember needs both user.id and household.id.
    await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: parsed.data.email,
          passwordHash,
        },
      });

      // Slug collision loop (D-10). Statistically near-impossible to collide
      // with 54^8 ≈ 72 trillion possible slugs, but defend anyway.
      let slug: string;
      let attempts = 0;
      do {
        slug = generateHouseholdSlug();
        const existing = await tx.household.findUnique({
          where: { slug },
          select: { id: true },
        });
        if (!existing) break;
        if (++attempts > 10) {
          throw new Error("Slug generation failed after 10 attempts");
        }
      } while (true);

      const household = await tx.household.create({
        data: {
          name: "My Plants",                 // D-09
          slug,                              // D-10
          timezone: detectedTimezone,        // D-12
          cycleDuration: 7,                  // D-12
          rotationStrategy: "sequential",    // D-12
        },
      });

      await tx.householdMember.create({
        data: {
          userId: user.id,
          householdId: household.id,
          role: "OWNER",                     // D-08
          rotationOrder: 0,                  // RESEARCH Open Question §2: declare now
          isDefault: true,                   // Phase 2 Q7: first-created (signup) household is the user's default
        },
      });
    });

    // 5. Auto-login (preserve existing pattern verbatim — signIn throws
    // NEXT_REDIRECT on success which the catch below MUST re-throw).
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    // CRITICAL: Re-throw redirect errors — they are NOT failures
    if (isRedirectError(error)) {
      throw error;
    }
    return { error: "Something went wrong. Please try again in a moment." };
  }
}

export async function updateTimezone(timezone: string) {
  const session = await auth();
  if (!session?.user?.id) return;
  if (session.user.isDemo) return; // Demo mode — skip DB write

  // Validate timezone is a non-empty string (IANA format — only used for display comparison)
  if (!timezone || typeof timezone !== "string" || timezone.length > 100) return;

  // Only set timezone if not already stored (preserves "home" timezone for travel detection)
  const existing = await db.user.findUnique({
    where: { id: session.user.id },
    select: { timezone: true },
  });
  if (existing?.timezone) return; // Already stored — do not overwrite

  await db.user.update({
    where: { id: session.user.id },
    data: { timezone },
  });
}

export async function completeOnboarding(data: {
  plantCountRange: string;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Session expired. Please sign in again." };
  }
  if (session.user.isDemo) return { error: "Demo mode — sign up to save your changes." };

  // Validate the plant count range
  const parsed = onboardingSchema.safeParse({
    plantCountRange: data.plantCountRange,
  });
  if (!parsed.success) {
    return { error: "Invalid selection." };
  }

  await db.user.update({
    where: { id: session.user.id },
    data: {
      onboardingCompleted: true,
      plantCountRange: parsed.data.plantCountRange,
    },
  });

  // Revalidate dashboard so the banner disappears on next server render
  revalidatePath("/dashboard");
  return { success: true };
}

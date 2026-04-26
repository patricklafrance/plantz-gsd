"use server";

import { auth, signIn } from "../../../auth";
import { db } from "@/lib/db";
import bcryptjs from "bcryptjs";
import { loginSchema, registerSchema } from "./schemas";
import { onboardingSchema } from "./schemas";
import { validateCallbackUrl } from "./callback-url";
import { generateHouseholdSlug } from "@/lib/slug";
import { HOUSEHOLD_PATHS } from "@/features/household/paths";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { revalidatePath } from "next/cache";
import { computeInitialCycleBoundaries } from "@/features/household/cycle";

/**
 * Server-action login. Resolves the user's default household slug *before*
 * calling signIn so the redirect target is the final URL
 * (`/h/{slug}/dashboard`) — eliminates the /dashboard intermediate redirect
 * that produces a URL-bar flicker.
 *
 * Also surfaces "Incorrect email or password" via the return value so the
 * login form can render an inline error (Auth.js client-side `redirect:true`
 * would otherwise produce a `?error=CredentialsSignin` URL with no UI hook).
 */
export async function loginUser(input: {
  email: string;
  password: string;
  callbackUrl?: string;
}) {
  const parsed = loginSchema.safeParse({
    email: input.email,
    password: input.password,
  });
  if (!parsed.success) {
    return { error: "Invalid input." };
  }

  // Pre-resolve the default-household slug. The lookup is by email only, so
  // any value (existing or not) returns the same shape — no account-existence
  // oracle. If the password is wrong, signIn rejects and we surface the
  // generic "Incorrect" message identical to the no-account branch.
  const member = await db.householdMember.findFirst({
    where: { user: { email: parsed.data.email } },
    select: { household: { select: { slug: true } } },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });

  const safeCallbackUrl = validateCallbackUrl(input.callbackUrl);
  const finalUrl =
    safeCallbackUrl ??
    (member ? `/h/${member.household.slug}/dashboard` : "/dashboard");

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: finalUrl,
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return { error: "Incorrect email or password. Please try again." };
  }
}

export async function registerUser(data: {
  email: string;
  password: string;
  confirmPassword: string;
  timezone?: string;
  callbackUrl?: string;
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
        // Throw after 10 total attempts — the `>= 9` bound with post-increment
        // means the 10th failing findUnique triggers the error, matching the
        // "after 10 attempts" message exactly.
        if (attempts++ >= 9) {
          throw new Error("Slug generation failed after 10 attempts");
        }
      } while (true);

      // WR-01: single source of truth for the signup household's cycle duration.
      // Passed to both household.create and computeInitialCycleBoundaries so a
      // future edit cannot desync Cycle #1's boundaries from the household row.
      const cycleDuration = 7;

      const household = await tx.household.create({
        data: {
          name: "My Plants",                 // D-09
          slug,                              // D-10
          timezone: detectedTimezone,        // D-12
          cycleDuration,                     // D-12
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

      // D-01: Cycle #1 eager creation. Every household always has an active cycle.
      const { anchorDate, startDate, endDate } = computeInitialCycleBoundaries(
        new Date(),
        detectedTimezone,
        cycleDuration,
      );
      await tx.cycle.create({
        data: {
          householdId: household.id,
          cycleNumber: 1,
          anchorDate,
          cycleDuration,
          startDate,
          endDate,
          status: "active",
          assignedUserId: user.id,
          memberOrderSnapshot: [{ userId: user.id, rotationOrder: 0 }],
        },
      });
    });

    // 5. Auto-login (preserve existing pattern verbatim — signIn throws
    // NEXT_REDIRECT on success which the catch below MUST re-throw).
    // Server-side re-validation: never trust client-passed callbackUrl
    // unverified, even though the form already validated it.
    const safeCallbackUrl = validateCallbackUrl(data.callbackUrl);
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: safeCallbackUrl ?? "/dashboard",
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

  // Validate timezone is a non-empty string of reasonable length.
  if (!timezone || typeof timezone !== "string" || timezone.length > 100) return;

  // Validate IANA format: the value also flows into computeInitialCycleBoundaries
  // via onboarding, where TZDate silently falls back to UTC on unknown strings.
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone });
  } catch {
    return;
  }

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

  // Revalidate the household-scoped dashboard so the onboarding banner
  // disappears on next server render. The legacy `/dashboard` path is a
  // redirect stub and revalidating it would not touch the real page.
  revalidatePath(HOUSEHOLD_PATHS.dashboard, "page");
  return { success: true };
}

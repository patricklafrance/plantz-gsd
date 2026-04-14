"use server";

import { auth, signIn } from "../../../auth";
import { db } from "@/lib/db";
import bcryptjs from "bcryptjs";
import { registerSchema } from "./schemas";
import { onboardingSchema } from "./schemas";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { revalidatePath } from "next/cache";

export async function registerUser(data: {
  email: string;
  password: string;
  confirmPassword: string;
}) {
  // 1. Validate input
  const parsed = registerSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid input." };
  }

  try {
    // 2. Check email uniqueness
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

    // 4. Create user in database
    await db.user.create({
      data: {
        email: parsed.data.email,
        passwordHash,
      },
    });

    // 5. Auto-login and redirect to dashboard (per D-03)
    // signIn throws NEXT_REDIRECT on success — this is expected behavior
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

export async function completeOnboarding(data: {
  plantCountRange: string;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Session expired. Please sign in again." };
  }

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

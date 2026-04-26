"use server";

import { auth } from "../../../auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { addDays } from "date-fns";
import {
  snoozeSchema,
  snoozeCustomSchema,
  toggleReminderSchema,
  toggleGlobalRemindersSchema,
} from "./schemas";
import { requireHouseholdAccess } from "@/features/household/guards";
import { HOUSEHOLD_PATHS } from "@/features/household/paths";

export async function snoozeReminder(data: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };
  if (session.user.isDemo) return { error: "Demo mode — sign up to save your changes." };

  const parsed = snoozeSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  await requireHouseholdAccess(parsed.data.householdId);

  const { plantId, days } = parsed.data;

  // Ownership check: plant belongs to this household
  const plant = await db.plant.findFirst({
    where: { id: plantId, householdId: parsed.data.householdId },
  });
  if (!plant) return { error: "Plant not found." };

  const snoozedUntil = addDays(new Date(), days);

  // D-13: Reminder is per-user-per-plant; compound key preserved verbatim
  await db.reminder.upsert({
    where: { plantId_userId: { plantId, userId: session.user.id } },
    update: { snoozedUntil },
    create: { plantId, userId: session.user.id, enabled: true, snoozedUntil },
  });

  revalidatePath(HOUSEHOLD_PATHS.plantDetail, "page");
  revalidatePath(HOUSEHOLD_PATHS.dashboard, "page");

  return { success: true };
}

export async function snoozeCustomReminder(data: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };
  if (session.user.isDemo) return { error: "Demo mode — sign up to save your changes." };

  const parsed = snoozeCustomSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  await requireHouseholdAccess(parsed.data.householdId);

  const { plantId, snoozedUntil } = parsed.data;

  // Ownership check: plant belongs to this household
  const plant = await db.plant.findFirst({
    where: { id: plantId, householdId: parsed.data.householdId },
  });
  if (!plant) return { error: "Plant not found." };

  // D-13: Reminder is per-user-per-plant; compound key preserved verbatim
  await db.reminder.upsert({
    where: { plantId_userId: { plantId, userId: session.user.id } },
    update: { snoozedUntil },
    create: { plantId, userId: session.user.id, enabled: true, snoozedUntil },
  });

  revalidatePath(HOUSEHOLD_PATHS.plantDetail, "page");
  revalidatePath(HOUSEHOLD_PATHS.dashboard, "page");

  return { success: true };
}

export async function togglePlantReminder(data: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };
  if (session.user.isDemo) return { error: "Demo mode — sign up to save your changes." };

  const parsed = toggleReminderSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  await requireHouseholdAccess(parsed.data.householdId);

  const { plantId, enabled } = parsed.data;

  // Ownership check: plant belongs to this household
  const plant = await db.plant.findFirst({
    where: { id: plantId, householdId: parsed.data.householdId },
  });
  if (!plant) return { error: "Plant not found." };

  // D-13: Reminder is per-user-per-plant; compound key preserved verbatim
  await db.reminder.upsert({
    where: { plantId_userId: { plantId, userId: session.user.id } },
    update: { enabled },
    create: { plantId, userId: session.user.id, enabled },
  });

  revalidatePath(HOUSEHOLD_PATHS.plantDetail, "page");
  revalidatePath(HOUSEHOLD_PATHS.dashboard, "page");

  return { success: true };
}

/**
 * toggleGlobalReminders is intentionally NOT migrated to household scope.
 * It writes User.remindersEnabled which is a per-user global setting (T-02-05b-07).
 * No requireHouseholdAccess — this is a per-user preference, not household-scoped.
 */
export async function toggleGlobalReminders(data: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };
  if (session.user.isDemo) return { error: "Demo mode — sign up to save your changes." };

  const parsed = toggleGlobalRemindersSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  await db.user.update({
    where: { id: session.user.id },
    data: { remindersEnabled: parsed.data.enabled },
  });

  // Revalidate all household dashboards via literal pattern (Next.js invalidates all matching)
  revalidatePath(HOUSEHOLD_PATHS.dashboard, "page");
  revalidatePath("/h/[householdSlug]/preferences", "page");

  return { success: true };
}

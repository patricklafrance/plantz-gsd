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

export async function snoozeReminder(data: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };
  if (session.user.isDemo) return { error: "Demo mode — sign up to save your changes." };

  const parsed = snoozeSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  const { plantId, days } = parsed.data;

  // Ownership check
  const plant = await db.plant.findFirst({
    where: { id: plantId, userId: session.user.id },
  });
  if (!plant) return { error: "Plant not found." };

  const snoozedUntil = addDays(new Date(), days);

  await db.reminder.upsert({
    where: { plantId_userId: { plantId, userId: session.user.id } },
    update: { snoozedUntil },
    create: { plantId, userId: session.user.id, enabled: true, snoozedUntil },
  });

  revalidatePath("/plants/" + plantId);
  revalidatePath("/dashboard");

  return { success: true };
}

export async function snoozeCustomReminder(data: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };
  if (session.user.isDemo) return { error: "Demo mode — sign up to save your changes." };

  const parsed = snoozeCustomSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  const { plantId, snoozedUntil } = parsed.data;

  // Ownership check
  const plant = await db.plant.findFirst({
    where: { id: plantId, userId: session.user.id },
  });
  if (!plant) return { error: "Plant not found." };

  await db.reminder.upsert({
    where: { plantId_userId: { plantId, userId: session.user.id } },
    update: { snoozedUntil },
    create: { plantId, userId: session.user.id, enabled: true, snoozedUntil },
  });

  revalidatePath("/plants/" + plantId);
  revalidatePath("/dashboard");

  return { success: true };
}

export async function togglePlantReminder(data: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };
  if (session.user.isDemo) return { error: "Demo mode — sign up to save your changes." };

  const parsed = toggleReminderSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  const { plantId, enabled } = parsed.data;

  // Ownership check
  const plant = await db.plant.findFirst({
    where: { id: plantId, userId: session.user.id },
  });
  if (!plant) return { error: "Plant not found." };

  await db.reminder.upsert({
    where: { plantId_userId: { plantId, userId: session.user.id } },
    update: { enabled },
    create: { plantId, userId: session.user.id, enabled },
  });

  revalidatePath("/plants/" + plantId);
  revalidatePath("/dashboard");

  return { success: true };
}

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

  revalidatePath("/dashboard");
  revalidatePath("/preferences");

  return { success: true };
}

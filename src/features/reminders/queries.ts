import { db } from "@/lib/db";
import { differenceInDays } from "date-fns";
import type { ReminderItem } from "./types";

/**
 * Lightweight count query for the nav badge.
 * Returns count of overdue + due-today plants with active (non-snoozed, enabled) reminders.
 * Checks global remindersEnabled on User first.
 */
export async function getReminderCount(
  userId: string,
  todayStart: Date,
  todayEnd: Date
): Promise<number> {
  // Check global toggle first — fast exit
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { remindersEnabled: true },
  });
  if (!user?.remindersEnabled) return 0;

  const now = new Date();

  const [overdue, dueToday] = await Promise.all([
    db.plant.count({
      where: {
        userId,
        archivedAt: null,
        nextWateringAt: { lt: todayStart },
        reminders: {
          some: {
            userId,
            enabled: true,
            OR: [{ snoozedUntil: null }, { snoozedUntil: { lt: now } }],
          },
        },
      },
    }),
    db.plant.count({
      where: {
        userId,
        archivedAt: null,
        nextWateringAt: { gte: todayStart, lt: todayEnd },
        reminders: {
          some: {
            userId,
            enabled: true,
            OR: [{ snoozedUntil: null }, { snoozedUntil: { lt: now } }],
          },
        },
      },
    }),
  ]);

  return overdue + dueToday;
}

/**
 * Fetches plant data for the notification dropdown panel.
 * Returns ReminderItem[] sorted: overdue first (most days overdue), then due-today (alphabetical).
 */
export async function getReminderItems(
  userId: string,
  todayStart: Date,
  todayEnd: Date
): Promise<ReminderItem[]> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { remindersEnabled: true },
  });
  if (!user?.remindersEnabled) return [];

  const now = new Date();

  const reminderFilter = {
    some: {
      userId,
      enabled: true as const,
      OR: [{ snoozedUntil: null }, { snoozedUntil: { lt: now } }],
    },
  };

  const [overduePlants, dueTodayPlants] = await Promise.all([
    db.plant.findMany({
      where: {
        userId,
        archivedAt: null,
        nextWateringAt: { lt: todayStart },
        reminders: reminderFilter,
      },
      include: { room: { select: { name: true } } },
      orderBy: { nextWateringAt: "asc" },
    }),
    db.plant.findMany({
      where: {
        userId,
        archivedAt: null,
        nextWateringAt: { gte: todayStart, lt: todayEnd },
        reminders: reminderFilter,
      },
      include: { room: { select: { name: true } } },
      orderBy: { nickname: "asc" },
    }),
  ]);

  const items: ReminderItem[] = [];

  for (const plant of overduePlants) {
    const daysOverdue = plant.nextWateringAt
      ? Math.abs(differenceInDays(plant.nextWateringAt, todayStart))
      : 0;
    items.push({
      plantId: plant.id,
      nickname: plant.nickname,
      roomName: plant.room?.name ?? null,
      statusLabel: daysOverdue === 1 ? "1 day overdue" : `${daysOverdue} days overdue`,
      daysOverdue,
    });
  }

  for (const plant of dueTodayPlants) {
    items.push({
      plantId: plant.id,
      nickname: plant.nickname,
      roomName: plant.room?.name ?? null,
      statusLabel: "Due today",
      daysOverdue: 0,
    });
  }

  return items;
}

/**
 * Fetches the Reminder record for a specific plant, used on the plant detail page.
 * Returns null if no Reminder record exists (should not happen after backfill).
 */
export async function getPlantReminder(
  plantId: string,
  userId: string
): Promise<{ enabled: boolean; snoozedUntil: Date | null } | null> {
  const reminder = await db.reminder.findUnique({
    where: { plantId_userId: { plantId, userId } },
    select: { enabled: true, snoozedUntil: true },
  });
  return reminder;
}

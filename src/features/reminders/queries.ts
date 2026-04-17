import { db } from "@/lib/db";
import { differenceInDays } from "date-fns";
import type { ReminderItem } from "./types";

/**
 * Lightweight count query for the nav badge.
 * Returns count of overdue + due-today plants with active (non-snoozed, enabled) reminders.
 *
 * D-14: Signature stable across Phase 2 → Phase 5. Phase 5 modifies the BODY
 * to add an active Cycle join and `assignedUserId === session.user.id` gate.
 * Callers (dashboard Server Components, NotificationBell) do not change.
 *
 * D-15: Phase 2 body has NO assignee gate — every member of the household sees
 * the same count. This is a deliberate temporary regression until Phase 5 lands.
 * Roommates will see false-positive "due today" badges until then.
 */
export async function getReminderCount(
  householdId: string,
  todayStart: Date,
  todayEnd: Date
): Promise<number> {
  const now = new Date();

  const [overdue, dueToday] = await Promise.all([
    db.plant.count({
      where: {
        householdId,
        archivedAt: null,
        nextWateringAt: { lt: todayStart },
        reminders: {
          some: {
            enabled: true,
            OR: [{ snoozedUntil: null }, { snoozedUntil: { lt: now } }],
          },
        },
      },
    }),
    db.plant.count({
      where: {
        householdId,
        archivedAt: null,
        nextWateringAt: { gte: todayStart, lt: todayEnd },
        reminders: {
          some: {
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
 *
 * D-14: Signature stable across Phase 2 → Phase 5. Phase 5 modifies the BODY
 * to add an active Cycle join and `assignedUserId === session.user.id` gate.
 * Callers do not change.
 *
 * D-15: Phase 2 body has NO assignee gate — every member of the household sees
 * the same items. This is a deliberate temporary regression until Phase 5 lands.
 */
export async function getReminderItems(
  householdId: string,
  todayStart: Date,
  todayEnd: Date
): Promise<ReminderItem[]> {
  const now = new Date();

  const reminderFilter = {
    some: {
      enabled: true as const,
      OR: [{ snoozedUntil: null }, { snoozedUntil: { lt: now } }],
    },
  };

  const [overduePlants, dueTodayPlants] = await Promise.all([
    db.plant.findMany({
      where: {
        householdId,
        archivedAt: null,
        nextWateringAt: { lt: todayStart },
        reminders: reminderFilter,
      },
      include: { room: { select: { name: true } } },
      orderBy: { nextWateringAt: "asc" },
    }),
    db.plant.findMany({
      where: {
        householdId,
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
 *
 * UNCHANGED: This is a per-user-per-plant preference read (not household-scoped).
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

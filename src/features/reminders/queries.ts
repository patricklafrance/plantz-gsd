import { db } from "@/lib/db";
import { differenceInDays } from "date-fns";
import { getCurrentCycle } from "@/features/household/queries";
import type { ReminderItem } from "./types";

/**
 * D-07 / D-08 / D-09 / D-10 — assignee gate (Phase 5 rewrite).
 *
 * Non-assignees of the current active cycle get 0 (Pitfall 13). Paused cycles
 * bypass the gate and count for everyone (D-09 fallback — plants shouldn't go
 * silent when no one is formally responsible). No active cycle returns 0.
 *
 * Gate is placed BEFORE the plant.count query — deliberately early-return so
 * branch logic stays grep-able. plant.count call is unchanged from Phase 2.
 */
export async function getReminderCount(
  householdId: string,
  userId: string,
  todayStart: Date,
  todayEnd: Date
): Promise<number> {
  // D-10: defensive — post-Phase-3, Cycle #1 is bootstrapped at household creation so null is unexpected
  const cycle = await getCurrentCycle(householdId);
  if (!cycle) return 0;

  // D-08: active cycle, non-assignee → 0 (Pitfall 13)
  // D-09: paused cycle bypasses the gate — fall through to plant.count for all viewers
  if (cycle.status === "active" && cycle.assignedUserId !== userId) {
    return 0;
  }

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
 * D-07 / D-08 / D-09 / D-10 — assignee gate (Phase 5 rewrite).
 *
 * Same gate semantics as getReminderCount — active non-assignees get `[]`,
 * paused cycles bypass the gate, null cycles return `[]`.
 */
export async function getReminderItems(
  householdId: string,
  userId: string,
  todayStart: Date,
  todayEnd: Date
): Promise<ReminderItem[]> {
  const cycle = await getCurrentCycle(householdId);
  if (!cycle) return [];

  if (cycle.status === "active" && cycle.assignedUserId !== userId) {
    return [];
  }

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
      statusLabel:
        daysOverdue === 0
          ? "Overdue"
          : daysOverdue === 1
            ? "1 day overdue"
            : `${daysOverdue} days overdue`,
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

import { db } from "@/lib/db";
import { differenceInDays } from "date-fns";
import type { DashboardPlant, UrgencyGroup } from "@/types/plants";
import type {
  Plant,
  Room,
  CareProfile,
  WateringLog,
} from "@/generated/prisma/client";

type PlantWithIncludes = Plant & {
  room: Room | null;
  careProfile: CareProfile | null;
  wateringLogs: WateringLog[];
};

export type DashboardResult = {
  overdue: DashboardPlant[];
  dueToday: DashboardPlant[];
  upcoming: DashboardPlant[];
  recentlyWatered: DashboardPlant[];
};

/**
 * Classifies plants into urgency groups and sorts them.
 * Pure function — no DB access. Exported for testing.
 *
 * @param plants - Plants with their latest watering log included
 * @param todayStart - Start of the user's local "today" in UTC
 * @param todayEnd - End of the user's local "today" in UTC
 */
export function classifyAndSort(
  plants: PlantWithIncludes[],
  todayStart: Date,
  todayEnd: Date
): DashboardResult {
  const result: DashboardResult = {
    overdue: [],
    dueToday: [],
    upcoming: [],
    recentlyWatered: [],
  };

  const fortyEightHoursAgo = new Date(todayStart.getTime() - 48 * 60 * 60 * 1000);

  for (const plant of plants) {
    const latestLog = plant.wateringLogs[0] ?? null;
    const nextWatering = plant.nextWateringAt;

    let urgency: UrgencyGroup;
    let daysUntil: number;

    if (!nextWatering) {
      // No nextWateringAt — treat as upcoming based on interval from creation
      daysUntil = differenceInDays(
        new Date(plant.createdAt.getTime() + plant.wateringInterval * 86400000),
        todayStart
      );
      urgency = daysUntil < 0 ? "overdue" : daysUntil === 0 ? "dueToday" : "upcoming";
    } else {
      // Check if nextWatering falls within today's boundaries
      if (nextWatering >= todayStart && nextWatering < todayEnd) {
        urgency = "dueToday";
        daysUntil = 0;
      } else {
        daysUntil = differenceInDays(nextWatering, todayStart);
        if (daysUntil < 0) {
          urgency = "overdue";
        } else {
          urgency = "upcoming";
        }
      }
    }

    // Check for "recentlyWatered" override:
    // Plants watered in the last 48 hours that are NOT overdue or dueToday
    if (
      urgency === "upcoming" &&
      plant.lastWateredAt &&
      plant.lastWateredAt >= fortyEightHoursAgo
    ) {
      urgency = "recentlyWatered";
    }

    const dashboardPlant: DashboardPlant = {
      ...plant,
      urgency,
      daysUntil,
      latestLog,
    };

    result[urgency].push(dashboardPlant);
  }

  // Sort per D-03
  // Overdue: most days late first (most negative daysUntil — ascending sort)
  result.overdue.sort((a, b) => a.daysUntil - b.daysUntil);

  // Due Today: alphabetical by nickname
  result.dueToday.sort((a, b) => a.nickname.localeCompare(b.nickname));

  // Upcoming: soonest due first (ascending daysUntil)
  result.upcoming.sort((a, b) => a.daysUntil - b.daysUntil);

  // Recently Watered: most recently watered first (descending lastWateredAt)
  result.recentlyWatered.sort((a, b) => {
    const aTime = a.lastWateredAt?.getTime() ?? 0;
    const bTime = b.lastWateredAt?.getTime() ?? 0;
    return bTime - aTime;
  });

  return result;
}

/**
 * Fetches all active plants for a household, classifies by urgency, and returns grouped result.
 *
 * @param householdId - The household's ID
 * @param todayStart - Start of the user's local "today" in UTC
 * @param todayEnd - End of the user's local "today" in UTC
 */
export async function getDashboardPlants(
  householdId: string,
  todayStart: Date,
  todayEnd: Date
): Promise<DashboardResult> {
  const plants = await db.plant.findMany({
    where: {
      householdId,
      archivedAt: null,
    },
    include: {
      room: true,
      careProfile: true,
      wateringLogs: {
        orderBy: { wateredAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return classifyAndSort(plants, todayStart, todayEnd);
}

/**
 * Fetches paginated watering history for a plant, with household scope via nested plant relation.
 */
export async function getWateringHistory(
  plantId: string,
  householdId: string,
  skip = 0,
  take = 20
): Promise<{ logs: WateringLog[]; total: number }> {
  const where = {
    plantId,
    plant: { householdId },
  };

  const [logs, total] = await Promise.all([
    db.wateringLog.findMany({
      where,
      orderBy: { wateredAt: "desc" },
      skip,
      take,
    }),
    db.wateringLog.count({ where }),
  ]);

  return { logs, total };
}

"use server";

import { auth } from "../../../auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { addDays } from "date-fns";
import {
  logWateringSchema,
  editWateringLogSchema,
  deleteWateringLogSchema,
  loadMoreWateringHistorySchema,
} from "./schemas";
import { getWateringHistory } from "./queries";
import { requireHouseholdAccess } from "@/features/household/guards";
import { HOUSEHOLD_PATHS } from "@/features/household/paths";

export async function logWatering(data: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };
  if (session.user.isDemo) return { error: "Demo mode — sign up to save your changes." };

  const parsed = logWateringSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  await requireHouseholdAccess(parsed.data.householdId);

  // Ownership check: only active (non-archived) plants in this household
  const plant = await db.plant.findFirst({
    where: {
      id: parsed.data.plantId,
      householdId: parsed.data.householdId,
      archivedAt: null,
    },
  });
  if (!plant) return { error: "Plant not found." };

  // Compute watering dates
  const wateredAt = parsed.data.wateredAt ?? new Date();

  // Duplicate check: reject if a watering log already exists for the same calendar date
  const dayStart = new Date(wateredAt);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const existingLog = await db.wateringLog.findFirst({
    where: {
      plantId: parsed.data.plantId,
      wateredAt: { gte: dayStart, lt: dayEnd },
    },
  });
  if (existingLog) return { error: "DUPLICATE" };

  // Create the watering log with audit column
  await db.wateringLog.create({
    data: {
      plantId: plant.id,
      wateredAt,
      note: parsed.data.note ?? null,
      performedByUserId: session.user.id, // AUDT-01
    },
  });

  // Recalculate from the most recent log (handles retroactive entries correctly)
  const mostRecent = await db.wateringLog.findFirst({
    where: { plantId: plant.id },
    orderBy: { wateredAt: "desc" },
  });

  const lastWateredAt = mostRecent!.wateredAt;
  const nextWateringAt = addDays(lastWateredAt, plant.wateringInterval);

  await db.plant.update({
    where: { id: plant.id },
    data: { lastWateredAt, nextWateringAt },
  });

  revalidatePath(HOUSEHOLD_PATHS.dashboard, "page");
  revalidatePath(HOUSEHOLD_PATHS.plantDetail, "page");

  return { success: true, nextWateringAt, plantNickname: plant.nickname };
}

export async function editWateringLog(data: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };
  if (session.user.isDemo) return { error: "Demo mode — sign up to save your changes." };

  const parsed = editWateringLogSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  await requireHouseholdAccess(parsed.data.householdId);

  // Ownership check through plant relation
  const log = await db.wateringLog.findFirst({
    where: {
      id: parsed.data.logId,
      plant: { householdId: parsed.data.householdId },
    },
    include: { plant: true },
  });
  if (!log) return { error: "Log not found." };

  // Update the log
  await db.wateringLog.update({
    where: { id: parsed.data.logId },
    data: {
      wateredAt: parsed.data.wateredAt,
      note: parsed.data.note ?? null,
    },
  });

  // Recalculate nextWateringAt from the most recent log
  const mostRecent = await db.wateringLog.findFirst({
    where: { plantId: log.plantId },
    orderBy: { wateredAt: "desc" },
  });

  if (mostRecent) {
    const nextWateringAt = addDays(
      mostRecent.wateredAt,
      log.plant.wateringInterval
    );
    await db.plant.update({
      where: { id: log.plantId },
      data: {
        lastWateredAt: mostRecent.wateredAt,
        nextWateringAt,
      },
    });
  }

  revalidatePath(HOUSEHOLD_PATHS.dashboard, "page");
  revalidatePath(HOUSEHOLD_PATHS.plantDetail, "page");

  return { success: true };
}

export async function deleteWateringLog(data: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };
  if (session.user.isDemo) return { error: "Demo mode — sign up to save your changes." };

  const parsed = deleteWateringLogSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  await requireHouseholdAccess(parsed.data.householdId);

  // Ownership check through plant relation
  const log = await db.wateringLog.findFirst({
    where: {
      id: parsed.data.logId,
      plant: { householdId: parsed.data.householdId },
    },
    include: { plant: true },
  });
  if (!log) return { error: "Log not found." };

  // Delete the log
  await db.wateringLog.delete({
    where: { id: parsed.data.logId },
  });

  // Recalculate nextWateringAt from remaining logs (Pitfall 4)
  const mostRecent = await db.wateringLog.findFirst({
    where: { plantId: log.plantId },
    orderBy: { wateredAt: "desc" },
  });

  let lastWateredAt: Date | null;
  let nextWateringAt: Date;

  if (mostRecent) {
    // Still have logs — use the most recent
    lastWateredAt = mostRecent.wateredAt;
    nextWateringAt = addDays(mostRecent.wateredAt, log.plant.wateringInterval);
  } else {
    // No logs remain — reset countdown from today
    lastWateredAt = null;
    nextWateringAt = addDays(new Date(), log.plant.wateringInterval);
  }

  await db.plant.update({
    where: { id: log.plantId },
    data: { lastWateredAt, nextWateringAt },
  });

  revalidatePath(HOUSEHOLD_PATHS.dashboard, "page");
  revalidatePath(HOUSEHOLD_PATHS.plantDetail, "page");

  return { success: true };
}

export async function loadMoreWateringHistory(data: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  const parsed = loadMoreWateringHistorySchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  // WR-01: Live membership check — the underlying query filters by
  // plant.householdId, but that only prevents leaks from unrelated households.
  // A removed member could otherwise keep paginating historical data until
  // their session expires. requireHouseholdAccess is the enforcement point.
  await requireHouseholdAccess(parsed.data.householdId);

  return getWateringHistory(parsed.data.plantId, parsed.data.householdId, parsed.data.skip, 20);
}

"use server";

import { auth } from "../../../auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { addDays } from "date-fns";
import { logWateringSchema, editWateringLogSchema } from "./schemas";
import { getWateringHistory } from "./queries";

export async function logWatering(data: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  const parsed = logWateringSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  // Ownership check: only active (non-archived) plants owned by this user
  const plant = await db.plant.findFirst({
    where: {
      id: parsed.data.plantId,
      userId: session.user.id,
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

  // Create the watering log first
  await db.wateringLog.create({
    data: {
      plantId: plant.id,
      wateredAt,
      note: parsed.data.note ?? null,
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

  revalidatePath("/dashboard");
  revalidatePath("/plants/" + plant.id);

  return { success: true, nextWateringAt, plantNickname: plant.nickname };
}

export async function editWateringLog(data: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  const parsed = editWateringLogSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  // Ownership check through plant relation
  const log = await db.wateringLog.findFirst({
    where: {
      id: parsed.data.logId,
      plant: { userId: session.user.id },
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

  revalidatePath("/dashboard");
  revalidatePath("/plants/" + log.plantId);

  return { success: true };
}

export async function deleteWateringLog(logId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  // Ownership check through plant relation
  const log = await db.wateringLog.findFirst({
    where: {
      id: logId,
      plant: { userId: session.user.id },
    },
    include: { plant: true },
  });
  if (!log) return { error: "Log not found." };

  // Delete the log
  await db.wateringLog.delete({
    where: { id: logId },
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

  revalidatePath("/dashboard");
  revalidatePath("/plants/" + log.plantId);

  return { success: true };
}

export async function loadMoreWateringHistory(plantId: string, skip: number) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  return getWateringHistory(plantId, session.user.id, skip, 20);
}

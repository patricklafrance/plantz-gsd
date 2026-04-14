"use server";

import { auth } from "../../../auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { createPlantSchema, editPlantSchema } from "./schemas";
import { addDays } from "date-fns";

export async function createPlant(data: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  const parsed = createPlantSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  const now = new Date();
  const nextWateringAt = addDays(now, parsed.data.wateringInterval);

  const plant = await db.plant.create({
    data: {
      nickname: parsed.data.nickname,
      species: parsed.data.species ?? null,
      roomId: parsed.data.roomId ?? null,
      wateringInterval: parsed.data.wateringInterval,
      careProfileId: parsed.data.careProfileId ?? null,
      userId: session.user.id,
      lastWateredAt: now,
      nextWateringAt: nextWateringAt,
    },
  });

  revalidatePath("/plants");
  revalidatePath("/dashboard");
  return { success: true, plantId: plant.id };
}

export async function updatePlant(data: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  const parsed = editPlantSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  // Verify ownership
  const existing = await db.plant.findFirst({
    where: { id: parsed.data.id, userId: session.user.id },
  });
  if (!existing) return { error: "Plant not found." };

  // Recalculate nextWateringAt if interval changed
  let nextWateringAt = existing.nextWateringAt;
  if (
    parsed.data.wateringInterval !== existing.wateringInterval &&
    existing.lastWateredAt
  ) {
    nextWateringAt = addDays(existing.lastWateredAt, parsed.data.wateringInterval);
  }

  await db.plant.update({
    where: { id: parsed.data.id },
    data: {
      nickname: parsed.data.nickname,
      species: parsed.data.species ?? null,
      roomId:
        parsed.data.roomId === undefined
          ? undefined
          : (parsed.data.roomId ?? null),
      wateringInterval: parsed.data.wateringInterval,
      nextWateringAt: nextWateringAt,
    },
  });

  revalidatePath("/plants");
  revalidatePath("/dashboard");
  revalidatePath(`/plants/${parsed.data.id}`);
  return { success: true };
}

export async function archivePlant(plantId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  const plant = await db.plant.findFirst({
    where: { id: plantId, userId: session.user.id },
  });
  if (!plant) return { error: "Plant not found." };

  await db.plant.update({
    where: { id: plantId },
    data: { archivedAt: new Date() },
  });

  revalidatePath("/plants");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function unarchivePlant(plantId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  const plant = await db.plant.findFirst({
    where: { id: plantId, userId: session.user.id },
  });
  if (!plant) return { error: "Plant not found." };

  await db.plant.update({
    where: { id: plantId },
    data: { archivedAt: null },
  });

  revalidatePath("/plants");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deletePlant(plantId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  const plant = await db.plant.findFirst({
    where: { id: plantId, userId: session.user.id },
  });
  if (!plant) return { error: "Plant not found." };

  await db.plant.delete({
    where: { id: plantId },
  });

  revalidatePath("/plants");
  revalidatePath("/dashboard");
  return { success: true };
}

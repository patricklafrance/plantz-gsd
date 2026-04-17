"use server";

import { auth } from "../../../auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { createPlantSchema, editPlantSchema, plantTargetSchema } from "./schemas";
import { requireHouseholdAccess } from "@/features/household/guards";
import { addDays } from "date-fns";

export async function createPlant(data: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };
  if (session.user.isDemo) return { error: "Demo mode — sign up to save your changes." };

  const parsed = createPlantSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  const { household } = await requireHouseholdAccess(parsed.data.householdId);

  const now = new Date();
  const nextWateringAt = addDays(now, parsed.data.wateringInterval);

  const plant = await db.plant.create({
    data: {
      nickname: parsed.data.nickname,
      species: parsed.data.species ?? null,
      roomId: parsed.data.roomId ?? null,
      wateringInterval: parsed.data.wateringInterval,
      careProfileId: parsed.data.careProfileId ?? null,
      householdId: household.id,
      createdByUserId: session.user.id,
      lastWateredAt: now,
      nextWateringAt,
      reminders: {
        create: { userId: session.user.id, enabled: true },
      },
    },
  });

  revalidatePath("/h/[householdSlug]/plants", "page");
  revalidatePath("/h/[householdSlug]/dashboard", "page");

  return { success: true, plantId: plant.id };
}

export async function updatePlant(data: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };
  if (session.user.isDemo) return { error: "Demo mode — sign up to save your changes." };

  const parsed = editPlantSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  const { household } = await requireHouseholdAccess(parsed.data.householdId);

  const existing = await db.plant.findFirst({
    where: { id: parsed.data.id, householdId: parsed.data.householdId },
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
      nextWateringAt,
    },
  });

  revalidatePath("/h/[householdSlug]/plants", "page");
  revalidatePath("/h/[householdSlug]/plants/[id]", "page");
  revalidatePath("/h/[householdSlug]/dashboard", "page");

  return { success: true };
}

export async function archivePlant(data: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };
  if (session.user.isDemo) return { error: "Demo mode — sign up to save your changes." };

  const parsed = plantTargetSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  const { household } = await requireHouseholdAccess(parsed.data.householdId);

  const plant = await db.plant.findFirst({
    where: { id: parsed.data.plantId, householdId: parsed.data.householdId },
  });
  if (!plant) return { error: "Plant not found." };

  await db.plant.update({
    where: { id: plant.id },
    data: { archivedAt: new Date() },
  });

  revalidatePath("/h/[householdSlug]/plants", "page");
  revalidatePath("/h/[householdSlug]/dashboard", "page");

  return { success: true };
}

export async function unarchivePlant(data: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };
  if (session.user.isDemo) return { error: "Demo mode — sign up to save your changes." };

  const parsed = plantTargetSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  const { household } = await requireHouseholdAccess(parsed.data.householdId);

  const plant = await db.plant.findFirst({
    where: { id: parsed.data.plantId, householdId: parsed.data.householdId },
  });
  if (!plant) return { error: "Plant not found." };

  await db.plant.update({
    where: { id: plant.id },
    data: { archivedAt: null },
  });

  revalidatePath("/h/[householdSlug]/plants", "page");
  revalidatePath("/h/[householdSlug]/dashboard", "page");

  return { success: true };
}

export async function deletePlant(data: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };
  if (session.user.isDemo) return { error: "Demo mode — sign up to save your changes." };

  const parsed = plantTargetSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  const { household } = await requireHouseholdAccess(parsed.data.householdId);

  const plant = await db.plant.findFirst({
    where: { id: parsed.data.plantId, householdId: parsed.data.householdId },
  });
  if (!plant) return { error: "Plant not found." };

  await db.plant.delete({
    where: { id: plant.id },
  });

  revalidatePath("/h/[householdSlug]/plants", "page");
  revalidatePath("/h/[householdSlug]/dashboard", "page");

  return { success: true };
}

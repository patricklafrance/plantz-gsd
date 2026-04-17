"use server";

import { auth } from "../../../auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { createRoomSchema, editRoomSchema, roomTargetSchema } from "./schemas";
import { requireHouseholdAccess } from "@/features/household/guards";

export async function createRoom(data: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };
  if (session.user.isDemo) return { error: "Demo mode — sign up to save your changes." };

  const parsed = createRoomSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  const { household } = await requireHouseholdAccess(parsed.data.householdId);

  const room = await db.room.create({
    data: {
      name: parsed.data.name,
      householdId: household.id,
      createdByUserId: session.user.id,
    },
  });

  revalidatePath("/h/[householdSlug]/rooms", "page");
  revalidatePath("/h/[householdSlug]/plants", "page");

  return { success: true, roomId: room.id };
}

export async function updateRoom(data: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };
  if (session.user.isDemo) return { error: "Demo mode — sign up to save your changes." };

  const parsed = editRoomSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  const { household } = await requireHouseholdAccess(parsed.data.householdId);

  const existing = await db.room.findFirst({
    where: { id: parsed.data.id, householdId: parsed.data.householdId },
  });
  if (!existing) return { error: "Room not found." };

  await db.room.update({
    where: { id: parsed.data.id },
    data: { name: parsed.data.name },
  });

  revalidatePath("/h/[householdSlug]/rooms", "page");
  revalidatePath("/h/[householdSlug]/rooms/[id]", "page");
  revalidatePath("/h/[householdSlug]/plants", "page");

  return { success: true };
}

export async function deleteRoom(data: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };
  if (session.user.isDemo) return { error: "Demo mode — sign up to save your changes." };

  const parsed = roomTargetSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  const { household } = await requireHouseholdAccess(parsed.data.householdId);

  const room = await db.room.findFirst({
    where: { id: parsed.data.roomId, householdId: parsed.data.householdId },
    include: { _count: { select: { plants: true } } },
  });
  if (!room) return { error: "Room not found." };

  // Prisma onDelete: SetNull on Plant.roomId handles plant detach automatically
  await db.room.delete({
    where: { id: room.id },
  });

  revalidatePath("/h/[householdSlug]/rooms", "page");
  revalidatePath("/h/[householdSlug]/plants", "page");
  revalidatePath("/h/[householdSlug]/dashboard", "page");

  return { success: true, hadPlants: room._count.plants > 0 };
}

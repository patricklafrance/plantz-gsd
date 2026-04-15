"use server";

import { auth } from "../../../auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { createRoomSchema, editRoomSchema } from "./schemas";

export async function createRoom(data: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };
  if (session.user.isDemo) return { error: "Demo mode — sign up to save your changes." };

  const parsed = createRoomSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  const room = await db.room.create({
    data: {
      name: parsed.data.name,
      userId: session.user.id,
    },
  });

  revalidatePath("/rooms");
  revalidatePath("/plants");
  return { success: true, roomId: room.id };
}

export async function updateRoom(data: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };
  if (session.user.isDemo) return { error: "Demo mode — sign up to save your changes." };

  const parsed = editRoomSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  const existing = await db.room.findFirst({
    where: { id: parsed.data.id, userId: session.user.id },
  });
  if (!existing) return { error: "Room not found." };

  await db.room.update({
    where: { id: parsed.data.id },
    data: { name: parsed.data.name },
  });

  revalidatePath("/rooms");
  revalidatePath(`/rooms/${parsed.data.id}`);
  revalidatePath("/plants");
  return { success: true };
}

export async function deleteRoom(roomId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };
  if (session.user.isDemo) return { error: "Demo mode — sign up to save your changes." };

  const room = await db.room.findFirst({
    where: { id: roomId, userId: session.user.id },
    include: { _count: { select: { plants: true } } },
  });
  if (!room) return { error: "Room not found." };

  // onDelete behavior: Room->Plant relation uses default (SetNull) so plants
  // are automatically unassigned (roomId set to null) when room is deleted
  await db.room.delete({
    where: { id: roomId },
  });

  revalidatePath("/rooms");
  revalidatePath("/plants");
  revalidatePath("/dashboard");
  return { success: true, hadPlants: room._count.plants > 0 };
}

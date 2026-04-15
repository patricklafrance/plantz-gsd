"use server";

import { auth } from "../../../auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { createNoteSchema, updateNoteSchema, deleteNoteSchema } from "./schemas";
import { getTimeline } from "./queries";

export async function createNote(data: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  const parsed = createNoteSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  // Ownership check: plant belongs to this user (per RESEARCH pitfall 3)
  const plant = await db.plant.findFirst({
    where: { id: parsed.data.plantId, userId: session.user.id },
  });
  if (!plant) return { error: "Plant not found." };

  const note = await db.note.create({
    data: {
      plantId: plant.id,
      content: parsed.data.content,
    },
  });

  revalidatePath("/plants/" + plant.id);

  return { success: true, note };
}

export async function updateNote(data: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  const parsed = updateNoteSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  // Ownership check through plant relation (per RESEARCH pitfall 3)
  const note = await db.note.findFirst({
    where: {
      id: parsed.data.noteId,
      plant: { userId: session.user.id },
    },
    include: { plant: true },
  });
  if (!note) return { error: "Note not found." };

  const updated = await db.note.update({
    where: { id: parsed.data.noteId },
    data: { content: parsed.data.content },
  });

  revalidatePath("/plants/" + note.plantId);

  return { success: true, note: updated };
}

export async function deleteNote(data: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  const parsed = deleteNoteSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  // Ownership check through plant relation (per RESEARCH pitfall 3)
  const note = await db.note.findFirst({
    where: {
      id: parsed.data.noteId,
      plant: { userId: session.user.id },
    },
  });
  if (!note) return { error: "Note not found." };

  await db.note.delete({ where: { id: parsed.data.noteId } });

  revalidatePath("/plants/" + note.plantId);

  return { success: true };
}

export async function loadMoreTimeline(plantId: string, skip: number) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };
  return getTimeline(plantId, session.user.id, skip, 20);
}

"use server";

import { auth } from "../../../auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import {
  createNoteSchema,
  updateNoteSchema,
  deleteNoteSchema,
  loadMoreTimelineSchema,
} from "./schemas";
import { getTimeline } from "./queries";
import { requireHouseholdAccess } from "@/features/household/guards";

export async function createNote(data: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };
  if (session.user.isDemo) return { error: "Demo mode — sign up to save your changes." };

  const parsed = createNoteSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  await requireHouseholdAccess(parsed.data.householdId);

  // Ownership check: plant belongs to this household
  const plant = await db.plant.findFirst({
    where: { id: parsed.data.plantId, householdId: parsed.data.householdId },
  });
  if (!plant) return { error: "Plant not found." };

  const note = await db.note.create({
    data: {
      plantId: plant.id,
      content: parsed.data.content,
      performedByUserId: session.user.id, // AUDT-01
    },
  });

  revalidatePath("/h/[householdSlug]/plants/[id]", "page");

  return { success: true, note };
}

export async function updateNote(data: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };
  if (session.user.isDemo) return { error: "Demo mode — sign up to save your changes." };

  const parsed = updateNoteSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  await requireHouseholdAccess(parsed.data.householdId);

  // Ownership check through plant relation
  const note = await db.note.findFirst({
    where: {
      id: parsed.data.noteId,
      plant: { householdId: parsed.data.householdId },
    },
    include: { plant: true },
  });
  if (!note) return { error: "Note not found." };

  const updated = await db.note.update({
    where: { id: parsed.data.noteId },
    data: { content: parsed.data.content },
  });

  revalidatePath("/h/[householdSlug]/plants/[id]", "page");

  return { success: true, note: updated };
}

export async function deleteNote(data: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };
  if (session.user.isDemo) return { error: "Demo mode — sign up to save your changes." };

  const parsed = deleteNoteSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  await requireHouseholdAccess(parsed.data.householdId);

  // Ownership check through plant relation
  const note = await db.note.findFirst({
    where: {
      id: parsed.data.noteId,
      plant: { householdId: parsed.data.householdId },
    },
  });
  if (!note) return { error: "Note not found." };

  await db.note.delete({ where: { id: parsed.data.noteId } });

  revalidatePath("/h/[householdSlug]/plants/[id]", "page");

  return { success: true };
}

export async function loadMoreTimeline(data: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  const parsed = loadMoreTimelineSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  // WR-01: Live membership check — query filters by plant.householdId but
  // that does not block a removed member from paginating their old household's
  // timeline until the session expires. requireHouseholdAccess is authoritative.
  await requireHouseholdAccess(parsed.data.householdId);

  return getTimeline(parsed.data.plantId, parsed.data.householdId, parsed.data.skip, 20);
}

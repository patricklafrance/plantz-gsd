import { z } from "zod/v4";

export const createNoteSchema = z.object({
  plantId: z.string().min(1, "Plant ID is required."),
  content: z.string().min(1, "Note cannot be empty."),
});

export const updateNoteSchema = z.object({
  noteId: z.string().min(1, "Note ID is required."),
  content: z.string().min(1, "Note cannot be empty."),
});

export const deleteNoteSchema = z.object({
  noteId: z.string().min(1, "Note ID is required."),
});

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
export type DeleteNoteInput = z.infer<typeof deleteNoteSchema>;

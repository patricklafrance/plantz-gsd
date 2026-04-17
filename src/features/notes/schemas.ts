import { z } from "zod/v4";

export const createNoteSchema = z.object({
  householdId: z.string().min(1),
  plantId: z.string().min(1, "Plant ID is required."),
  content: z.string().min(1, "Note cannot be empty.").max(1000, "Note must be 1000 characters or fewer."),
});

export const updateNoteSchema = z.object({
  householdId: z.string().min(1),
  noteId: z.string().min(1, "Note ID is required."),
  content: z.string().min(1, "Note cannot be empty.").max(1000, "Note must be 1000 characters or fewer."),
});

export const deleteNoteSchema = z.object({
  householdId: z.string().min(1),
  noteId: z.string().min(1, "Note ID is required."),
});

export const loadMoreTimelineSchema = z.object({
  householdId: z.string().min(1),
  plantId: z.string().min(1),
  skip: z.number().int().min(0),
});
export type LoadMoreTimelineInput = z.infer<typeof loadMoreTimelineSchema>;

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
export type DeleteNoteInput = z.infer<typeof deleteNoteSchema>;

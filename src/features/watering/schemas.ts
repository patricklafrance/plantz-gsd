import { z } from "zod/v4";

export const logWateringSchema = z.object({
  householdId: z.string().min(1),
  plantId: z.string().min(1, "Plant ID is required."),
  wateredAt: z.coerce
    .date()
    .refine((d) => d <= new Date(), "Cannot log future watering.")
    .optional(),
  note: z
    .string()
    .max(280, "Note must be 280 characters or fewer.")
    .optional(),
});

export const editWateringLogSchema = z.object({
  householdId: z.string().min(1),
  logId: z.string().min(1, "Log ID is required."),
  wateredAt: z.coerce
    .date()
    .refine((d) => d <= new Date(), "Cannot log future watering."),
  note: z
    .string()
    .max(280, "Note must be 280 characters or fewer.")
    .optional(),
});

export const deleteWateringLogSchema = z.object({
  householdId: z.string().min(1),
  logId: z.string().min(1, "Log ID is required."),
});
export type DeleteWateringLogInput = z.infer<typeof deleteWateringLogSchema>;

export const loadMoreWateringHistorySchema = z.object({
  householdId: z.string().min(1),
  plantId: z.string().min(1),
  skip: z.number().int().min(0),
});
export type LoadMoreWateringHistoryInput = z.infer<typeof loadMoreWateringHistorySchema>;

export type LogWateringInput = z.infer<typeof logWateringSchema>;
export type EditWateringLogInput = z.infer<typeof editWateringLogSchema>;

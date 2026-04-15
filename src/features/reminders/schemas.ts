import { z } from "zod/v4";

export const snoozeSchema = z.object({
  plantId: z.string().min(1, "Plant ID is required."),
  days: z.number().int().min(1).max(365),
});

export const snoozeCustomSchema = z.object({
  plantId: z.string().min(1, "Plant ID is required."),
  snoozedUntil: z.coerce.date().refine(
    (date) => date > new Date(),
    "Snooze date must be in the future."
  ),
});

export const toggleReminderSchema = z.object({
  plantId: z.string().min(1, "Plant ID is required."),
  enabled: z.boolean(),
});

export const toggleGlobalRemindersSchema = z.object({
  enabled: z.boolean(),
});

export type SnoozeInput = z.infer<typeof snoozeSchema>;
export type SnoozeCustomInput = z.infer<typeof snoozeCustomSchema>;
export type ToggleReminderInput = z.infer<typeof toggleReminderSchema>;
export type ToggleGlobalRemindersInput = z.infer<typeof toggleGlobalRemindersSchema>;

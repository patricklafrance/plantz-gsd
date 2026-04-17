import { z } from "zod/v4";

export const createPlantSchema = z.object({
  householdId: z.string().min(1),
  nickname: z
    .string()
    .min(1, "Nickname is required.")
    .max(40, "Nickname must be 40 characters or fewer."),
  species: z.string().optional(),
  roomId: z.string().optional(),
  wateringInterval: z
    .number()
    .int()
    .min(1, "Watering interval must be between 1 and 365 days.")
    .max(365, "Watering interval must be between 1 and 365 days."),
  careProfileId: z.string().optional(),
});

export const editPlantSchema = z.object({
  householdId: z.string().min(1),
  id: z.string().min(1),
  nickname: z
    .string()
    .min(1, "Nickname is required.")
    .max(40, "Nickname must be 40 characters or fewer."),
  species: z.string().optional(),
  roomId: z.string().nullable().optional(),
  wateringInterval: z
    .number()
    .int()
    .min(1, "Watering interval must be between 1 and 365 days.")
    .max(365, "Watering interval must be between 1 and 365 days."),
});

export type CreatePlantInput = z.infer<typeof createPlantSchema>;
export type EditPlantInput = z.infer<typeof editPlantSchema>;

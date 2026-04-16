import { z } from "zod/v4";

export const createRoomSchema = z.object({
  name: z
    .string()
    .min(1, "Room name is required.")
    .max(40, "Room name must be 40 characters or fewer."),
});

export const editRoomSchema = z.object({
  id: z.string().min(1),
  name: z
    .string()
    .min(1, "Room name is required.")
    .max(40, "Room name must be 40 characters or fewer."),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type EditRoomInput = z.infer<typeof editRoomSchema>;

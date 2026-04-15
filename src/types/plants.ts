import type { Plant, Room, CareProfile } from "@/generated/prisma/client";

export type PlantWithRelations = Plant & {
  room: Room | null;
  careProfile: CareProfile | null;
};

export type RoomWithPlants = Room & {
  plants: Plant[];
};

export type RoomWithPlantCount = Room & {
  _count: { plants: number };
};

export type CareProfileEntry = Pick<
  CareProfile,
  "id" | "name" | "species" | "wateringInterval" | "lightRequirement" | "notes"
>;

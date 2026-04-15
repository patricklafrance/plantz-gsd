import type {
  Plant,
  Room,
  CareProfile,
  WateringLog,
} from "@/generated/prisma/client";

export type PlantWithRelations = Plant & {
  room: Room | null;
  careProfile: CareProfile | null;
};

export type UrgencyGroup = "overdue" | "dueToday" | "upcoming" | "recentlyWatered";

export type DashboardPlant = Plant & {
  room: Room | null;
  careProfile: CareProfile | null;
  urgency: UrgencyGroup;
  daysUntil: number; // negative = overdue, 0 = due today, positive = upcoming
  latestLog: WateringLog | null;
};

export type PlantWithWateringLogs = Plant & {
  room: Room | null;
  careProfile: CareProfile | null;
  wateringLogs: WateringLog[];
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

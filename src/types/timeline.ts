import type { WateringLog } from "@/generated/prisma/client";

// Note type matches the Prisma Note model shape
export type NoteData = {
  id: string;
  plantId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
};

export type TimelineEntry =
  | { type: "watering"; id: string; timestamp: Date; data: WateringLog }
  | { type: "note"; id: string; timestamp: Date; data: NoteData };

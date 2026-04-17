import { db } from "@/lib/db";
import type { TimelineEntry, NoteData } from "@/types/timeline";
import type { WateringLog } from "@/generated/prisma/client";

/**
 * Pure function: merge and sort watering logs and notes into timeline entries.
 * Exported for unit testing without DB mocking.
 */
export function mergeTimeline(
  wateringLogs: Array<{ id: string; wateredAt: Date; [key: string]: unknown }>,
  notes: NoteData[],
  skip = 0,
  take = 20
): { entries: TimelineEntry[]; total: number } {
  const merged: TimelineEntry[] = [
    ...wateringLogs.map((l) => ({
      type: "watering" as const,
      id: l.id,
      timestamp: l.wateredAt,
      data: l as unknown as WateringLog,
    })),
    ...notes.map((n) => ({
      type: "note" as const,
      id: n.id,
      timestamp: n.createdAt,
      data: n,
    })),
  ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return {
    entries: merged.slice(skip, skip + take),
    total: wateringLogs.length + notes.length,
  };
}

/**
 * Fetches a unified timeline of watering logs and notes for a plant.
 * Merges both types into a sorted array and paginates via skip/take on the merged result.
 *
 * Per RESEARCH A1: fetch-all-then-slice is acceptable at plant scale (<200 entries).
 * Do NOT optimize to DB-level independent pagination — it breaks merged ordering (RESEARCH pitfall 2).
 */
export async function getTimeline(
  plantId: string,
  householdId: string,
  skip = 0,
  take = 20
): Promise<{ entries: TimelineEntry[]; total: number }> {
  const [wateringLogs, notes] = await Promise.all([
    db.wateringLog.findMany({
      where: { plantId, plant: { householdId } },
      orderBy: { wateredAt: "desc" },
    }),
    db.note.findMany({
      where: { plantId, plant: { householdId } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return mergeTimeline(wateringLogs, notes, skip, take);
}

export async function loadMoreTimeline(
  plantId: string,
  householdId: string,
  skip: number,
  take = 20
): Promise<{ entries: TimelineEntry[]; total: number }> {
  return getTimeline(plantId, householdId, skip, take);
}

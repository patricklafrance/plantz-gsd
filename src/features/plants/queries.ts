import { db } from "@/lib/db";

export async function getPlants(userId: string, roomId?: string) {
  return db.plant.findMany({
    where: {
      userId,
      archivedAt: null,
      ...(roomId ? { roomId } : {}),
    },
    include: { room: true, careProfile: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getPlant(plantId: string, userId: string) {
  return db.plant.findFirst({
    where: { id: plantId, userId },
    include: { room: true, careProfile: true },
  });
}

export async function getCatalog() {
  return db.careProfile.findMany({
    orderBy: { name: "asc" },
  });
}

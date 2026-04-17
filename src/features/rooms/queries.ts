import { db } from "@/lib/db";

export async function getRooms(householdId: string) {
  return db.room.findMany({
    where: { householdId },
    include: { _count: { select: { plants: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function getRoom(roomId: string, householdId: string) {
  return db.room.findFirst({
    where: { id: roomId, householdId },
    include: {
      plants: {
        where: { archivedAt: null },
        include: { careProfile: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

export async function getRoomsForSelect(householdId: string) {
  return db.room.findMany({
    where: { householdId },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });
}

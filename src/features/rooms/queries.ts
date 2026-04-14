import { db } from "@/lib/db";

export async function getRooms(userId: string) {
  return db.room.findMany({
    where: { userId },
    include: { _count: { select: { plants: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function getRoom(roomId: string, userId: string) {
  return db.room.findFirst({
    where: { id: roomId, userId },
    include: {
      plants: {
        where: { archivedAt: null },
        include: { careProfile: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

export async function getRoomsForSelect(userId: string) {
  return db.room.findMany({
    where: { userId },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });
}

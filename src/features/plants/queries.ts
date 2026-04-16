import { db } from "@/lib/db";

export const PAGE_SIZE = 20;

export async function getPlants(
  userId: string,
  options: {
    roomId?: string;
    search?: string;
    status?: "overdue" | "due-today" | "upcoming" | "archived";
    sort?: "next-watering" | "name" | "recently-added";
    todayStart?: Date;
    todayEnd?: Date;
    page?: number;
  } = {}
) {
  const { roomId, search, status, sort, todayStart, todayEnd, page = 1 } = options;

  // Archival visibility (default: exclude archived; status=archived: show only archived)
  const archivedFilter =
    status === "archived"
      ? { archivedAt: { not: null } }
      : { archivedAt: null };

  // Watering status filter — only applied for non-archived statuses with date boundaries
  let statusFilter = {};
  if (status && status !== "archived" && todayStart && todayEnd) {
    if (status === "overdue") {
      statusFilter = { nextWateringAt: { lt: todayStart } };
    } else if (status === "due-today") {
      statusFilter = { nextWateringAt: { gte: todayStart, lt: todayEnd } };
    } else if (status === "upcoming") {
      statusFilter = { nextWateringAt: { gte: todayEnd } };
    }
  }

  // Sort mapping — default: alphabetical by name
  const orderBy =
    sort === "next-watering"
      ? { nextWateringAt: "asc" as const }
      : sort === "recently-added"
        ? { createdAt: "desc" as const }
        : { nickname: "asc" as const };

  const where = {
    userId,
    ...archivedFilter,
    ...(roomId ? { roomId } : {}),
    ...(search
      ? {
          OR: [
            { nickname: { contains: search, mode: "insensitive" as const } },
            { species: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...statusFilter,
  };

  const skip = (page - 1) * PAGE_SIZE;

  const [plants, totalCount] = await Promise.all([
    db.plant.findMany({
      where,
      include: { room: true, careProfile: true },
      orderBy,
      skip,
      take: PAGE_SIZE,
    }),
    db.plant.count({ where }),
  ]);

  return {
    plants,
    totalCount,
    totalPages: Math.ceil(totalCount / PAGE_SIZE),
    currentPage: page,
  };
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

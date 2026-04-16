import { auth } from "../../../../../auth";
import { redirect, notFound } from "next/navigation";
import { getRoom } from "@/features/rooms/queries";
import { PlantGrid } from "@/components/plants/plant-grid";
import { DoorOpen } from "lucide-react";
import type { PlantWithRelations } from "@/types/plants";

export default async function RoomDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const room = await getRoom(id, session.user.id);
  if (!room) notFound();

  // Map plants to include the room reference for PlantCard display
  const plantsWithRoom: PlantWithRelations[] = room.plants.map((plant) => ({
    ...plant,
    room: { id: room.id, name: room.name, userId: room.userId, createdAt: room.createdAt, updatedAt: room.updatedAt },
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 tabIndex={-1} className="text-2xl font-semibold outline-none">{room.name}</h1>
        <p className="text-sm text-muted-foreground">
          {room.plants.length}{" "}
          {room.plants.length === 1 ? "plant" : "plants"}
        </p>
      </div>

      {room.plants.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 rounded-full bg-accent/10 p-6">
            <DoorOpen className="h-8 w-8 text-accent" />
          </div>
          <h2 className="text-xl font-semibold">No plants in this room</h2>
          <p className="mt-2 text-muted-foreground">
            Assign plants to this room from their detail page.
          </p>
        </div>
      ) : (
        <PlantGrid plants={plantsWithRoom} />
      )}
    </div>
  );
}

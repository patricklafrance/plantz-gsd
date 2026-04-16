import { auth } from "../../../../../auth";
import { redirect, notFound } from "next/navigation";
import { getRoom } from "@/features/rooms/queries";
import { PlantGrid } from "@/components/plants/plant-grid";
import { EmptyState } from "@/components/shared/empty-state";
import { Leaf } from "lucide-react";
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
        <EmptyState
          icon={Leaf}
          iconVariant="muted"
          heading="No plants in this room"
          body="Assign a plant to this room when adding or editing it."
        />
      ) : (
        <PlantGrid plants={plantsWithRoom} />
      )}
    </div>
  );
}

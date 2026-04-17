import { auth } from "../../../../../../auth";
import { redirect } from "next/navigation";
import { getCurrentHousehold } from "@/features/household/context";
import { getRooms } from "@/features/rooms/queries";
import { RoomCard } from "@/components/rooms/room-card";
import { CreateRoomDialog } from "@/components/rooms/create-room-dialog";
import { QuickCreatePresets } from "@/components/rooms/quick-create-presets";
import { EmptyState } from "@/components/shared/empty-state";
import { DoorOpen } from "lucide-react";
import type { RoomWithPlantCount } from "@/types/plants";

const ROOM_PRESETS = [
  "Living Room",
  "Bedroom",
  "Kitchen",
  "Bathroom",
  "Office",
  "Balcony",
];

export default async function RoomsPage({
  params,
}: {
  params: Promise<{ householdSlug: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { householdSlug } = await params;
  const { household } = await getCurrentHousehold(householdSlug);

  const rooms = await getRooms(household.id);
  const existingNames = rooms.map((r: RoomWithPlantCount) => r.name);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 tabIndex={-1} className="text-2xl font-semibold outline-none">Rooms</h1>
        <CreateRoomDialog householdId={household.id} />
      </div>

      {/* Preset quick-create chips per D-08 */}
      <QuickCreatePresets
        presets={ROOM_PRESETS}
        existingNames={existingNames}
        householdId={household.id}
      />

      {rooms.length === 0 ? (
        <EmptyState
          icon={DoorOpen}
          iconVariant="muted"
          heading="No rooms yet"
          body="Create a room to organize your plants by location."
          action={<CreateRoomDialog householdId={household.id} />}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room: RoomWithPlantCount) => (
            <RoomCard key={room.id} room={room} householdId={household.id} householdSlug={householdSlug} />
          ))}
        </div>
      )}
    </div>
  );
}

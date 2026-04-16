import { auth } from "../../../../auth";
import { redirect } from "next/navigation";
import { getRooms } from "@/features/rooms/queries";
import { RoomCard } from "@/components/rooms/room-card";
import { CreateRoomDialog } from "@/components/rooms/create-room-dialog";
import { QuickCreatePresets } from "@/components/rooms/quick-create-presets";
import { EmptyState } from "@/components/shared/empty-state";
import { DoorOpen } from "lucide-react";

const ROOM_PRESETS = [
  "Living Room",
  "Bedroom",
  "Kitchen",
  "Bathroom",
  "Office",
  "Balcony",
];

export default async function RoomsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const rooms = await getRooms(session.user.id);
  const existingNames = rooms.map((r) => r.name);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 tabIndex={-1} className="text-2xl font-semibold outline-none">Rooms</h1>
        <CreateRoomDialog />
      </div>

      {/* Preset quick-create chips per D-08 */}
      <QuickCreatePresets presets={ROOM_PRESETS} existingNames={existingNames} />

      {rooms.length === 0 ? (
        <EmptyState
          icon={DoorOpen}
          iconVariant="muted"
          heading="No rooms yet"
          body="Create a room to organize your plants by location."
          action={<CreateRoomDialog />}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => (
            <RoomCard key={room.id} room={room} />
          ))}
        </div>
      )}
    </div>
  );
}

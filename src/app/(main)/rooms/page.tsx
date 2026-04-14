import { auth } from "../../../../auth";
import { redirect } from "next/navigation";
import { getRooms } from "@/features/rooms/queries";
import { RoomCard } from "@/components/rooms/room-card";
import { CreateRoomDialog } from "@/components/rooms/create-room-dialog";
import { QuickCreatePresets } from "@/components/rooms/quick-create-presets";
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
    <div className="space-y-lg">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Rooms</h1>
        <CreateRoomDialog />
      </div>

      {/* Preset quick-create chips per D-08 */}
      <QuickCreatePresets presets={ROOM_PRESETS} existingNames={existingNames} />

      {rooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-3xl text-center">
          <div className="mb-md rounded-full bg-accent/10 p-lg">
            <DoorOpen className="h-8 w-8 text-accent" />
          </div>
          <h2 className="text-xl font-semibold">No rooms yet</h2>
          <p className="mt-sm text-muted-foreground">
            Create rooms to organize your plants by location.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          {rooms.map((room) => (
            <RoomCard key={room.id} room={room} />
          ))}
        </div>
      )}
    </div>
  );
}

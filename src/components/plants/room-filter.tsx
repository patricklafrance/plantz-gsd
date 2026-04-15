"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

type Room = { id: string; name: string };

export function RoomFilter({
  rooms,
  activeRoomId,
}: {
  rooms: Room[];
  activeRoomId?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleFilter(roomId?: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (roomId) {
      params.set("room", roomId);
    } else {
      params.delete("room");
    }
    router.push(`/plants?${params.toString()}`);
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      <Button
        variant={!activeRoomId ? "default" : "outline"}
        size="sm"
        onClick={() => handleFilter()}
      >
        All
      </Button>
      {rooms.map((room) => (
        <Button
          key={room.id}
          variant={activeRoomId === room.id ? "default" : "outline"}
          size="sm"
          onClick={() => handleFilter(room.id)}
        >
          {room.name}
        </Button>
      ))}
    </div>
  );
}

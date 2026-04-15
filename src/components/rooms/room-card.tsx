"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CreateRoomDialog } from "@/components/rooms/create-room-dialog";
import { deleteRoom } from "@/features/rooms/actions";
import type { RoomWithPlantCount } from "@/types/plants";

interface RoomCardProps {
  room: RoomWithPlantCount;
}

export function RoomCard({ room }: RoomCardProps) {
  const plantCount = room._count.plants;
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      const result = await deleteRoom(room.id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      if (result.hadPlants) {
        toast("Room deleted. Plants have been unassigned.");
      } else {
        toast("Room deleted.");
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <CreateRoomDialog
        room={{ id: room.id, name: room.name }}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <Card className="flex items-center gap-4 px-4 py-4 hover:shadow-sm transition-shadow">
        {/* Clickable area linking to room detail */}
        <Link
          href={`/rooms/${room.id}`}
          className="flex-1 min-w-0 hover:underline hover:underline-offset-2"
        >
          <p className="text-base font-semibold truncate">{room.name}</p>
          <p className="text-sm text-muted-foreground">
            {plantCount === 0
              ? "No plants"
              : plantCount === 1
                ? "1 plant"
                : `${plantCount} plants`}
          </p>
        </Link>

        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Edit ${room.name}`}
            onClick={(e) => {
              e.preventDefault();
              setEditOpen(true);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>

          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${room.name}`}
                  className="text-destructive hover:bg-destructive/10"
                />
              }
            >
              <Trash2 className="h-4 w-4" />
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete room?</AlertDialogTitle>
                <AlertDialogDescription>
                  {plantCount > 0
                    ? "Move plants to another room before deleting, or they will become unassigned."
                    : "Delete this room? This cannot be undone."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={deleting}
                  className="bg-destructive/10 text-destructive hover:bg-destructive/20"
                >
                  Delete room
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </Card>
    </>
  );
}

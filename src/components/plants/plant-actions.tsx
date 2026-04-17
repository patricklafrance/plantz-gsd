"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Archive, Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

import { archivePlant, unarchivePlant, deletePlant } from "@/features/plants/actions";
import type { PlantWithRelations } from "@/types/plants";

interface PlantActionsProps {
  plant: PlantWithRelations;
  householdId: string;
}

export function PlantActions({ plant, householdId }: PlantActionsProps) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleArchive() {
    setIsArchiving(true);
    const result = await archivePlant({ householdId, plantId: plant.id });
    setIsArchiving(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    router.push("/plants");
    toast("Plant archived.", {
      action: {
        label: "Undo",
        onClick: async () => {
          const undoResult = await unarchivePlant({ householdId, plantId: plant.id });
          if ("error" in undoResult) {
            toast.error(undoResult.error);
          } else {
            toast("Archive undone.");
          }
        },
      },
    });
  }

  async function handleDelete() {
    setIsDeleting(true);
    const result = await deletePlant({ householdId, plantId: plant.id });
    setIsDeleting(false);

    if ("error" in result) {
      toast.error(result.error);
      setDeleteOpen(false);
      return;
    }

    setDeleteOpen(false);
    router.push("/plants");
    toast("Plant deleted.");
  }

  return (
    <div className="flex items-center gap-2">
      {/* Archive button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleArchive}
        disabled={isArchiving}
      >
        <Archive className="h-4 w-4 mr-1" />
        Archive
      </Button>

      {/* Delete button with confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:bg-destructive/10"
            />
          }
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Delete
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete plant?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove {plant.nickname} and all its history.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              Delete plant
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

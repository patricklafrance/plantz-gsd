"use client";

import { useState } from "react";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { MoreVertical, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

import { LogWateringDialog } from "@/components/watering/log-watering-dialog";
import { deleteWateringLog } from "@/features/watering/actions";
import type { WateringLog } from "@/generated/prisma/client";

interface WateringHistoryEntryProps {
  log: WateringLog;
  plantId: string;
  plantNickname: string;
}

function formatRelativeTime(date: Date): string {
  const d = new Date(date);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return formatDistanceToNow(d, { addSuffix: true });
}

export function WateringHistoryEntry({
  log,
  plantId,
  plantNickname,
}: WateringHistoryEntryProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    setIsDeleting(true);
    const result = await deleteWateringLog(log.id);
    setIsDeleting(false);

    if ("error" in result) {
      toast.error(result.error);
      setDeleteOpen(false);
      return;
    }

    setDeleteOpen(false);
    toast("Watering log deleted.");
  }

  return (
    <>
      <div className="flex items-start justify-between py-sm min-h-[44px]">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-sm text-sm">
            <span className="font-medium">
              {format(new Date(log.wateredAt), "MMMM d, yyyy")}
            </span>
            <span className="text-muted-foreground">&middot;</span>
            <span className="text-muted-foreground">
              {formatRelativeTime(log.wateredAt)}
            </span>
          </div>
          {log.note && (
            <p className="mt-xs text-sm text-muted-foreground truncate">
              {log.note}
            </p>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                aria-label="Watering log options"
              />
            }
          >
            <MoreVertical className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setEditOpen(true)}>
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => setDeleteOpen(true)}
              variant="destructive"
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Edit dialog */}
      <LogWateringDialog
        plantId={plantId}
        plantNickname={plantNickname}
        editLog={{
          id: log.id,
          wateredAt: new Date(log.wateredAt),
          note: log.note,
        }}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete watering log?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the log from {plantNickname}&apos;s history and
              recalculate the next watering date.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel variant="ghost">Keep log</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting && (
                <Loader2 className="h-4 w-4 animate-spin mr-sm" />
              )}
              Delete log
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

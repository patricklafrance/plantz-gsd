"use client";

import { useState } from "react";
import { Pencil, Droplets, MoreHorizontal, Loader2 } from "lucide-react";
import {
  format,
  formatDistanceToNow,
  differenceInDays,
  isToday,
  isYesterday,
} from "date-fns";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
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
import { updateNote, deleteNote } from "@/features/notes/actions";
import { deleteWateringLog } from "@/features/watering/actions";
import { LogWateringDialog } from "@/components/watering/log-watering-dialog";
import type { TimelineEntry } from "@/types/timeline";

interface TimelineEntryProps {
  entry: TimelineEntry;
  plantNickname: string;
  onMutated?: () => void;
}

function formatRelativeTime(date: Date): string {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  const diff = differenceInDays(new Date(), date);
  if (diff < 7) return formatDistanceToNow(date, { addSuffix: true });
  return format(date, "MMMM d, yyyy");
}

function TimelineEntryComponent({
  entry,
  plantNickname,
  onMutated,
}: TimelineEntryProps) {
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState(
    entry.type === "note" ? entry.data.content : ""
  );
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editWateringOpen, setEditWateringOpen] = useState(false);

  async function handleSave() {
    if (entry.type !== "note") return;
    const trimmed = editContent.trim();
    if (!trimmed) return;

    setIsSaving(true);
    const result = await updateNote({ noteId: entry.id, content: trimmed });
    setIsSaving(false);

    if ("error" in result) {
      toast.error("Couldn't update note. Try again.");
      return;
    }

    toast("Note updated.");
    setEditMode(false);
    onMutated?.();
  }

  function handleDiscard() {
    setEditMode(false);
    setEditContent(entry.type === "note" ? entry.data.content : "");
  }

  async function handleDelete() {
    setIsDeleting(true);
    const result =
      entry.type === "note"
        ? await deleteNote({ noteId: entry.id })
        : await deleteWateringLog(entry.id);
    setIsDeleting(false);

    if ("error" in result) {
      toast.error(
        entry.type === "note"
          ? "Couldn't delete note. Try again."
          : result.error
      );
      setDeleteOpen(false);
      return;
    }

    toast(entry.type === "note" ? "Note deleted." : "Watering log deleted.");
    setDeleteOpen(false);
    onMutated?.();
  }

  if (entry.type === "watering") {
    const wateredAt = new Date(entry.data.wateredAt);
    return (
      <>
        <div className="flex items-start gap-2 py-2 min-h-[44px]">
          {/* Icon */}
          <div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
            <Droplets className="h-4 w-4 text-blue-500" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium">
              {format(wateredAt, "MMMM d, yyyy")}
            </span>
            <div>
              <time
                dateTime={wateredAt.toISOString()}
                title={format(wateredAt, "MMMM d, yyyy")}
                className="text-xs text-muted-foreground"
              >
                {formatRelativeTime(wateredAt)}
              </time>
            </div>
            {entry.data.note && (
              <p className="text-sm text-muted-foreground">{entry.data.note}</p>
            )}
          </div>

          {/* Kebab menu */}
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
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditWateringOpen(true)}>
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setDeleteOpen(true)}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Edit dialog */}
        <LogWateringDialog
          plantId={entry.data.plantId}
          plantNickname={plantNickname}
          editLog={{
            id: entry.id,
            wateredAt,
            note: entry.data.note,
          }}
          open={editWateringOpen}
          onOpenChange={setEditWateringOpen}
          onEdited={onMutated}
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
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                )}
                Delete log
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  // Note entry
  const noteData = entry.data;
  const isEdited = noteData.updatedAt > noteData.createdAt;

  return (
    <>
      <div className="flex items-start gap-2 py-2 min-h-[44px]">
        {/* Icon */}
        <div className="h-8 w-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
          <Pencil className="h-4 w-4 text-accent" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {editMode ? (
            <>
              <textarea
                className="text-sm w-full resize-none border rounded-md p-2"
                rows={Math.max(2, editContent.split("\n").length)}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                aria-label="Edit note"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    handleSave();
                  }
                  if (e.key === "Escape") {
                    handleDiscard();
                  }
                }}
              />
              <div className="flex gap-2 mt-1">
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving || !editContent.trim()}
                >
                  Save note
                </Button>
                <Button size="sm" variant="ghost" onClick={handleDiscard}>
                  Discard changes
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm">{noteData.content}</p>
              <div className="flex items-center gap-1">
                <time
                  dateTime={entry.timestamp.toISOString()}
                  title={format(entry.timestamp, "MMMM d, yyyy")}
                  className="text-xs text-muted-foreground"
                >
                  {formatRelativeTime(entry.timestamp)}
                </time>
                {isEdited && (
                  <span className="text-xs text-muted-foreground">
                    (edited)
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Kebab menu — only shown when not in edit mode */}
        {!editMode && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  aria-label="Note options"
                />
              }
            >
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  setEditContent(noteData.content);
                  setEditMode(true);
                }}
              >
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setDeleteOpen(true)}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete note?</AlertDialogTitle>
            <AlertDialogDescription>
              This note will be permanently removed from {plantNickname}&apos;s
              timeline.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep note</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              Delete note
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export { TimelineEntryComponent as TimelineEntry };

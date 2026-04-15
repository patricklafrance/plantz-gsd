"use client";

import { useState } from "react";
import { Pencil, Droplets, MoreHorizontal } from "lucide-react";
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
    if (entry.type !== "note") return;

    setIsDeleting(true);
    const result = await deleteNote({ noteId: entry.id });
    setIsDeleting(false);

    if ("error" in result) {
      toast.error("Couldn't delete note. Try again.");
      setDeleteOpen(false);
      return;
    }

    toast("Note deleted.");
    setDeleteOpen(false);
    onMutated?.();
  }

  if (entry.type === "watering") {
    const wateredAt = new Date(entry.data.wateredAt);
    return (
      <div className="flex items-start gap-sm py-sm min-h-[44px]">
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
      </div>
    );
  }

  // Note entry
  const noteData = entry.data;
  const isEdited = noteData.updatedAt > noteData.createdAt;

  return (
    <>
      <div className="flex items-start gap-sm py-sm min-h-[44px]">
        {/* Icon */}
        <div className="h-8 w-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
          <Pencil className="h-4 w-4 text-accent" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {editMode ? (
            <>
              <textarea
                className="text-sm w-full resize-none border rounded-md p-sm"
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
              <div className="flex gap-sm mt-xs">
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
              <div className="flex items-center gap-xs">
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

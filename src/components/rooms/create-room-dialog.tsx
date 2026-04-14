"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createRoom, updateRoom } from "@/features/rooms/actions";

interface CreateRoomDialogProps {
  room?: { id: string; name: string };
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CreateRoomDialog({
  room,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: CreateRoomDialogProps) {
  const isEditMode = !!room;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [name, setName] = useState(room?.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isControlled =
    controlledOpen !== undefined && controlledOnOpenChange !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  function handleOpenChange(val: boolean) {
    if (isControlled) {
      controlledOnOpenChange!(val);
    } else {
      setUncontrolledOpen(val);
    }
    if (!val) {
      // Reset on close
      setName(room?.name ?? "");
      setError(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = name.trim();
    if (!trimmed) {
      setError("Room name is required.");
      return;
    }
    if (trimmed.length > 50) {
      setError("Room name must be 50 characters or fewer.");
      return;
    }

    setSubmitting(true);
    try {
      if (isEditMode) {
        const result = await updateRoom({ id: room.id, name: trimmed });
        if ("error" in result) {
          setError(result.error);
          return;
        }
        toast("Room updated.");
      } else {
        const result = await createRoom({ name: trimmed });
        if ("error" in result) {
          setError(result.error);
          return;
        }
        toast("Room created.");
      }
      handleOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  const defaultTrigger = (
    <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
      <Plus className="h-4 w-4" />
      New room
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!isControlled && (
        <DialogTrigger render={trigger ?? defaultTrigger} />
      )}
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Rename room" : "Create room"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-md mt-sm">
          <div className="space-y-xs">
            <Label htmlFor="room-name">Room name</Label>
            <Input
              id="room-name"
              placeholder="e.g. Living Room"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              autoFocus
            />
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          <div className="flex items-center justify-end gap-sm pt-sm">
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {isEditMode ? "Save changes" : "Create room"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

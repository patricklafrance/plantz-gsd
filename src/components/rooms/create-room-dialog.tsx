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
  householdId: string;
  trigger?: React.ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CreateRoomDialog({
  room,
  householdId,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: CreateRoomDialogProps) {
  const isEditMode = !!room;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [name, setName] = useState(room?.name ?? "");
  const [error, setError] = useState<string | undefined>(undefined);
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
      setError(undefined);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);

    const trimmed = name.trim();
    if (!trimmed) {
      setError("Room name is required.");
      return;
    }
    if (trimmed.length > 40) {
      setError("Room name must be 40 characters or fewer.");
      return;
    }

    setSubmitting(true);
    try {
      if (isEditMode) {
        const result = await updateRoom({ householdId, id: room.id, name: trimmed });
        if ("error" in result) {
          setError(result.error);
          return;
        }
        toast("Room updated.");
      } else {
        const result = await createRoom({ householdId, name: trimmed });
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
      <DialogContent className="sm:max-w-[24rem]">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Rename room" : "Create room"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1">
            <Label htmlFor="room-name">Room name</Label>
            <Input
              id="room-name"
              placeholder="e.g. Living Room"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              autoFocus
            />
            {name.length > 20 && (
              <p className="text-xs text-muted-foreground text-right">
                {name.length}/40
              </p>
            )}
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
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

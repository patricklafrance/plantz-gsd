"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
} from "@/components/shared/responsive-dialog";
import { Button } from "@/components/ui/button";

interface DestructiveLeaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  householdName: string;
  plantCount: number;
  roomCount: number;
  onConfirm: () => Promise<void>;
}

export function DestructiveLeaveDialog({
  open,
  onOpenChange,
  householdName,
  plantCount,
  roomCount,
  onConfirm,
}: DestructiveLeaveDialogProps) {
  const [isPending, setIsPending] = useState(false);

  async function handleConfirm() {
    setIsPending(true);
    try {
      await onConfirm();
    } finally {
      setIsPending(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    // Prevent close-on-outside-click while the server action is in flight,
    // mirroring log-watering-dialog.tsx lines 79–87.
    if (isPending) return;
    onOpenChange(nextOpen);
  }

  const plantWord = plantCount === 1 ? "plant" : "plants";
  const roomWord = roomCount === 1 ? "room" : "rooms";

  return (
    <ResponsiveDialog open={open} onOpenChange={handleOpenChange}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <AlertTriangle
              className="h-5 w-5 text-destructive"
              aria-hidden
            />
            Delete {householdName} and leave?
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            You&apos;re the only member and the only owner. Leaving this
            household will permanently delete it along with everything
            inside it.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <div className="space-y-2 px-4 sm:px-0 text-sm text-muted-foreground">
          <p>This will delete:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              {plantCount} {plantWord} and their watering history
            </li>
            <li>
              {roomCount} {roomWord} and your notes
            </li>
            <li>All reminders and availability periods</li>
          </ul>
          <p className="font-medium text-foreground">
            This can&apos;t be undone.
          </p>
        </div>
        <ResponsiveDialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Keep my household
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isPending}
          >
            Delete household and leave
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

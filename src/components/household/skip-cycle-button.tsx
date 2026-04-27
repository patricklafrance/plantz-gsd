"use client";

import { useState, useTransition } from "react";
import { SkipForward, Loader2 } from "lucide-react";
import { toast } from "sonner";

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
} from "@/components/ui/alert-dialog";
import { skipCurrentCycle } from "@/features/household/actions";

interface SkipCycleButtonProps {
  householdId: string;
  householdSlug: string;
  isDemo?: boolean;
}

/**
 * Phase 8.1 — Inline skip-my-turn button for the dashboard cycle banner.
 *
 * Hands off the current cycle to the next available member. For solo
 * households the rotation engine returns the same member as next, so the
 * cycle effectively rolls forward to a fresh window — same intent.
 *
 * Confirms via AlertDialog because the action is one-way for the current
 * cycle: the rotation comes back around, but you can't un-skip.
 */
export function SkipCycleButton({
  householdId,
  householdSlug,
  isDemo,
}: SkipCycleButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function handleConfirm() {
    if (isDemo) {
      toast.error("Demo mode — sign up to save your changes.");
      setOpen(false);
      return;
    }
    startTransition(async () => {
      const result = await skipCurrentCycle({ householdId, householdSlug });
      setOpen(false);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Skipped — passed to the next member.");
      }
    });
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() => setOpen(true)}
        aria-label="Skip my turn"
      >
        {isPending ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : (
          <SkipForward className="mr-1.5 h-3.5 w-3.5" />
        )}
        Skip my turn
      </Button>

      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (!next) setOpen(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Skip your turn?</AlertDialogTitle>
            <AlertDialogDescription>
              Responsibility moves to the next available member right away.
              You can&apos;t undo this — but the rotation will come back around.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep my turn</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleConfirm}
            >
              Skip my turn
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

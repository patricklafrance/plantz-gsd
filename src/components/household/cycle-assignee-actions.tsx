"use client";

import { useState, useTransition } from "react";
import { Clock, SkipForward, Loader2 } from "lucide-react";
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
import {
  skipCurrentCycle,
  snoozeCurrentCycle,
} from "@/features/household/actions";

interface CycleAssigneeActionsProps {
  householdId: string;
  householdSlug: string;
  isDemo?: boolean;
}

/**
 * Phase 8.1 — Inline assignee-only controls for the dashboard cycle banner.
 *
 * Snooze: same person, defers the cycle window by exactly one cycle duration
 *         (server reads household.cycleDuration). One-shot per cycle.
 * Skip:   next available member, immediate reassignment.
 */
export function CycleAssigneeActions({
  householdId,
  householdSlug,
  isDemo,
}: CycleAssigneeActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [skipOpen, setSkipOpen] = useState(false);

  function blockedInDemo(): boolean {
    if (isDemo) {
      toast.error("Demo mode — sign up to save your changes.");
      return true;
    }
    return false;
  }

  function handleSnooze() {
    if (blockedInDemo()) return;
    startTransition(async () => {
      const result = await snoozeCurrentCycle({ householdId, householdSlug });
      if ("error" in result) {
        toast.error(result.error);
      } else {
        const { days } = result;
        toast.success(
          days === 1
            ? "Snoozed — cycle pushed by 1 day."
            : `Snoozed — cycle pushed by ${days} days.`,
        );
      }
    });
  }

  function handleSkipConfirm() {
    if (blockedInDemo()) {
      setSkipOpen(false);
      return;
    }
    startTransition(async () => {
      const result = await skipCurrentCycle({ householdId, householdSlug });
      setSkipOpen(false);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Skipped — passed to the next member.");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={handleSnooze}
        aria-label="Snooze cycle"
      >
        {isPending ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Clock className="mr-1.5 h-3.5 w-3.5" />
        )}
        Snooze
      </Button>

      <Button
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() => setSkipOpen(true)}
        aria-label="Skip cycle"
      >
        <SkipForward className="mr-1.5 h-3.5 w-3.5" />
        Skip
      </Button>

      <AlertDialog
        open={skipOpen}
        onOpenChange={(open) => {
          if (!open) setSkipOpen(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Skip your turn?</AlertDialogTitle>
            <AlertDialogDescription>
              Responsibility will move to the next available member right away.
              You can&apos;t undo this — but the rotation will come back around.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep my turn</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleSkipConfirm}
            >
              Skip my turn
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

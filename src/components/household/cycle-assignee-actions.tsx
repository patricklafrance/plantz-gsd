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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
 * Snooze:  same person, defers the cycle window by 1/3/7 days.
 * Skip:    next available member, immediate reassignment.
 *
 * Both actions are idempotent in the wider workflow but write authoritatively;
 * the dashboard server component is revalidated on success.
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

  function handleSnooze(days: 1 | 3 | 7) {
    if (blockedInDemo()) return;
    startTransition(async () => {
      const result = await snoozeCurrentCycle({
        householdId,
        householdSlug,
        days,
      });
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success(
          days === 1
            ? "Snoozed — cycle ends 1 day later."
            : `Snoozed — cycle ends ${days} days later.`,
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
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              disabled={isPending}
              aria-label="Snooze cycle"
            >
              {isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Clock className="mr-1.5 h-3.5 w-3.5" />
              )}
              Snooze
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => handleSnooze(1)}>
            1 day
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleSnooze(3)}>
            3 days
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleSnooze(7)}>
            7 days
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

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

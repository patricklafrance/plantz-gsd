"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { snoozeReminder, snoozeCustomReminder } from "@/features/reminders/actions";
import { toast } from "sonner";
import { format } from "date-fns";

const QUICK_SNOOZE_OPTIONS = [
  { label: "1d", days: 1, toastMsg: "Reminder snoozed for 1 day." },
  { label: "2d", days: 2, toastMsg: "Reminder snoozed for 2 days." },
  { label: "1w", days: 7, toastMsg: "Reminder snoozed for 1 week." },
] as const;

interface SnoozePillsProps {
  householdId: string;
  plantId: string;
  isDemo?: boolean;
}

export function SnoozePills({ householdId, plantId, isDemo }: SnoozePillsProps) {
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [isPending, setIsPending] = useState(false);

  async function handleQuickSnooze(days: number, toastMsg: string) {
    if (isDemo) {
      toast.error("Sign up to save changes.");
      return;
    }
    setIsPending(true);
    const result = await snoozeReminder({ householdId, plantId, days });
    setIsPending(false);
    if (result?.error) {
      toast.error("Could not snooze reminder. Try again.");
    } else {
      toast.success(toastMsg);
    }
  }

  async function handleCustomSnooze() {
    if (!selectedDate || isDemo) {
      if (isDemo) toast.error("Sign up to save changes.");
      return;
    }
    setIsPending(true);
    const result = await snoozeCustomReminder({ householdId, plantId, snoozedUntil: selectedDate });
    setIsPending(false);
    if (result?.error) {
      toast.error("Could not snooze reminder. Try again.");
    } else {
      toast.success(`Reminder snoozed until ${format(selectedDate, "MMM d")}.`);
      setIsCustomOpen(false);
      setSelectedDate(undefined);
    }
  }

  return (
    <>
      <div className="space-y-1">
        <span className="text-xs text-muted-foreground">Snooze reminder:</span>
        <div className="flex items-center gap-2">
          {QUICK_SNOOZE_OPTIONS.map(({ label, days, toastMsg }) => (
            <Button
              key={label}
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => handleQuickSnooze(days, toastMsg)}
              disabled={isPending || isDemo}
            >
              {label}
            </Button>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setIsCustomOpen(true)}
            disabled={isPending || isDemo}
          >
            Custom
          </Button>
        </div>
      </div>

      <Dialog open={isCustomOpen} onOpenChange={(open) => setIsCustomOpen(open)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Choose snooze date</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center py-4">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              disabled={(date) => date <= new Date()}
              initialFocus
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setIsCustomOpen(false);
                setSelectedDate(undefined);
              }}
            >
              Keep current schedule
            </Button>
            <Button
              onClick={handleCustomSnooze}
              disabled={!selectedDate || isPending}
            >
              Snooze reminder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

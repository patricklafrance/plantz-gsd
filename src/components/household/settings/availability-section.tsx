"use client";

import { useMemo, useState, useTransition } from "react";
import { format, isBefore, startOfDay } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  createAvailability,
  deleteAvailability,
} from "@/features/household/actions";

/**
 * Availability row shape passed in by the settings Server Component.
 * `userId` drives the "You" label + self-or-owner delete gate.
 */
export type AvailabilityRow = {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  startDate: Date;
  endDate: Date;
  reason: string | null;
};

interface AvailabilitySectionProps {
  availabilities: AvailabilityRow[];
  viewerUserId: string;
  viewerRole: "OWNER" | "MEMBER";
  householdId: string;
  householdSlug: string;
}

export function AvailabilitySection({
  availabilities,
  viewerUserId,
  viewerRole,
  householdId,
  householdSlug,
}: AvailabilitySectionProps) {
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  // "today" wrapped in useMemo so it doesn't recalculate every render —
  // the client-side disabled={(d) => isBefore(d, today)} predicate reads it
  // on every calendar day render.
  const today = useMemo(() => startOfDay(new Date()), []);

  const startDateError =
    startDate && isBefore(startDate, today)
      ? "Start date must be today or in the future"
      : undefined;
  const endDateError =
    startDate && endDate && isBefore(endDate, startDate)
      ? "End date must be on or after start date"
      : undefined;

  const canSubmit = Boolean(
    startDate && endDate && !startDateError && !endDateError && !isPending,
  );

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!startDate || !endDate) return;
    setFormError(undefined);
    startTransition(async () => {
      const result = await createAvailability({
        householdId,
        householdSlug,
        startDate,
        endDate,
        reason: reason.trim() || undefined,
      });
      if ("error" in result) {
        const message = result.error ?? "Couldn't add availability. Try again.";
        setFormError(message);
        toast.error(message);
        return;
      }
      toast.success("Availability period added.");
      setStartDate(undefined);
      setEndDate(undefined);
      setReason("");
    });
  }

  // Future + current only; past rows (endDate < today) filtered at the
  // client per D-29. Sort asc by startDate per D-43.
  const upcoming = useMemo(
    () =>
      availabilities
        .filter((row) => !isBefore(row.endDate, today))
        .sort((a, b) => a.startDate.getTime() - b.startDate.getTime()),
    [availabilities, today],
  );

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Label>Start date</Label>
            <Popover>
              <PopoverTrigger render={<Button type="button" variant="outline" className="w-full justify-start font-normal" aria-label="Start date"><CalendarIcon className="mr-2 h-4 w-4" />{startDate ? format(startDate, "MMM d, yyyy") : "Pick a date"}</Button>} />
              <PopoverContent align="start" className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={(d) => setStartDate(d)}
                  disabled={(d) => isBefore(d, today)}
                />
              </PopoverContent>
            </Popover>
            {startDateError && (
              <p
                role="alert"
                className="text-xs text-destructive mt-1"
              >
                {startDateError}
              </p>
            )}
          </div>
          <div className="flex-1">
            <Label>End date</Label>
            <Popover>
              <PopoverTrigger render={<Button type="button" variant="outline" className="w-full justify-start font-normal" aria-label="End date"><CalendarIcon className="mr-2 h-4 w-4" />{endDate ? format(endDate, "MMM d, yyyy") : "Pick a date"}</Button>} />
              <PopoverContent align="start" className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={(d) => setEndDate(d)}
                  disabled={(d) =>
                    Boolean(startDate && isBefore(d, startDate))
                  }
                />
              </PopoverContent>
            </Popover>
            {endDateError && (
              <p
                role="alert"
                className="text-xs text-destructive mt-1"
              >
                {endDateError}
              </p>
            )}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="availability-reason">
            Reason{" "}
            <span className="text-muted-foreground font-normal">
              (optional)
            </span>
          </Label>
          <Input
            id="availability-reason"
            maxLength={200}
            placeholder="e.g. Vacation, travel"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
        {formError && (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        )}
        <Button type="submit" disabled={!canSubmit}>
          Add unavailability period
        </Button>
      </form>

      {upcoming.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No upcoming availability periods.
        </p>
      ) : (
        <div className="space-y-2">
          {upcoming.map((row) => {
            const displayName =
              row.userId === viewerUserId
                ? "You"
                : row.userName ?? row.userEmail;
            const canDelete =
              row.userId === viewerUserId || viewerRole === "OWNER";
            const formattedDates = `${format(row.startDate, "MMM d")} – ${format(row.endDate, "MMM d, yyyy")}`;
            return (
              <div
                key={row.id}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <div className="flex-1 min-w-0">
                  <span className="font-medium">{displayName}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {formattedDates}
                  </span>
                  {row.reason && (
                    <span className="text-muted-foreground text-xs ml-2">
                      — {row.reason}
                    </span>
                  )}
                </div>
                {canDelete && (
                  <DeleteAvailabilityButton
                    availabilityId={row.id}
                    householdSlug={householdSlug}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DeleteAvailabilityButton({
  availabilityId,
  householdSlug,
}: {
  availabilityId: string;
  householdSlug: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteAvailability({
        availabilityId,
        householdSlug,
      });
      if ("error" in result) {
        toast.error(
          result.error ?? "Couldn't delete availability. Try again.",
        );
        return;
      }
      toast.success("Availability period deleted.");
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={isPending}>Delete</Button>} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete this availability period?
          </AlertDialogTitle>
          <AlertDialogDescription>
            If this was covering an upcoming turn, the rotation may reassign
            that cycle.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Keep it</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending}
          >
            Delete period
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

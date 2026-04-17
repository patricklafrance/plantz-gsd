"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Leaf, BellOff, AlertTriangle, Droplets, Clock, CheckCircle2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { WaterButton } from "./water-button";
import { snoozeReminder } from "@/features/reminders/actions";
import { toast } from "sonner";
import type { DashboardPlant } from "@/types/plants";

interface DashboardPlantCardProps {
  householdId: string;
  householdSlug: string;
  plant: DashboardPlant;
  onWater: () => void;
  isWatering: boolean;
  isRemoving: boolean;
  isDemo?: boolean;
}

function getStatusBadge(plant: DashboardPlant) {
  switch (plant.urgency) {
    case "overdue": {
      const overdueDays = Math.abs(plant.daysUntil);
      return (
        <Badge className="bg-destructive/10 text-destructive border-destructive/20 gap-1.5 items-center">
          <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
          {overdueDays === 0 ? "Overdue" : `${overdueDays}d overdue`}
        </Badge>
      );
    }
    case "dueToday":
      return (
        <Badge className="bg-accent/15 text-accent border-accent/20 gap-1.5 items-center">
          <Droplets className="h-3 w-3 shrink-0" aria-hidden="true" />
          Due today
        </Badge>
      );
    case "upcoming":
      if (plant.daysUntil === 0) {
        return (
          <Badge className="bg-accent/15 text-accent border-accent/20 gap-1.5 items-center">
            <Droplets className="h-3 w-3 shrink-0" aria-hidden="true" />
            Due today
          </Badge>
        );
      }
      return (
        <Badge variant="outline" className="gap-1.5 items-center">
          <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
          In {plant.daysUntil}d
        </Badge>
      );
    case "recentlyWatered": {
      const wateredText = plant.latestLog?.wateredAt
        ? `Watered ${formatDistanceToNow(new Date(plant.latestLog.wateredAt), { addSuffix: false })} ago`
        : "Recently watered";
      return (
        <Badge variant="secondary" className="gap-1.5 items-center">
          <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden="true" />
          {wateredText}
        </Badge>
      );
    }
  }
}

const QUICK_SNOOZE = [
  { label: "1d", days: 1, msg: "Snoozed 1 day" },
  { label: "2d", days: 2, msg: "Snoozed 2 days" },
  { label: "1w", days: 7, msg: "Snoozed 1 week" },
] as const;

function InlineSnoozePills({ householdId, plantId, isDemo }: { householdId: string; plantId: string; isDemo?: boolean }) {
  const [isPending, setIsPending] = useState(false);

  async function handleSnooze(e: React.MouseEvent, days: number, msg: string) {
    e.preventDefault();
    e.stopPropagation();
    if (isDemo) {
      toast.error("Demo mode — sign up to save your changes.");
      return;
    }
    setIsPending(true);
    const result = await snoozeReminder({ householdId, plantId, days });
    setIsPending(false);
    if (result?.error) {
      toast.error("Could not snooze. Try again.");
    } else {
      toast.success(msg);
    }
  }

  return (
    <div className="flex items-center justify-center gap-2">
      <BellOff className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      {QUICK_SNOOZE.map(({ label, days, msg }) => (
        <button
          key={label}
          type="button"
          onClick={(e) => handleSnooze(e, days, msg)}
          disabled={isPending}
          className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/60 hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50 min-h-[44px]"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function DashboardPlantCard({
  householdId,
  householdSlug,
  plant,
  onWater,
  isWatering,
  isRemoving,
  isDemo,
}: DashboardPlantCardProps) {
  const showSnooze = plant.urgency === "overdue" || plant.urgency === "dueToday" || (plant.urgency === "upcoming" && plant.daysUntil === 0);

  return (
    <Link href={`/h/${householdSlug}/plants/${plant.id}`} className="block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
      <Card
        className={cn(
          "flex items-center gap-4 p-4 hover:shadow-sm hover:border-accent/40 transition-shadow cursor-pointer",
          isRemoving &&
            "motion-safe:transition-all motion-safe:duration-300 opacity-0 scale-95"
        )}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent/10">
          <Leaf className="h-5 w-5 text-accent" />
        </div>
        <div className="flex-1 min-w-0 text-center">
          <p className="text-base font-semibold truncate">{plant.nickname}</p>
          <p className="text-sm text-muted-foreground truncate">
            {plant.species ?? "Unknown species"}
          </p>
          <p className="text-xs text-muted-foreground">
            {plant.room?.name ?? "\u00A0"}
          </p>
        </div>
        <div className="shrink-0">{getStatusBadge(plant)}</div>
        <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <WaterButton
            plantNickname={plant.nickname}
            onWater={onWater}
            isWatering={isWatering}
          />
        </div>
        {showSnooze && (
          <div className="w-full" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            <InlineSnoozePills householdId={householdId} plantId={plant.id} isDemo={isDemo} />
          </div>
        )}
      </Card>
    </Link>
  );
}

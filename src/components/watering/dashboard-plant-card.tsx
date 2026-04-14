"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Leaf } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { WaterButton } from "./water-button";
import type { DashboardPlant } from "@/types/plants";

interface DashboardPlantCardProps {
  plant: DashboardPlant;
  onWater: () => void;
  isWatering: boolean;
  isRemoving: boolean;
}

function getStatusBadge(plant: DashboardPlant) {
  switch (plant.urgency) {
    case "overdue":
      return (
        <Badge className="bg-destructive/10 text-destructive border-destructive/20">
          {Math.abs(plant.daysUntil)}d overdue
        </Badge>
      );
    case "dueToday":
      return (
        <Badge className="bg-accent/15 text-accent border-accent/25">
          Due today
        </Badge>
      );
    case "upcoming":
      return (
        <Badge variant="outline">
          In {plant.daysUntil}d
        </Badge>
      );
    case "recentlyWatered": {
      const wateredText = plant.latestLog?.wateredAt
        ? `Watered ${formatDistanceToNow(new Date(plant.latestLog.wateredAt), { addSuffix: false })} ago`
        : "Recently watered";
      return (
        <Badge className="bg-accent/8 text-muted-foreground border-border">
          {wateredText}
        </Badge>
      );
    }
  }
}

export function DashboardPlantCard({
  plant,
  onWater,
  isWatering,
  isRemoving,
}: DashboardPlantCardProps) {
  return (
    <Link href={`/plants/${plant.id}`}>
      <Card
        className={cn(
          "flex items-center gap-md p-md hover:shadow-sm hover:border-accent/40 transition-shadow cursor-pointer",
          isRemoving &&
            "motion-safe:transition-all motion-safe:duration-300 opacity-0 scale-95"
        )}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent/10">
          <Leaf className="h-5 w-5 text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold truncate">{plant.nickname}</p>
          <p className="text-sm text-muted-foreground truncate">
            {plant.species ?? "Unknown species"}
          </p>
          {plant.room && (
            <p className="text-xs text-muted-foreground">{plant.room.name}</p>
          )}
        </div>
        <div className="shrink-0">{getStatusBadge(plant)}</div>
        <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <WaterButton
            plantNickname={plant.nickname}
            onWater={onWater}
            isWatering={isWatering}
          />
        </div>
      </Card>
    </Link>
  );
}

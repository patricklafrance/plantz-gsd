"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Leaf } from "lucide-react";
import { differenceInDays, startOfDay } from "date-fns";
import type { PlantWithRelations } from "@/types/plants";

type WateringStatus = "overdue" | "due-today" | "upcoming" | "not-scheduled";

function getWateringStatus(plant: PlantWithRelations): { status: WateringStatus; label: string; daysUntil: number } {
  if (!plant.nextWateringAt) return { status: "not-scheduled", label: `Every ${plant.wateringInterval}d`, daysUntil: 0 };
  const todayStart = startOfDay(new Date());
  const daysUntil = differenceInDays(new Date(plant.nextWateringAt), todayStart);
  if (daysUntil < 0) {
    const overdueDays = Math.abs(daysUntil);
    return { status: "overdue", label: overdueDays === 0 ? "Overdue" : `${overdueDays}d overdue`, daysUntil };
  }
  if (daysUntil === 0) return { status: "due-today", label: "Due today", daysUntil };
  return { status: "upcoming", label: `In ${daysUntil}d`, daysUntil };
}

function getStatusBadgeClass(status: WateringStatus): string {
  switch (status) {
    case "overdue":
      return "bg-destructive/10 text-destructive border-destructive/20";
    case "due-today":
      return "bg-accent/15 text-accent border-accent/25";
    default:
      return "";
  }
}

export function PlantCard({ plant }: { plant: PlantWithRelations }) {
  const { status, label } = getWateringStatus(plant);

  return (
    <Link href={`/plants/${plant.id}`} className="block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
      <Card className="flex items-center gap-4 p-4 hover:shadow-sm hover:border-accent/40 transition-shadow cursor-pointer">
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
        <Badge
          variant={status === "overdue" || status === "due-today" ? "default" : "outline"}
          className={`shrink-0 text-xs ${getStatusBadgeClass(status)}`}
        >
          {label}
        </Badge>
      </Card>
    </Link>
  );
}

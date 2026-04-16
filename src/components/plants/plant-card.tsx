"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Leaf, AlertTriangle, Droplets, Clock, HelpCircle } from "lucide-react";
import { differenceInDays, startOfDay } from "date-fns";
import type { PlantWithRelations } from "@/types/plants";

function getStatusBadge(plant: PlantWithRelations) {
  if (!plant.nextWateringAt) {
    return (
      <Badge variant="outline" className="gap-1.5 items-center">
        <HelpCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
        Every {plant.wateringInterval}d
      </Badge>
    );
  }
  const todayStart = startOfDay(new Date());
  const daysUntil = differenceInDays(new Date(plant.nextWateringAt), todayStart);
  if (daysUntil < 0) {
    const overdueDays = Math.abs(daysUntil);
    return (
      <Badge className="bg-destructive/10 text-destructive border-destructive/20 gap-1.5 items-center">
        <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
        {overdueDays === 0 ? "Overdue" : `${overdueDays}d overdue`}
      </Badge>
    );
  }
  if (daysUntil === 0) {
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
      In {daysUntil}d
    </Badge>
  );
}

export function PlantCard({ plant }: { plant: PlantWithRelations }) {
  return (
    <Link href={`/plants/${plant.id}`} className="block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
      <Card className="flex items-center gap-4 p-4 hover:shadow-sm hover:border-accent/40 transition-shadow cursor-pointer">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent/10">
          <Leaf className="h-5 w-5 text-accent" />
        </div>
        <div className="flex-1 min-w-0 text-center">
          <p className="text-base font-semibold truncate break-all">{plant.nickname}</p>
          <p className="text-sm text-muted-foreground truncate">
            {plant.species ?? "Unknown species"}
          </p>
          <p className="text-xs text-muted-foreground">
            {plant.room?.name ?? "\u00A0"}
          </p>
        </div>
        <div className="shrink-0">{getStatusBadge(plant)}</div>
      </Card>
    </Link>
  );
}

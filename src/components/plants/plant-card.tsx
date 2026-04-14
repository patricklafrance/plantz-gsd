"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Leaf } from "lucide-react";
import { differenceInDays } from "date-fns";
import type { PlantWithRelations } from "@/types/plants";

export function PlantCard({ plant }: { plant: PlantWithRelations }) {
  const statusText = getWateringStatusText(plant);

  return (
    <Link href={`/plants/${plant.id}`}>
      <Card className="flex items-center gap-md p-md hover:shadow-sm hover:border-accent/40 transition-shadow cursor-pointer">
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
        <Badge variant="outline" className="shrink-0 text-xs">
          {statusText}
        </Badge>
      </Card>
    </Link>
  );
}

function getWateringStatusText(plant: PlantWithRelations): string {
  if (!plant.nextWateringAt) return `Every ${plant.wateringInterval}d`;
  const daysUntil = differenceInDays(new Date(plant.nextWateringAt), new Date());
  if (daysUntil < 0) return "Overdue";
  if (daysUntil === 0) return "Due today";
  return `${daysUntil}d`;
}

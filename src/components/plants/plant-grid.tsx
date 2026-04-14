"use client";

import { PlantCard } from "./plant-card";
import type { PlantWithRelations } from "@/types/plants";

export function PlantGrid({ plants }: { plants: PlantWithRelations[] }) {
  return (
    <div className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-3">
      {plants.map((plant) => (
        <PlantCard key={plant.id} plant={plant} />
      ))}
    </div>
  );
}

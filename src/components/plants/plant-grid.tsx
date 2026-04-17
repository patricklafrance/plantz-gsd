"use client";

import { PlantCard } from "./plant-card";
import type { PlantWithRelations } from "@/types/plants";

function groupByRoom(plants: PlantWithRelations[]) {
  const groups = new Map<string, { name: string; plants: PlantWithRelations[] }>();

  for (const plant of plants) {
    const key = plant.room?.id ?? "__no_room__";
    const name = plant.room?.name ?? "No room";
    if (!groups.has(key)) {
      groups.set(key, { name, plants: [] });
    }
    groups.get(key)!.plants.push(plant);
  }

  // Named rooms first (alphabetical), "No room" last
  const sorted = [...groups.entries()].sort(([keyA, a], [keyB, b]) => {
    if (keyA === "__no_room__") return 1;
    if (keyB === "__no_room__") return -1;
    return a.name.localeCompare(b.name);
  });

  return sorted.map(([, group]) => group);
}

export function PlantGrid({ plants, householdSlug }: { plants: PlantWithRelations[]; householdSlug: string }) {
  const roomGroups = groupByRoom(plants);

  // If only one group, skip the room headers
  if (roomGroups.length <= 1) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plants.map((plant) => (
          <PlantCard key={plant.id} plant={plant} householdSlug={householdSlug} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {roomGroups.map((group) => (
        <div key={group.name}>
          <h2 className="mb-3 text-base font-semibold">
            {group.name}{" "}
            <span className="text-muted-foreground font-normal">
              ({group.plants.length})
            </span>
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {group.plants.map((plant) => (
              <PlantCard key={plant.id} plant={plant} householdSlug={householdSlug} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

"use client";

import { useOptimistic, useState, startTransition } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { logWatering } from "@/features/watering/actions";
import { DashboardSection } from "./dashboard-section";
import { DashboardPlantCard } from "./dashboard-plant-card";
import type { DashboardPlant } from "@/types/plants";

type GroupedDashboardPlants = {
  overdue: DashboardPlant[];
  dueToday: DashboardPlant[];
  upcoming: DashboardPlant[];
  recentlyWatered: DashboardPlant[];
};

interface DashboardClientProps {
  groups: GroupedDashboardPlants;
}

function removePlantFromGroups(
  current: GroupedDashboardPlants,
  plantId: string
): GroupedDashboardPlants {
  return {
    overdue: current.overdue.filter((p) => p.id !== plantId),
    dueToday: current.dueToday.filter((p) => p.id !== plantId),
    upcoming: current.upcoming.filter((p) => p.id !== plantId),
    recentlyWatered: current.recentlyWatered.filter((p) => p.id !== plantId),
  };
}

export function DashboardClient({ groups }: DashboardClientProps) {
  const [optimisticGroups, removeFromGroups] = useOptimistic(
    groups,
    removePlantFromGroups
  );
  const [wateringPlantIds, setWateringPlantIds] = useState<Set<string>>(
    new Set()
  );
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

  function handleWater(plant: DashboardPlant) {
    // Add to removing set for fade-out animation
    setRemovingIds((prev) => new Set(prev).add(plant.id));
    setWateringPlantIds((prev) => new Set(prev).add(plant.id));

    startTransition(async () => {
      // Optimistically remove from groups — stays applied until transition ends
      removeFromGroups(plant.id);

      const result = await logWatering({ plantId: plant.id });

      // Clean up local state
      setWateringPlantIds((prev) => {
        const next = new Set(prev);
        next.delete(plant.id);
        return next;
      });
      setRemovingIds((prev) => {
        const next = new Set(prev);
        next.delete(plant.id);
        return next;
      });

      if (!result) {
        toast.error("Couldn't log watering. Try again.");
        return;
      }

      if ("error" in result) {
        if (result.error === "DUPLICATE") {
          toast("Already logged! Edit from history if needed.");
        } else {
          toast.error("Couldn't log watering. Try again.");
        }
        return;
      }

      if ("success" in result && result.success) {
        toast(
          plant.nickname +
            " watered! Next: " +
            format(new Date(result.nextWateringAt), "MMM d")
        );
      }
    });
  }

  const sections = [
    { key: "overdue", title: "Overdue", plants: optimisticGroups.overdue },
    { key: "dueToday", title: "Due Today", plants: optimisticGroups.dueToday },
    { key: "upcoming", title: "Upcoming", plants: optimisticGroups.upcoming },
    {
      key: "recentlyWatered",
      title: "Recently Watered",
      plants: optimisticGroups.recentlyWatered,
    },
  ].filter((s) => s.plants.length > 0);

  return (
    <div className="space-y-xl">
      {sections.map((section, index) => (
        <DashboardSection
          key={section.key}
          title={section.title}
          plants={section.plants}
          showSeparator={index > 0}
          renderCard={(plant) => (
            <DashboardPlantCard
              key={plant.id}
              plant={plant}
              onWater={() => handleWater(plant)}
              isWatering={wateringPlantIds.has(plant.id)}
              isRemoving={removingIds.has(plant.id)}
            />
          )}
        />
      ))}
    </div>
  );
}

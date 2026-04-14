import { auth } from "../../../../auth";
import { redirect } from "next/navigation";
import { getPlants, getCatalog } from "@/features/plants/queries";
import { getRoomsForSelect } from "@/features/rooms/queries";
import { PlantGrid } from "@/components/plants/plant-grid";
import { AddPlantDialog } from "@/components/plants/add-plant-dialog";
import { Leaf } from "lucide-react";

export default async function PlantsPage({
  searchParams,
}: {
  searchParams: Promise<{ room?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const params = await searchParams;
  const [plants, catalog, rooms] = await Promise.all([
    getPlants(session.user.id, params.room),
    getCatalog(),
    getRoomsForSelect(session.user.id),
  ]);

  return (
    <div className="space-y-lg">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">My Plants</h1>
        <AddPlantDialog catalog={catalog} rooms={rooms} />
      </div>

      {plants.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-3xl text-center">
          <div className="mb-md rounded-full bg-accent/10 p-lg">
            <Leaf className="h-8 w-8 text-accent" />
          </div>
          <h2 className="text-xl font-semibold">No plants yet</h2>
          <p className="mt-sm text-muted-foreground">
            Add your first plant to start tracking your watering schedule.
          </p>
          <div className="mt-lg">
            <AddPlantDialog catalog={catalog} rooms={rooms} />
          </div>
        </div>
      ) : (
        <PlantGrid plants={plants} />
      )}
    </div>
  );
}

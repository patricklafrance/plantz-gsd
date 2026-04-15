import { auth } from "../../../../../auth";
import { redirect, notFound } from "next/navigation";
import { getPlant } from "@/features/plants/queries";
import { getRoomsForSelect } from "@/features/rooms/queries";
import { getTimeline } from "@/features/notes/queries";
import { PlantDetail } from "@/components/plants/plant-detail";
import { EditPlantDialog } from "@/components/plants/edit-plant-dialog";
import { PlantActions } from "@/components/plants/plant-actions";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default async function PlantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const [plant, rooms, { entries: timelineEntries, total: timelineTotal }] =
    await Promise.all([
      getPlant(id, session.user.id),
      getRoomsForSelect(session.user.id),
      getTimeline(id, session.user.id),
    ]);

  if (!plant) notFound();

  return (
    <div className="space-y-lg">
      <div className="flex items-center gap-sm">
        <Link
          href="/plants"
          className="flex items-center gap-xs text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Plants
        </Link>
      </div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{plant.nickname}</h1>
        <div className="flex items-center gap-sm">
          <EditPlantDialog plant={plant} rooms={rooms} />
          <PlantActions plant={plant} />
        </div>
      </div>
      <PlantDetail
        plant={plant}
        timelineEntries={timelineEntries}
        timelineTotal={timelineTotal}
      />
    </div>
  );
}

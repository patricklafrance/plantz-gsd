import { auth } from "../../../../../auth";
import { redirect, notFound } from "next/navigation";
import { getPlant } from "@/features/plants/queries";
import { getRoomsForSelect } from "@/features/rooms/queries";
import { getTimeline } from "@/features/notes/queries";
import { getPlantReminder } from "@/features/reminders/queries";
import { db } from "@/lib/db";
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

  const [reminder, user] = await Promise.all([
    getPlantReminder(plant.id, session.user.id),
    db.user.findUnique({
      where: { id: session.user.id },
      select: { remindersEnabled: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href="/plants"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors p-2 -m-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Plants
        </Link>
      </div>
      <div className="flex items-center justify-between">
        <h1 tabIndex={-1} className="text-2xl font-semibold outline-none">{plant.nickname}</h1>
        <div className="flex items-center gap-2">
          <EditPlantDialog plant={plant} rooms={rooms} />
          <PlantActions plant={plant} />
        </div>
      </div>
      <PlantDetail
        plant={plant}
        timelineEntries={timelineEntries}
        timelineTotal={timelineTotal}
        reminderEnabled={reminder?.enabled ?? true}
        globalRemindersEnabled={user?.remindersEnabled ?? true}
        isDemo={session.user.isDemo ?? false}
      />
    </div>
  );
}

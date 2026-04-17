"use client";

import { differenceInDays, format, startOfDay } from "date-fns";
import { Sun, CloudSun, Cloud } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Timeline } from "@/components/timeline/timeline";
import { LogWateringDialog } from "@/components/watering/log-watering-dialog";
import { SnoozePills } from "@/components/reminders/snooze-pills";
import { PlantReminderToggle } from "@/components/reminders/plant-reminder-toggle";
import type { PlantWithRelations } from "@/types/plants";
import type { TimelineEntry as TimelineEntryType } from "@/types/timeline";

interface PlantDetailProps {
  householdId: string;
  plant: PlantWithRelations;
  timelineEntries: TimelineEntryType[];
  timelineTotal: number;
  reminderEnabled: boolean;
  globalRemindersEnabled: boolean;
  isDemo?: boolean;
}

function getLightIcon(lightRequirement: string | null) {
  switch (lightRequirement) {
    case "bright":
      return <Sun className="h-4 w-4 text-amber-500" />;
    case "medium":
      return <CloudSun className="h-4 w-4 text-amber-400" />;
    case "low":
      return <Cloud className="h-4 w-4 text-muted-foreground" />;
    default:
      return null;
  }
}

function getLightLabel(lightRequirement: string | null) {
  switch (lightRequirement) {
    case "bright":
      return "Bright light";
    case "medium":
      return "Medium light";
    case "low":
      return "Low light";
    default:
      return "Not specified";
  }
}

export function PlantDetail({
  householdId,
  plant,
  timelineEntries,
  timelineTotal,
  reminderEnabled,
  globalRemindersEnabled,
  isDemo,
}: PlantDetailProps) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const nextWatering = plant.nextWateringAt;

  let wateringStatus: "not-scheduled" | "overdue" | "due-today" | "upcoming" =
    "not-scheduled";
  let daysUntilWatering = 0;

  if (nextWatering) {
    daysUntilWatering = differenceInDays(nextWatering, todayStart);
    if (daysUntilWatering < 0) {
      wateringStatus = "overdue";
    } else if (daysUntilWatering === 0) {
      wateringStatus = "due-today";
    } else {
      wateringStatus = "upcoming";
    }
  }

  return (
    <div className="space-y-6">
      {/* Status card */}
      <Card>
        <CardHeader>
          <CardTitle>Next watering</CardTitle>
        </CardHeader>
        <CardContent>
          {wateringStatus === "not-scheduled" && (
            <p className="text-muted-foreground text-sm">Not yet scheduled</p>
          )}
          {wateringStatus === "overdue" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="destructive">Overdue</Badge>
                <span className="text-sm text-destructive">
                  {Math.abs(daysUntilWatering) === 0
                    ? "Since today"
                    : `${Math.abs(daysUntilWatering)} day${Math.abs(daysUntilWatering) !== 1 ? "s" : ""} overdue`}
                </span>
              </div>
              <SnoozePills householdId={householdId} plantId={plant.id} isDemo={isDemo} />
            </div>
          )}
          {wateringStatus === "due-today" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="default">Due today</Badge>
                {nextWatering && (
                  <span className="text-sm text-muted-foreground">
                    {format(nextWatering, "MMMM d, yyyy")}
                  </span>
                )}
              </div>
              <SnoozePills householdId={householdId} plantId={plant.id} isDemo={isDemo} />
            </div>
          )}
          {wateringStatus === "upcoming" && (
            <div className="flex flex-col gap-1">
              {nextWatering && (
                <p className="text-sm font-medium">
                  {format(nextWatering, "MMMM d, yyyy")}
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                In {daysUntilWatering} day
                {daysUntilWatering !== 1 ? "s" : ""}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Care info card */}
      <Card>
        <CardHeader>
          <CardTitle>Care info</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-2">
            <div className="flex items-center justify-between">
              <dt className="text-sm text-muted-foreground">Species</dt>
              <dd className="text-sm font-medium">
                {plant.species ?? "Not specified"}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-sm text-muted-foreground">
                Watering interval
              </dt>
              <dd className="text-sm font-medium">
                Every {plant.wateringInterval} day
                {plant.wateringInterval !== 1 ? "s" : ""}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-sm text-muted-foreground">Light</dt>
              <dd className="flex items-center gap-1 text-sm font-medium">
                {getLightIcon(plant.careProfile?.lightRequirement ?? null)}
                {getLightLabel(plant.careProfile?.lightRequirement ?? null)}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-sm text-muted-foreground">Room</dt>
              <dd className="text-sm font-medium">
                {plant.room?.name ?? "No room assigned"}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Reminder settings */}
      <Card>
        <CardHeader>
          <CardTitle>Reminder settings</CardTitle>
        </CardHeader>
        <CardContent>
          <PlantReminderToggle
            householdId={householdId}
            plantId={plant.id}
            initialEnabled={reminderEnabled}
            globalRemindersEnabled={globalRemindersEnabled}
            isDemo={isDemo}
          />
        </CardContent>
      </Card>

      {/* Timeline card (per D-01: replaces separate Watering history + Notes cards) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Timeline</CardTitle>
          <LogWateringDialog householdId={householdId} plantId={plant.id} plantNickname={plant.nickname} />
        </CardHeader>
        <CardContent>
          <Timeline
            householdId={householdId}
            plantId={plant.id}
            plantNickname={plant.nickname}
            initialEntries={timelineEntries}
            totalCount={timelineTotal}
          />
        </CardContent>
      </Card>
    </div>
  );
}

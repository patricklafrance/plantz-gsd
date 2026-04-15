"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { togglePlantReminder } from "@/features/reminders/actions";
import { toast } from "sonner";

interface PlantReminderToggleProps {
  plantId: string;
  initialEnabled: boolean;
  globalRemindersEnabled: boolean;
  isDemo?: boolean;
}

export function PlantReminderToggle({
  plantId,
  initialEnabled,
  globalRemindersEnabled,
  isDemo,
}: PlantReminderToggleProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isPending, setIsPending] = useState(false);

  async function handleToggle(checked: boolean) {
    if (isDemo) {
      toast.error("Sign up to save changes.");
      return;
    }

    // Optimistic update
    setEnabled(checked);
    setIsPending(true);

    const result = await togglePlantReminder({ plantId, enabled: checked });
    setIsPending(false);

    if (result?.error) {
      // Revert on error
      setEnabled(!checked);
      toast.error("Could not save preferences. Try again.");
    } else {
      toast.success("Preferences saved.");
    }
  }

  const isDisabled = !globalRemindersEnabled || isPending || !!isDemo;

  return (
    <div className="flex items-center justify-between">
      <div className="space-y-0.5">
        <label
          htmlFor="plant-reminder-toggle"
          className="text-sm font-semibold"
        >
          Reminders for this plant
        </label>
        {!globalRemindersEnabled && (
          <p className="text-xs text-muted-foreground">
            Enable reminders globally in Preferences to activate.
          </p>
        )}
      </div>
      <Switch
        id="plant-reminder-toggle"
        checked={enabled}
        onCheckedChange={handleToggle}
        disabled={isDisabled}
        aria-label="Reminders for this plant"
      />
    </div>
  );
}

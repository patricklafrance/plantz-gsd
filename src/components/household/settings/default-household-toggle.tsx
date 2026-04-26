"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { setDefaultHousehold } from "@/features/household/actions";

type DefaultHouseholdToggleProps = {
  householdId: string;
  isDefault: boolean;
};

export function DefaultHouseholdToggle({
  householdId,
  isDefault: initialIsDefault,
}: DefaultHouseholdToggleProps) {
  const [isDefault, setIsDefault] = useState(initialIsDefault);
  const [isPending, startTransition] = useTransition();

  function handleChange(next: boolean) {
    if (!next || isDefault) return;
    setIsDefault(true);
    startTransition(async () => {
      const result = await setDefaultHousehold({ householdId });
      if ("error" in result) {
        setIsDefault(false);
        toast.error(result.error);
      } else {
        toast.success("Default household updated.");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor="default-household-toggle"
        className="text-sm font-medium text-muted-foreground"
        title="Opens first when you sign in or follow a dashboard link."
      >
        Default household
      </label>
      <Switch
        id="default-household-toggle"
        checked={isDefault}
        onCheckedChange={handleChange}
        disabled={isPending || isDefault}
        aria-label="Default household"
      />
    </div>
  );
}

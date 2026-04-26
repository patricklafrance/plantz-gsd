"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setDefaultHousehold } from "@/features/household/actions";

type HouseholdOption = {
  id: string;
  name: string;
};

type DefaultHouseholdSelectProps = {
  households: HouseholdOption[];
  defaultHouseholdId: string;
};

export function DefaultHouseholdSelect({
  households,
  defaultHouseholdId,
}: DefaultHouseholdSelectProps) {
  const [selectedId, setSelectedId] = useState(defaultHouseholdId);
  const [isPending, startTransition] = useTransition();

  function handleChange(nextId: string) {
    if (nextId === selectedId) return;

    const previousId = selectedId;
    setSelectedId(nextId);

    startTransition(async () => {
      const result = await setDefaultHousehold({ householdId: nextId });
      if ("error" in result) {
        setSelectedId(previousId);
        toast.error(result.error);
      } else {
        const next = households.find((h) => h.id === nextId);
        toast.success(
          next
            ? `${next.name} is now your default household.`
            : "Default household updated.",
        );
      }
    });
  }

  return (
    <Select
      value={selectedId}
      onValueChange={handleChange}
      disabled={isPending}
    >
      <SelectTrigger className="w-full" aria-label="Default household">
        <SelectValue>
          {(value: string) =>
            households.find((h) => h.id === value)?.name ?? ""
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {households.map((h) => (
          <SelectItem key={h.id} value={h.id}>
            {h.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

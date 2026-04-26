"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setDefaultHousehold } from "@/features/household/actions";

type DefaultHouseholdButtonProps = {
  householdId: string;
  householdName: string;
  isDefault: boolean;
};

export function DefaultHouseholdButton({
  householdId,
  householdName,
  isDefault,
}: DefaultHouseholdButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await setDefaultHousehold({ householdId });
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success(`${householdName} is now your default household.`);
      }
    });
  }

  if (isDefault) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Star
          className="h-4 w-4 fill-accent text-accent"
          aria-hidden="true"
        />
        This is your default household.
      </p>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleClick}
      disabled={isPending}
    >
      Make this my default household
    </Button>
  );
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { seedStarterPlants } from "@/features/demo/actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const PLANT_RANGES = ["1-5 plants", "6-15 plants", "16-30 plants", "30+ plants"] as const;

interface DemoToolsFormProps {
  householdId: string;
}

export function DemoToolsForm({ householdId }: DemoToolsFormProps) {
  const [selectedRange, setSelectedRange] = useState<string>("1-5 plants");
  const [isSeeding, setIsSeeding] = useState(false);

  async function handleSeed() {
    if (!confirm(
      `Seed "${selectedRange}" worth of random starter plants into this household? ` +
      `This is for testing/demo purposes and cannot be undone automatically.`
    )) {
      return;
    }

    setIsSeeding(true);
    const result = await seedStarterPlants(selectedRange, householdId);
    setIsSeeding(false);

    if (result && "error" in result) {
      toast.error(`Could not seed plants: ${result.error}`);
      return;
    }

    if (result && "success" in result) {
      toast.success(`Seeded ${result.count} plant${result.count === 1 ? "" : "s"}.`);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-medium">How many plants to seed?</p>
        <div className="flex flex-wrap gap-2">
          {PLANT_RANGES.map((range) => {
            const isSelected = selectedRange === range;
            return (
              <Button
                key={range}
                type="button"
                variant="outline"
                className={cn(
                  "h-11",
                  isSelected && "border-accent border-2 text-accent bg-accent/10",
                )}
                onClick={() => setSelectedRange(range)}
                disabled={isSeeding}
                aria-pressed={isSelected}
              >
                {range}
              </Button>
            );
          })}
        </div>
      </div>

      <Button
        type="button"
        onClick={handleSeed}
        disabled={isSeeding}
        aria-busy={isSeeding}
      >
        {isSeeding && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        Seed starter plants
      </Button>
    </div>
  );
}

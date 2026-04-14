"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createRoom } from "@/features/rooms/actions";

interface QuickCreatePresetsProps {
  presets: string[];
  existingNames: string[];
}

export function QuickCreatePresets({
  presets,
  existingNames,
}: QuickCreatePresetsProps) {
  const [creating, setCreating] = useState<string | null>(null);

  async function handlePresetClick(name: string) {
    if (existingNames.includes(name)) return;
    setCreating(name);
    try {
      const result = await createRoom({ name });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast("Room created.");
    } finally {
      setCreating(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-sm">
      {presets.map((preset) => {
        const exists = existingNames.includes(preset);
        return (
          <Button
            key={preset}
            variant="outline"
            size="sm"
            disabled={exists || creating === preset}
            onClick={() => handlePresetClick(preset)}
            className={exists ? "opacity-50 cursor-not-allowed" : undefined}
          >
            {preset}
          </Button>
        );
      })}
    </div>
  );
}

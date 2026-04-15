"use client";

import { Button } from "@/components/ui/button";
import { Droplet, Loader2 } from "lucide-react";

interface WaterButtonProps {
  plantNickname: string;
  onWater: () => void;
  isWatering: boolean;
  disabled?: boolean;
}

export function WaterButton({
  plantNickname,
  onWater,
  isWatering,
  disabled,
}: WaterButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-11 w-11 shrink-0 rounded-full bg-accent/10 hover:bg-accent/20 text-accent hover:text-accent-foreground hover:bg-accent"
      aria-label={`Water ${plantNickname}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onWater();
      }}
      disabled={isWatering || disabled}
    >
      {isWatering ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <Droplet className="h-5 w-5" />
      )}
    </Button>
  );
}

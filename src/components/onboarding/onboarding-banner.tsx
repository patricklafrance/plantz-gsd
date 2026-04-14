"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Leaf, X } from "lucide-react";
import { completeOnboarding } from "@/features/auth/actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const PLANT_RANGES = ["1-5 plants", "6-15 plants", "16-30 plants", "30+ plants"] as const;

interface OnboardingBannerProps {
  userId: string;
}

export function OnboardingBanner({ userId }: OnboardingBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [selectedRange, setSelectedRange] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [shouldRender, setShouldRender] = useState(true);
  const [isCollapsing, setIsCollapsing] = useState(false);

  // When dismissed changes to true, start collapse animation
  useEffect(() => {
    if (dismissed) {
      setIsCollapsing(true);
      const timer = setTimeout(() => setShouldRender(false), 300);
      return () => clearTimeout(timer);
    }
  }, [dismissed]);

  if (!shouldRender) return null;

  async function handleRangeSelect(range: string) {
    setSelectedRange(range);
    setIsCompleting(true);

    const result = await completeOnboarding({
      userId,
      plantCountRange: range,
    });

    setIsCompleting(false);

    if (result && "error" in result) {
      toast.error("Something went wrong. Please try again.");
      setSelectedRange(null);
      return;
    }

    setIsCompleted(true);
    // Collapse banner after brief confirmation display
    setTimeout(() => setDismissed(true), 1500);
  }

  return (
    <div
      className={cn(
        "transition-all duration-300 ease-out",
        isCollapsing ? "max-h-0 opacity-0 overflow-hidden" : "max-h-96 opacity-100"
      )}
    >
      <Card
        className="relative overflow-hidden border border-accent/30 bg-accent/15"
        style={{ borderRadius: "var(--radius-lg)" }}
      >
        <div className="flex flex-col gap-md p-md sm:flex-row sm:items-center sm:gap-lg sm:p-lg">
          <Leaf className="h-6 w-6 shrink-0 text-accent" />

          <div className="flex-1 space-y-xs">
            <p className="text-base font-medium">Welcome to Plant Minder</p>
            <p className="text-base text-muted">How many plants are you tracking?</p>
          </div>

          {isCompleted ? (
            <p className="text-sm text-muted">Got it — your tips are personalized.</p>
          ) : (
            <div className="flex flex-wrap gap-sm">
              {PLANT_RANGES.map((range) => (
                <Button
                  key={range}
                  variant="outline"
                  className={cn(
                    "h-11",
                    selectedRange === range && "border-accent border-2 text-accent bg-accent/10"
                  )}
                  onClick={() => handleRangeSelect(range)}
                  disabled={isCompleting}
                >
                  {range}
                </Button>
              ))}
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 h-11 w-11 text-muted"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss setup banner"
        >
          <X className="h-5 w-5" />
        </Button>
      </Card>
    </div>
  );
}

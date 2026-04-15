"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Leaf, X } from "lucide-react";
import { completeOnboarding } from "@/features/auth/actions";
import { seedStarterPlants } from "@/features/demo/actions";
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
  const [seedStarters, setSeedStarters] = useState(true);

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

    // Fire both actions concurrently
    const [onboardingResult] = await Promise.all([
      completeOnboarding({ plantCountRange: range }),
      seedStarters ? seedStarterPlants() : Promise.resolve(null),
    ]);

    setIsCompleting(false);

    if (onboardingResult && "error" in onboardingResult) {
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
      id="onboarding"
      className={cn(
        "transition-all duration-300 ease-out",
        isCollapsing ? "max-h-0 opacity-0 overflow-hidden" : "max-h-96 opacity-100"
      )}
    >
      <Card
        className="relative overflow-hidden border border-accent/30 bg-accent/15"
        style={{ borderRadius: "var(--radius-lg)" }}
      >
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-6">
          <Leaf className="h-6 w-6 shrink-0 text-accent" />

          <div className="flex-1 space-y-1">
            <p className="text-base font-medium">Welcome to Plant Minder</p>
            <p className="text-base text-muted-foreground">How many plants are you tracking?</p>
          </div>

          {isCompleted ? (
            <p className="text-sm text-muted-foreground">Got it — your tips are personalized.</p>
          ) : (
            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={seedStarters}
                  onChange={(e) => setSeedStarters(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
                  disabled={isCompleting}
                />
                <span className="text-sm text-muted-foreground">
                  Start with a few example plants
                </span>
              </label>
              <div className="flex flex-wrap gap-2">
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
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 h-11 w-11 text-muted-foreground"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss setup banner"
        >
          <X className="h-5 w-5" />
        </Button>
      </Card>
    </div>
  );
}

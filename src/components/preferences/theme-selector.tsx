"use client";

import { useEffect, useState } from "react";
import { useTheme } from "@/components/theme-provider";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
] as const;

/**
 * Phase 8.4 — Theme picker shown on the preferences page. System default;
 * choice persisted by next-themes via localStorage.
 *
 * Renders nothing until mounted to avoid SSR/CSR theme mismatch flicker
 * (the resolved theme is undefined on the server).
 */
export function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">Appearance</p>
      <p className="text-xs text-muted-foreground">
        Match your device, or pin a fixed theme.
      </p>
      <div
        role="radiogroup"
        aria-label="Theme"
        className="mt-3 grid grid-cols-3 gap-2"
      >
        {OPTIONS.map(({ value, label, Icon }) => {
          const selected = mounted && theme === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setTheme(value)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-md border px-3 py-3 text-xs font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected
                  ? "border-accent bg-accent/10 text-foreground"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

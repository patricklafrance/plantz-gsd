"use client";

import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme, type Theme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

const OPTIONS: ReadonlyArray<{ value: Theme; label: string; Icon: typeof Sun }> = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "Sys", Icon: Monitor },
];

/**
 * Phase 8.4 — compact inline theme switcher for the user-menu dropdown.
 * Three small buttons, full-width row. Lives below the Settings group.
 *
 * Click handlers stop propagation so the menu does not close (the user can
 * preview before dismissing the dropdown).
 */
export function ThemeToggleInline() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      className="px-2 py-1.5"
      role="radiogroup"
      aria-label="Appearance"
    >
      <p className="mb-1.5 text-xs font-normal text-muted-foreground">
        Appearance
      </p>
      <div className="flex items-stretch gap-1 rounded-md bg-muted/50 p-0.5">
        {OPTIONS.map(({ value, label, Icon }) => {
          const selected = theme === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${label} theme`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setTheme(value);
              }}
              className={cn(
                "flex flex-1 items-center justify-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

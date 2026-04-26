"use client";

import { useMemo, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Leaf, ChevronDown, Star, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { setDefaultHousehold } from "@/features/household/actions";
import { cn } from "@/lib/utils";

/**
 * HSET-01 / HSET-02 / D-03, D-05, D-09, D-34 — Client-side household switcher.
 *
 * Two variants:
 *  - `desktop`: full DropdownMenu with its own trigger (Leaf + current name +
 *    ChevronDown). Replaces the static "Plant Minder" logo Link in
 *    `src/app/(main)/h/[householdSlug]/layout.tsx` header.
 *  - `mobile`: returns a React fragment of DropdownMenuLabel + DropdownMenuItem
 *    rows. Intended to be embedded INSIDE an outer DropdownMenu (the
 *    UserMenu's existing DropdownMenuContent). This mobile variant does NOT
 *    render its own trigger or DropdownMenu wrapper — Plan 07 composes it
 *    inside UserMenu alongside Preferences / Sign out.
 *
 * Data flow: props-only. `households` comes from `getUserHouseholds(userId)`
 * (Phase 2 query). `currentSlug` is the active URL segment (read from route
 * params in the parent). No DB reads inside this component.
 *
 * Route preservation: `buildSwitchPath(currentPathname, newSlug)` preserves
 * list routes (`/h/old/plants` → `/h/new/plants`) but falls back detail routes
 * to the list root (`/h/old/plants/<cuid>` → `/h/new/plants`) — resources on
 * the detail URL belong to the prior household and won't exist in the target.
 *
 * Set-as-default: per-row affordance calls `setDefaultHousehold` server action
 * via `useTransition` so the dropdown stays responsive; sonner toast on success
 * or the server-returned error.
 */

type HouseholdRow = {
  household: { id: string; slug: string; name: string };
  role: "OWNER" | "MEMBER";
  isDefault: boolean;
};

export type HouseholdSwitcherProps = {
  households: HouseholdRow[];
  currentSlug: string;
  currentHouseholdName: string;
  variant: "desktop" | "mobile";
};

/**
 * Pure, exported utility (unit-tested). Rewrites `/h/<oldSlug>/<suffix>` to
 * `/h/<newSlug>/<suffix>` — falling back to `/h/<newSlug>/<resource>` when the
 * suffix ends on a detail CUID (Prisma `cuid()` → 25 chars, permissive regex
 * allows 20+ alphanumerics for safety).
 *
 * Expected pathname shape: "/h/<slug>/<resource>[/<cuid>]".
 */
export function buildSwitchPath(
  currentPathname: string,
  newSlug: string,
): string {
  const segments = currentPathname.split("/"); // ["", "h", "old", "resource", "maybe-cuid"]
  const detailPattern = /^[a-z0-9]{20,}$/i;
  const isDetailRoute =
    segments.length >= 5 && detailPattern.test(segments[4] ?? "");
  if (isDetailRoute) {
    return `/h/${newSlug}/${segments[3]}`;
  }
  const suffix = segments.slice(3).join("/");
  return suffix.length > 0 ? `/h/${newSlug}/${suffix}` : `/h/${newSlug}`;
}

export function HouseholdSwitcher({
  households,
  currentSlug,
  currentHouseholdName,
  variant,
}: HouseholdSwitcherProps) {
  const [isPending, startTransition] = useTransition();
  const pathname = usePathname();
  const router = useRouter();

  // D-05: client-side sort [isDefault desc, slug asc]. Stable fallback on
  // `slug.localeCompare` — `joinedAt` is not in the component prop shape.
  const sortedHouseholds = useMemo(
    () =>
      [...households].sort((a, b) => {
        if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
        return a.household.slug.localeCompare(b.household.slug);
      }),
    [households],
  );

  function handleSwitch(newSlug: string) {
    if (newSlug === currentSlug) return;
    router.push(
      buildSwitchPath(pathname ?? `/h/${currentSlug}/dashboard`, newSlug),
    );
  }

  function handleSetDefault(householdId: string) {
    startTransition(async () => {
      const result = await setDefaultHousehold({ householdId });
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Default household updated.");
      }
    });
  }

  // ───────── Desktop variant ─────────
  if (variant === "desktop") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Switch household"
          render={
            <button
              type="button"
              className={cn(
                "flex items-center gap-2 px-2 -ml-2 rounded-md hover:bg-muted",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              )}
            />
          }
        >
          <Leaf className="h-5 w-5 text-accent" aria-hidden="true" />
          <span className="text-sm font-semibold">{currentHouseholdName}</span>
          <ChevronDown
            className="h-3.5 w-3.5 text-muted-foreground"
            aria-hidden="true"
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            My households
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {sortedHouseholds.map((row) => {
            const isActive = row.household.slug === currentSlug;
            return (
              <DropdownMenuItem
                key={row.household.id}
                disabled={isActive || isPending}
                onClick={() => handleSwitch(row.household.slug)}
                className="flex cursor-pointer items-center justify-between gap-2"
              >
                <span className="flex items-center gap-2">
                  {row.isDefault && (
                    <Star
                      className="h-3.5 w-3.5 fill-accent text-accent"
                      aria-hidden="true"
                    />
                  )}
                  <span className="text-sm font-semibold">
                    {row.household.name}
                  </span>
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-xs",
                      // UI-SPEC §Color §Role pill — amber pair un-audited; use
                      // the pre-audited muted fallback. Plan 07 UAT may swap
                      // in the accent pair after Chrome DevTools measures ≥4.5:1.
                      row.role === "OWNER"
                        ? "bg-muted text-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {row.role}
                  </span>
                </span>
                {isActive ? (
                  <Check
                    className="h-3.5 w-3.5 text-muted-foreground"
                    aria-hidden="true"
                  />
                ) : !row.isDefault ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    className="h-7 text-xs"
                    disabled={isPending}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSetDefault(row.household.id);
                    }}
                  >
                    Set as default
                  </Button>
                ) : null}
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => router.push(`/h/${currentSlug}/household-settings`)}
            className="cursor-pointer gap-2 text-sm"
          >
            Household settings
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // ───────── Mobile variant (returns fragment for embedding in UserMenu) ─────────
  // variant === "mobile" — no wrapping DropdownMenu / trigger; Plan 07 composes
  // this fragment inside UserMenu's existing DropdownMenuContent. This is the
  // canonical (only) rendered switcher surface today.
  //
  // UX model mirrors react-aria Select: every row stays interactive (hover
  // styling on all rows), the currently-selected household is marked with a
  // Check on the right, and "Set as default" lives on the household settings
  // page rather than inline here — keeping this dropdown a pure switcher.
  return (
    <>
      <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
        My households
      </DropdownMenuLabel>
      {sortedHouseholds.map((row) => {
        const isActive = row.household.slug === currentSlug;
        return (
          <DropdownMenuItem
            key={row.household.id}
            disabled={isPending}
            onClick={() => handleSwitch(row.household.slug)}
            aria-current={isActive ? "true" : undefined}
            className="flex cursor-pointer items-center justify-between gap-2"
          >
            <span className="flex min-w-0 items-center gap-2">
              {row.isDefault && (
                <Star
                  className="h-3.5 w-3.5 shrink-0 fill-accent text-accent"
                  aria-hidden="true"
                />
              )}
              <span className="truncate text-sm font-semibold">
                {row.household.name}
              </span>
            </span>
            {isActive && (
              <Check
                className="h-4 w-4 text-muted-foreground"
                aria-label="Current household"
              />
            )}
          </DropdownMenuItem>
        );
      })}
    </>
  );
}

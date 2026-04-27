/**
 * Centralized household-scoped route patterns for `revalidatePath`.
 *
 * WR-04: Next.js `revalidatePath` with a bracket-segment pattern invalidates
 * every rendered instance of the route (all household slugs), but the pattern
 * must exactly match the folder name under `src/app/(main)/h/[householdSlug]/`.
 * Keeping the patterns as named constants here makes renames safe — a typo or
 * stale path shows up as a compile error at the call site instead of silently
 * failing to invalidate cached pages at runtime.
 *
 * Always pair these patterns with the `"page"` cache type argument, e.g.:
 *
 *   revalidatePath(HOUSEHOLD_PATHS.dashboard, "page");
 */
export const HOUSEHOLD_PATHS = {
  dashboard: "/h/[householdSlug]/dashboard",
  plants: "/h/[householdSlug]/plants",
  plantDetail: "/h/[householdSlug]/plants/[id]",
  rooms: "/h/[householdSlug]/rooms",
  roomDetail: "/h/[householdSlug]/rooms/[id]",
  settings: "/h/[householdSlug]/household-settings",
  timeOff: "/h/[householdSlug]/time-off",
} as const;

export type HouseholdPath = (typeof HOUSEHOLD_PATHS)[keyof typeof HOUSEHOLD_PATHS];

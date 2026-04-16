---
phase: 07-polish-and-accessibility
reviewed: 2026-04-15T14:30:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - src/app/(main)/dashboard/loading.tsx
  - src/app/(main)/plants/loading.tsx
  - src/app/(main)/rooms/loading.tsx
  - src/app/globals.css
  - src/components/layout/bottom-tab-bar.tsx
  - src/components/plants/filter-chips.tsx
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-04-15T14:30:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Reviewed six files covering skeleton loading states (dashboard, plants, rooms), global CSS theming, a mobile bottom tab bar, and plant filter chips. The three loading skeleton files are clean and well-structured with appropriate responsive grid layouts matching their corresponding pages. The CSS file includes a thorough WCAG AA contrast audit comment block with documented adjustments -- good engineering practice. Two warnings were found in the bottom tab bar component: a logic bug that prevents the Alerts tab from ever appearing active, and a missing accessible label for the notification badge count. Two info-level items in the filter chips component.

## Warnings

### WR-01: Alerts tab in BottomTabBar can never appear active

**File:** `src/components/layout/bottom-tab-bar.tsx:29-36`
**Issue:** The `isActive` check on lines 29-31 evaluates against the original `href` value (`/notifications`), but line 36 overrides the actual link destination to `/dashboard` when `href === "/notifications"`. Since the browser navigates to `/dashboard` (not `/notifications`), `pathname` will never match `/notifications`, so the Alerts tab will never show the active visual state (`text-accent`). The Dashboard tab will appear active instead when the user taps Alerts.
**Fix:** Either create a `/notifications` route so the href and active check align, or remove the Alerts tab redirect and accept the temporary dead link. If the redirect must stay as a placeholder, fix the active state logic:

```tsx
// Compute the actual destination first, then derive isActive from it
const actualHref = href === "/notifications" ? "/dashboard" : href;
const isActive = exact
  ? pathname === actualHref
  : pathname === actualHref || pathname.startsWith(actualHref + "/");
```

Note: This approach would make both "Dashboard" and "Alerts" appear active when on `/dashboard`, which is also confusing. The cleanest fix is to create the `/notifications` page or remove the Alerts tab from the bottom bar until the route exists.

### WR-02: Notification badge count not accessible to screen readers

**File:** `src/components/layout/bottom-tab-bar.tsx:43-51`
**Issue:** The notification count badge (lines 47-49) is purely visual. Screen reader users hear "Alerts" from the label text on line 55 but receive no information about the pending notification count. The badge number is inside a `<span>` with no accessible text, and the parent `<Link>` has no `aria-label` that includes the count. Given that this file is part of a phase focused on polish and accessibility, the omission is notable.
**Fix:** Add a screen-reader-only text span to convey the count:

```tsx
{label === "Alerts" ? (
  <span className="relative">
    <Icon className="h-5 w-5" aria-hidden="true" />
    {notificationCount > 0 && (
      <>
        <span
          className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white"
          aria-hidden="true"
        >
          {notificationCount > 9 ? "9+" : notificationCount}
        </span>
        <span className="sr-only">
          {notificationCount} {notificationCount === 1 ? "notification" : "notifications"}
        </span>
      </>
    )}
  </span>
) : (
  <Icon className="h-5 w-5" aria-hidden="true" />
)}
```

Alternatively, set an `aria-label` on the `<Link>` element: `aria-label={label === "Alerts" && notificationCount > 0 ? \`Alerts, ${notificationCount} notifications\` : undefined}`.

## Info

### IN-01: FilterChips useSearchParams without Suspense boundary

**File:** `src/components/plants/filter-chips.tsx:75`
**Issue:** The `FilterChips` component calls `useSearchParams()` but its parent Server Component page (`src/app/(main)/plants/page.tsx`) does not wrap it in a `<Suspense>` boundary. In Next.js, `useSearchParams()` in a Client Component without a Suspense boundary causes the nearest Suspense boundary to opt out of static rendering. While this page is already dynamic due to database queries, wrapping `FilterChips` in `<Suspense>` is a best practice to make the rendering boundary explicit and prevent unintended SSR bailouts if the page structure changes in the future.
**Fix:** In `src/app/(main)/plants/page.tsx`, wrap `FilterChips` in a Suspense boundary:

```tsx
import { Suspense } from "react";

<Suspense>
  <FilterChips
    rooms={rooms}
    activeRoomId={params.room}
    activeStatus={params.status}
    activeSort={params.sort}
  />
</Suspense>
```

### IN-02: Redundant nullish coalescing in filter status comparison

**File:** `src/components/plants/filter-chips.tsx:110`
**Issue:** The expression `(s.value ?? undefined) === activeStatus` is redundant. The `STATUSES` array is typed with `as const`, and the first entry already has `value: undefined`. Applying `?? undefined` to an already-`undefined` value is a no-op. This does not cause a bug but adds unnecessary noise that may confuse readers.
**Fix:** Simplify to:

```tsx
{s.value === activeStatus ? (
```

---

_Reviewed: 2026-04-15T14:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

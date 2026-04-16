---
phase: 07-polish-and-accessibility
reviewed: 2026-04-16T03:49:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - prisma/schema.prisma
  - src/app/(main)/dashboard/loading.tsx
  - src/app/(main)/dashboard/page.tsx
  - src/app/(main)/plants/loading.tsx
  - src/app/(main)/rooms/loading.tsx
  - src/app/globals.css
  - src/components/layout/bottom-tab-bar.tsx
  - src/components/plants/edit-plant-dialog.tsx
  - src/components/plants/filter-chips.tsx
  - src/components/shared/timezone-warning.tsx
  - src/components/ui/drawer.tsx
  - src/components/watering/timezone-sync.tsx
  - src/features/auth/actions.ts
  - src/hooks/use-focus-heading.ts
findings:
  critical: 1
  warning: 4
  info: 4
  total: 9
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-04-16T03:49:00Z
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Reviewed 14 files spanning the Prisma schema, dashboard and list page server components, loading skeletons, global CSS theming, mobile navigation, plant editing, filtering, timezone handling, drawer UI component, auth server actions, and a focus-management hook. The codebase is generally well-structured with good practices: Zod validation on server actions, proper auth checks, WCAG contrast audit documented in CSS, accessible focus management via MutationObserver, and consistent use of responsive dialog patterns.

One critical issue was found: the `updateTimezone` server action lacks IANA timezone format validation, allowing arbitrary strings (up to 100 chars) to be written to the database and subsequently used in `toLocaleDateString()` calls -- which can cause runtime exceptions on the dashboard. Four warnings cover a navigation logic bug, missing accessible labels, an unhandled promise in form submission, and a cookie-setting approach that bypasses HttpOnly. Four info-level items note minor code quality improvements.

## Critical Issues

### CR-01: Insufficient timezone validation allows invalid values into date math

**File:** `src/features/auth/actions.ts:67`
**Issue:** The `updateTimezone` action validates only that `timezone` is a non-empty string under 100 characters (line 67). It does not verify the value is a valid IANA timezone identifier. An attacker or malformed client could store an arbitrary string (e.g., `"<script>alert(1)</script>"` or `"notATimezone"`) as the user's timezone. This value is later read back and used as the `storedTimezone` prop in `TimezoneWarning` (rendered in JSX, so XSS is mitigated by React), but more critically it flows into `toLocaleDateString("en-CA", { timeZone: userTz })` on the dashboard page (line 58 of `page.tsx`) via the `user_tz` cookie. If an invalid timezone string reaches `toLocaleDateString`, it throws a `RangeError: Invalid time zone specified`, which would crash the dashboard server component and return a 500 error.

While the cookie (`user_tz`) is set client-side from `Intl.DateTimeFormat().resolvedOptions().timeZone` (which always produces valid IANA names), the DB-stored value is used in the `TimezoneWarning` comparison and could be persisted via a crafted direct call to the `updateTimezone` server action. Server actions are exposed as POST endpoints and can be called with arbitrary payloads.

**Fix:** Validate the timezone string against `Intl.supportedValuesOf("timeZone")` or use a try-catch around a `new Intl.DateTimeFormat("en", { timeZone })` construction:

```typescript
// In updateTimezone, after the basic string checks on line 67:
function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

if (!isValidTimezone(timezone)) return;
```

Additionally, the dashboard page should defensively handle an invalid `user_tz` cookie value in `toLocaleDateString` with a try-catch fallback to UTC:

```typescript
let localDateStr: string;
try {
  localDateStr = now.toLocaleDateString("en-CA", { timeZone: userTz });
} catch {
  localDateStr = now.toLocaleDateString("en-CA", { timeZone: "UTC" });
}
```

## Warnings

### WR-01: Alerts tab in BottomTabBar can never appear active

**File:** `src/components/layout/bottom-tab-bar.tsx:29-36`
**Issue:** The `isActive` check (lines 29-31) evaluates against the original `href` value (`/notifications`), but line 36 overrides the actual link destination to `/dashboard` when `href === "/notifications"`. Since the browser navigates to `/dashboard` (not `/notifications`), `pathname` will never match `/notifications`, so the Alerts tab will never show the active visual state (`text-accent`). The Dashboard tab will appear active instead when the user taps Alerts.
**Fix:** Either create a `/notifications` route so the href and active check align, or remove the Alerts tab redirect. If the redirect must stay as a placeholder, the cleanest fix is to remove the Alerts tab from the bottom bar until the route exists, since making both Dashboard and Alerts appear active on `/dashboard` is also confusing.

### WR-02: Notification badge count not accessible to screen readers

**File:** `src/components/layout/bottom-tab-bar.tsx:43-51`
**Issue:** The notification count badge (lines 47-49) is purely visual. Screen reader users hear "Alerts" from the label text but receive no information about the pending notification count. The badge `<span>` has no accessible text, and the parent `<Link>` has no `aria-label` that includes the count. Given this file is part of an accessibility-focused phase, the omission is notable.
**Fix:** Add a screen-reader-only text span to convey the count:

```tsx
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
```

### WR-03: Unhandled promise rejection in EditPlantDialog form submission

**File:** `src/components/plants/edit-plant-dialog.tsx:75-86`
**Issue:** The `onSubmit` function is `async` and calls `await updatePlant(data)` on line 77. If `updatePlant` throws an unexpected error (network failure, server error), the promise rejection will propagate unhandled because `handleSubmit` from react-hook-form does not catch async errors thrown inside the callback -- it only catches sync errors. While Server Actions typically return error objects rather than throwing, edge cases (network disconnection, middleware errors) can still produce thrown exceptions that would result in an unhandled promise rejection.
**Fix:** Wrap the server action call in a try-catch:

```typescript
async function onSubmit(data: EditPlantInput) {
  setFormError(undefined);
  try {
    const result = await updatePlant(data);
    if ("error" in result) {
      setFormError(result.error);
      return;
    }
    toast("Changes saved.");
    handleOpenChange(false);
  } catch {
    setFormError("Something went wrong. Please try again.");
  }
}
```

### WR-04: TimezoneSync sets user_tz cookie without HttpOnly flag

**File:** `src/components/watering/timezone-sync.tsx:11`
**Issue:** The `user_tz` cookie is set via `document.cookie` on the client side, which means it cannot have the `HttpOnly` flag. This cookie value is then read server-side in `cookies().get("user_tz")` and used directly in `toLocaleDateString({ timeZone: userTz })` for date math on the dashboard. A malicious browser extension or XSS vulnerability could tamper with this cookie to inject an invalid timezone string, which (as noted in CR-01) could crash the server component. While setting it client-side is architecturally necessary (only the browser knows its timezone), the server should not trust this value without validation.
**Fix:** Add defensive validation on the server side where the cookie is consumed. In `src/app/(main)/dashboard/page.tsx:54`:

```typescript
const rawTz = cookieStore.get("user_tz")?.value ?? "UTC";
let userTz = "UTC";
try {
  Intl.DateTimeFormat(undefined, { timeZone: rawTz });
  userTz = rawTz;
} catch {
  // Invalid timezone in cookie -- fall back to UTC
}
```

Apply the same pattern in `src/app/(main)/plants/page.tsx:33` and `src/app/(main)/layout.tsx:31`.

## Info

### IN-01: FilterChips useSearchParams without Suspense boundary

**File:** `src/components/plants/filter-chips.tsx:75`
**Issue:** The `FilterChips` component calls `useSearchParams()` without a wrapping `<Suspense>` boundary in its parent Server Component page. While the page is already dynamic due to database queries, wrapping in `<Suspense>` is a Next.js best practice to make the rendering boundary explicit.
**Fix:** In the parent page, wrap `FilterChips` in `<Suspense>`.

### IN-02: Redundant nullish coalescing in filter status comparison

**File:** `src/components/plants/filter-chips.tsx:110`
**Issue:** The expression `(s.value ?? undefined) === activeStatus` is redundant. The first entry in the `STATUSES` array already has `value: undefined` (typed via `as const`). Applying `?? undefined` to an already-`undefined` value is a no-op.
**Fix:** Simplify to `s.value === activeStatus`.

### IN-03: Unused Skeleton import in dashboard page

**File:** `src/app/(main)/dashboard/page.tsx:14`
**Issue:** The `Skeleton` component is imported from `@/components/ui/skeleton` on line 14 and used only inside the inline `DashboardSkeleton` function component (lines 17-39). This is fine functionally, but `loading.tsx` (in the same directory) also defines a `DashboardLoading` skeleton with a similar structure. Having two skeleton definitions for the same page is duplication. The `DashboardSkeleton` in `page.tsx` is used as a `<Suspense>` fallback for the inner `DashboardContent` async component, while `loading.tsx` covers the route-level loading state -- they serve different purposes, but the visual structures are nearly identical.
**Fix:** Consider extracting the shared skeleton layout into a single component and reusing it in both locations, or accept the duplication with a comment explaining the distinction.

### IN-04: Prisma schema missing index on Plant.userId

**File:** `prisma/schema.prisma:36-56`
**Issue:** The `Plant` model has a `userId` field used in `findMany({ where: { userId, archivedAt: null } })` queries across the dashboard and plants pages, but there is no explicit `@@index([userId])` on the model. While Prisma auto-creates indexes for `@relation` foreign keys on some databases, an explicit composite index on `[userId, archivedAt]` would better support the common query pattern. The `Note` model (line 75) does have an explicit `@@index([plantId])`, suggesting the project intends to declare indexes explicitly.
**Fix:** Add an index to the Plant model:

```prisma
@@index([userId, archivedAt])
```

---

_Reviewed: 2026-04-16T03:49:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

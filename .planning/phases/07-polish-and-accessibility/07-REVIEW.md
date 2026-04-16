---
phase: 07-polish-and-accessibility
reviewed: 2026-04-16T00:00:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - prisma/schema.prisma
  - src/app/(main)/dashboard/loading.tsx
  - src/app/(main)/dashboard/page.tsx
  - src/app/(main)/plants/loading.tsx
  - src/app/(main)/rooms/loading.tsx
  - src/app/globals.css
  - src/components/auth/login-form.tsx
  - src/components/auth/register-form.tsx
  - src/components/layout/bottom-tab-bar.tsx
  - src/components/onboarding/onboarding-banner.tsx
  - src/components/plants/edit-plant-dialog.tsx
  - src/components/plants/filter-chips.tsx
  - src/components/plants/plant-card.tsx
  - src/components/shared/timezone-warning.tsx
  - src/components/ui/drawer.tsx
  - src/components/watering/dashboard-client.tsx
  - src/components/watering/dashboard-plant-card.tsx
  - src/components/watering/timezone-sync.tsx
  - src/features/auth/actions.ts
  - src/features/demo/actions.ts
  - src/hooks/use-focus-heading.ts
findings:
  critical: 1
  warning: 6
  info: 6
  total: 13
status: issues_found
---

# Phase 07: Code Review Report

**Reviewed:** 2026-04-16
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

Reviewed all 20 files from the phase 07 polish and accessibility pass. The codebase is well-structured with good practices throughout: Zod validation on server actions, proper auth guards, a thorough WCAG AA colour audit documented in `globals.css`, accessible focus management via MutationObserver, `aria-hidden` on decorative icons, `role="alert"` on the timezone warning, and `aria-label` on icon-only buttons.

One critical issue was found: the `updateTimezone` server action lacks IANA timezone format validation, allowing arbitrary strings up to 100 chars to be written to the database and then used in a `toLocaleDateString()` call that will throw a `RangeError` on the dashboard server component, producing a 500. Six warnings cover navigation logic bugs, missing accessible labels, unhandled async errors, a cookie-setting race condition, and an unreachable code branch. Six info items note minor quality improvements.

---

## Critical Issues

### CR-01: Insufficient timezone validation — invalid value crashes dashboard with 500

**File:** `src/features/auth/actions.ts:67`
**Issue:** The `updateTimezone` action validates only that `timezone` is a non-empty string under 100 characters. It does not verify the value is a valid IANA timezone identifier. A crafted direct call to the server action endpoint (Server Actions are exposed as POST endpoints and can be called with arbitrary payloads) could persist an invalid string like `"notATimezone"` to the database. This value flows from `db.user` into `TimezoneWarning` (JSX-rendered, so no XSS risk) but also — more critically — is compared against `Intl.DateTimeFormat().resolvedOptions().timeZone` in `timezone-warning.tsx` and stored as `storedTimezone`.

Separately, the `user_tz` cookie is set client-side from `Intl.DateTimeFormat` (always valid), but the cookie value flows into `toLocaleDateString("en-CA", { timeZone: userTz })` on line 58 of `dashboard/page.tsx`. A tampered cookie (e.g., via a malicious browser extension) or the persisted DB value reaching that path via future refactoring would cause `toLocaleDateString` to throw a `RangeError: Invalid time zone specified`, crashing the dashboard server component.

**Fix:**

In `src/features/auth/actions.ts`, add IANA format validation:
```typescript
function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// In updateTimezone, after the existing string checks on line 67:
if (!isValidTimezone(timezone)) return;
```

In `src/app/(main)/dashboard/page.tsx:54`, add defensive cookie validation:
```typescript
const rawTz = cookieStore.get("user_tz")?.value ?? "UTC";
let userTz = "UTC";
try {
  Intl.DateTimeFormat(undefined, { timeZone: rawTz });
  userTz = rawTz;
} catch {
  // Invalid timezone in cookie — fall back to UTC
}
```

---

## Warnings

### WR-01: Alerts tab navigates to `/dashboard` instead of `/notifications` and can never appear active

**File:** `src/components/layout/bottom-tab-bar.tsx:36`
**Issue:** Line 36 overrides the navigation destination for the Alerts tab to `/dashboard`:
```tsx
href={href === "/notifications" ? "/dashboard" : href}
```
This means tapping Alerts navigates to `/dashboard`, not `/notifications`. The `isActive` check on lines 29-31 still reads from the original `href` (`/notifications`), so `pathname` will never match and the Alerts tab will never show the active visual state. The Dashboard tab appears active instead when the user taps Alerts — creating a confusing double-active state appearance.

**Fix:** Remove the redirect override and either create a stub `/notifications` route, or remove the Alerts tab from `TABS` entirely until the route exists:
```tsx
<Link
  key={href}
  href={href}
  aria-current={isActive ? "page" : undefined}
  ...
>
```

---

### WR-02: Notification badge count not accessible to screen readers

**File:** `src/components/layout/bottom-tab-bar.tsx:43-51`
**Issue:** The notification count badge (lines 47-49) is purely visual. Screen reader users hear "Alerts" from the label text but receive no information about the pending notification count. The badge `<span>` has no accessible text, and the parent `<Link>` has no `aria-label` that includes the count.

**Fix:**
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

---

### WR-03: Unhandled promise rejection in `EditPlantDialog` form submission

**File:** `src/components/plants/edit-plant-dialog.tsx:75-86`
**Issue:** The `onSubmit` function is `async` and calls `await updatePlant(data)` on line 77. If `updatePlant` throws an unexpected error (network disconnection, middleware error), the rejection propagates unhandled because `react-hook-form`'s `handleSubmit` does not catch async errors thrown inside the callback — it only handles sync throws and returned values. The user sees no feedback.

**Fix:**
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

---

### WR-04: `TimezoneSync` sets `user_tz` cookie client-side — server should validate before use

**File:** `src/components/watering/timezone-sync.tsx:11`
**Issue:** The `user_tz` cookie is set via `document.cookie` (cannot be HttpOnly). This cookie value is consumed server-side in `dashboard/page.tsx:54` and used directly in `toLocaleDateString({ timeZone: userTz })`. A malicious browser extension or any XSS vector could tamper with this cookie to inject an invalid timezone string, which (per CR-01) would crash the server component with a `RangeError`. The fix described in CR-01's dashboard defensive fallback addresses this; this warning calls out that the same defensive pattern is needed in any other server route that reads `user_tz`.

**Fix:** Apply the defensive `try/catch` timezone cookie validation at every server-side consumption point (see CR-01 fix). The client-side `TimezoneSync` component itself cannot be made HttpOnly — that is an inherent architectural constraint.

---

### WR-05: `parseInt` silently resets watering interval to `1` on clear/backspace

**File:** `src/components/plants/edit-plant-dialog.tsx:198`
**Issue:** The `onChange` handler uses:
```tsx
field.onChange(parseInt(e.target.value, 10) || 1)
```
When the user clears the field (empty string), `parseInt("", 10)` returns `NaN` and the `|| 1` forces the field value to `1`. This means the user cannot type a multi-digit number by first clearing the field — the moment it's empty it resets to `1`, and re-typing "1" followed by "4" gives "14" but through an unexpected intermediate state. Also prevents entering zero temporarily while mid-edit.

**Fix:**
```tsx
onChange={(e) => {
  const raw = e.target.value;
  if (raw === "") {
    field.onChange(undefined); // let Zod's min(1) catch empty at submit
  } else {
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed)) field.onChange(parsed);
  }
}}
```

---

### WR-06: Snooze buttons have no accessible label — "1d", "2d", "1w" are ambiguous

**File:** `src/components/watering/dashboard-plant-card.tsx:99-109`
**Issue:** The `InlineSnoozePills` buttons display labels "1d", "2d", "1w" as their only text content. Screen reader users hear these as isolated characters with no context about what is being snoozed or by how long. Combined with the wrapping `onClick` / `onKeyDown` stopPropagation on the parent `<div>` (lines 153-156), the snooze area is reachable but not clearly announced.

**Fix:**
```tsx
<button
  key={label}
  type="button"
  aria-label={`Snooze ${days === 7 ? "1 week" : `${days} day${days > 1 ? "s" : ""}`}`}
  onClick={(e) => handleSnooze(e, days, msg)}
  disabled={isPending}
  ...
>
  {label}
</button>
```

---

## Info

### IN-01: `overdueDays === 0` branch in `plant-card.tsx` `getStatusBadge` is unreachable

**File:** `src/components/plants/plant-card.tsx:22-28`
**Issue:** Inside the `if (daysUntil < 0)` block, `overdueDays = Math.abs(daysUntil)` is always `>= 1`, so the ternary `overdueDays === 0 ? "Overdue" : \`${overdueDays}d overdue\`` never takes the "Overdue" branch. The dead code is harmless but is a logic smell. The equivalent code in `dashboard-plant-card.tsx` has the same pattern and the same unreachability.

**Fix:** Remove the dead branch:
```tsx
{overdueDays}d overdue
```

---

### IN-02: FilterChips `(s.value ?? undefined)` is a no-op

**File:** `src/components/plants/filter-chips.tsx:110`
**Issue:** The expression `(s.value ?? undefined) === activeStatus` on line 110 is redundant. `s.value` for the "All" entry is already `undefined` (typed via `as const`). Applying `?? undefined` to an already-`undefined` value produces `undefined` — the expression is equivalent to `s.value === activeStatus`.

**Fix:** Simplify to `s.value === activeStatus`.

---

### IN-03: Unused `Skeleton` import in dashboard page / near-duplicate skeleton definition

**File:** `src/app/(main)/dashboard/page.tsx:14-39`
**Issue:** `Skeleton` is imported and used only inside the inline `DashboardSkeleton` function (lines 17-39). `loading.tsx` in the same directory (`DashboardLoading`) defines a visually nearly-identical skeleton layout. Both exist for different reasons (route-level loading vs Suspense fallback), but the visual duplication is non-obvious to future maintainers.

**Fix:** Consider extracting a shared skeleton component and importing it in both `loading.tsx` and `page.tsx`, or add a comment explaining the two-level distinction.

---

### IN-04: `globals.css` dark mode block has no WCAG contrast audit annotation

**File:** `src/app/globals.css:147-180`
**Issue:** The light mode block (`:root`) has a thorough WCAG AA audit comment at lines 83-109. The `.dark` block has no such annotation. Notably `--muted-foreground` in dark mode is `oklch(0.708 0 0)` (~`#a3a3a3`) on `--background` `oklch(0.145 0 0)` (~`#252525`), which passes AA at approximately 4.7:1 — but this is undocumented. Future colour changes to the dark theme could silently drop below AA without any audit trail.

**Fix:** Add a brief contrast table for the dark mode block mirroring the light mode audit comment.

---

### IN-05: `seedStarterPlants` creates plants serially — slow for large counts

**File:** `src/features/demo/actions.ts:128-150`
**Issue:** The `for...of` loop on line 128 calls `db.plant.create` sequentially for each profile, resulting in up to 35 sequential DB round-trips for the "30+ plants" onboarding tier. This makes onboarding feel slow (several seconds) for large counts. This is a startup-time issue, not a correctness bug.

**Fix:**
```typescript
await Promise.all(
  allProfiles.map((profile) =>
    db.plant.create({
      data: { /* same fields */ },
    })
  )
);
```
Note: `createMany` cannot be used here because of the nested `reminders.create` relation.

---

### IN-06: Prisma schema missing explicit index on `Plant.userId`

**File:** `prisma/schema.prisma:36-56`
**Issue:** The `Plant` model is queried with `findMany({ where: { userId, archivedAt: null } })` on every dashboard and plants page load, but there is no `@@index([userId])` or `@@index([userId, archivedAt])` declared. The `Note` model (line 75) has an explicit `@@index([plantId])`, suggesting indexes are intended to be declared explicitly in this project. Without an index, full table scans run against the plant table for each user's dashboard request.

**Fix:**
```prisma
model Plant {
  // ... existing fields ...
  @@index([userId, archivedAt])
}
```

---

_Reviewed: 2026-04-16_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

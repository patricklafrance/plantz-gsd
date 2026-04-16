---
phase: 07-polish-and-accessibility
plan: 06
subsystem: ui
tags: [mobile, accessibility, drawer, safe-area, focus, timezone, mutation-observer, prisma]

requires:
  - phase: 07-polish-and-accessibility (plans 01-05)
    provides: Mobile nav, responsive dialogs, a11y foundations, edge case hardening, skeleton pages

provides:
  - DrawerFooter with safe-area-inset-bottom padding for notched/home-bar devices
  - MutationObserver-based heading focus after client-side navigation (streaming-safe)
  - Timezone mismatch warning banner backed by DB-stored preference

affects:
  - src/components/ui/drawer.tsx
  - src/components/plants/edit-plant-dialog.tsx
  - src/hooks/use-focus-heading.ts
  - prisma/schema.prisma
  - src/features/auth/actions.ts
  - src/components/watering/timezone-sync.tsx
  - src/components/shared/timezone-warning.tsx
  - src/app/(main)/dashboard/page.tsx

tech-stack:
  added: []
  patterns:
    - "MutationObserver with safety timeout for streaming-safe DOM observation"
    - "Cookie flag (tz_stored) to gate one-time DB write without re-querying"
    - "Server-passes-prop pattern: server queries DB timezone, passes to client component for comparison"

key-files:
  created: []
  modified:
    - src/components/ui/drawer.tsx
    - src/components/plants/edit-plant-dialog.tsx
    - src/hooks/use-focus-heading.ts
    - prisma/schema.prisma
    - src/features/auth/actions.ts
    - src/components/watering/timezone-sync.tsx
    - src/components/shared/timezone-warning.tsx
    - src/app/(main)/dashboard/page.tsx

key-decisions:
  - "updateTimezone is idempotent — checks DB before writing to preserve home timezone across travel"
  - "MutationObserver tries querySelector immediately first, falls back to observer for streamed content"
  - "tz_stored cookie prevents repeated DB writes without an extra DB read on every page load"
  - "TimezoneWarning receives storedTimezone from server component (not cookie) — breaks the always-matching comparison bug"

patterns-established:
  - "Safe-area padding pattern: pb-[calc(1rem+env(safe-area-inset-bottom))] for drawer footers on notched devices"
  - "MutationObserver DOM polling: immediate attempt + observer fallback + safety timeout + cleanup on unmount"

requirements-completed: [UIAX-01, UIAX-02, UIAX-03]

duration: 15min
completed: 2026-04-16
---

# Phase 07 Plan 06: UAT Gap Closure Summary

**Three UAT-diagnosed fixes closing the final gaps in Phase 07: drawer button safe-area spacing, focus-after-navigation reliability, and timezone mismatch warning that never triggered.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-16
- **Completed:** 2026-04-16
- **Tasks:** 3
- **Files created:** 0
- **Files modified:** 8

## Accomplishments

- Fixed DrawerFooter to include `pb-[calc(1rem+env(safe-area-inset-bottom))]` — buttons now clear the home bar on notched iOS/Android devices
- Replaced edit-plant-dialog raw `<div>` footer with `ResponsiveDialogFooter` so the safe-area fix applies on mobile
- Rewrote `useFocusHeading` using MutationObserver — immediately focuses h1 if in DOM, otherwise observes for it (handles Next.js 16 streaming/Suspense), with 3-second safety timeout
- Added `timezone String?` column to User model and applied via `prisma db push`
- Added `updateTimezone` Server Action with auth check, demo guard, and idempotency (only writes if timezone not already stored)
- Updated `TimezoneSync` to persist browser TZ to DB on first visit using `tz_stored` cookie flag; continues setting `user_tz` cookie on every load for server-side date math
- Updated `TimezoneWarning` to accept `storedTimezone` prop from the server component, comparing browser TZ against DB-stored value (not cookie — which always matched)
- Updated dashboard page to query `user.timezone` and pass it as `storedTimezone` to `TimezoneWarning`

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix DrawerFooter safe-area padding and edit dialog footer** — `04f4ef1` (fix)
2. **Task 2: Fix focus-after-navigation with MutationObserver** — `9e569e5` (fix)
3. **Task 3: Fix timezone warning by storing preference in database** — `e488143` (fix)

## Files Modified

- `src/components/ui/drawer.tsx` — Added `pb-[calc(1rem+env(safe-area-inset-bottom))]` to DrawerFooter className
- `src/components/plants/edit-plant-dialog.tsx` — Imported `ResponsiveDialogFooter`, replaced raw `<div>` footer
- `src/hooks/use-focus-heading.ts` — Full rewrite: MutationObserver replaces 50ms setTimeout
- `prisma/schema.prisma` — Added `timezone String?` field to User model
- `src/features/auth/actions.ts` — Added `updateTimezone` Server Action (idempotent, auth-guarded, demo-guarded)
- `src/components/watering/timezone-sync.tsx` — Now persists to DB on first visit via `updateTimezone`; uses `tz_stored` cookie flag
- `src/components/shared/timezone-warning.tsx` — Now accepts `storedTimezone: string | null` prop; compares against DB value
- `src/app/(main)/dashboard/page.tsx` — Added `timezone: true` to user select; passes `storedTimezone` to `TimezoneWarning`

## Decisions Made

- `updateTimezone` checks `existing.timezone` before writing — preserves the user's "home" timezone when traveling (travel detection use case)
- `tz_stored` cookie approach avoids a DB read on every page load while preventing repeated writes
- MutationObserver tries `querySelector` synchronously first to avoid any delay on non-streamed pages
- `TimezoneWarning` receives `storedTimezone` from server (not client cookie) to ensure the comparison reflects the actual stored preference

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all data sources are wired. The timezone warning will show when `user.timezone` in DB differs from browser's `Intl.DateTimeFormat().resolvedOptions().timeZone`.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: input-validation | src/features/auth/actions.ts | `updateTimezone` validates: non-empty, string type, max 100 chars. Auth session check and demo guard applied. Idempotency prevents repeated writes. No injection risk (string stored as-is, only used for display comparison). |

## Self-Check: PASSED

- `src/components/ui/drawer.tsx` — FOUND: contains `pb-[calc(1rem+env(safe-area-inset-bottom))]`
- `src/components/plants/edit-plant-dialog.tsx` — FOUND: imports `ResponsiveDialogFooter`, uses `DialogFooter` component
- `src/hooks/use-focus-heading.ts` — FOUND: contains `MutationObserver`
- `prisma/schema.prisma` — FOUND: contains `timezone`
- `src/components/watering/timezone-sync.tsx` — FOUND: contains `updateTimezone`
- `src/components/shared/timezone-warning.tsx` — FOUND: contains `storedTimezone`
- `04f4ef1` commit — EXISTS
- `9e569e5` commit — EXISTS
- `e488143` commit — EXISTS

---
*Phase: 07-polish-and-accessibility*
*Completed: 2026-04-16*

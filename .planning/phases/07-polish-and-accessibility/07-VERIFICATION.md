---
phase: 07-polish-and-accessibility
verified: 2026-04-16T06:00:00Z
status: human_needed
score: 21/21 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 20/20
  gaps_closed: []
  gaps_remaining: []
  regressions: []
  new_truths_added:
    - "Plant cards with long unbroken nicknames have the same height as cards with normal-length nicknames (Plan 08)"
human_verification:
  - test: "On a 375px viewport, verify bottom tab bar is visible with 4 tabs and top nav links are hidden"
    expected: "BottomTabBar shows Dashboard, Plants, Rooms, Alerts tabs; desktop nav links hidden"
    why_human: "Responsive layout behavior requires visual viewport testing"
  - test: "On a 375px viewport, tap Add Plant -- verify dialog opens as bottom-up drawer sheet"
    expected: "Add Plant dialog renders as bottom drawer with rounded top corners, swipe-to-dismiss"
    why_human: "Drawer swipe gesture and visual rendering require touch-device testing"
  - test: "On a 375px viewport, tap Edit on a plant -- verify bottom drawer footer buttons have proper spacing from device bottom edge"
    expected: "Cancel and Save buttons are well-spaced above the device home bar/safe area, not cut off or cramped"
    why_human: "Safe area inset behavior requires testing on a notched/home-bar device (iPhone, modern Android)"
  - test: "Tab through the entire dashboard page with keyboard only"
    expected: "All interactive elements receive visible focus rings; skip-to-content link is first; focus moves to h1 after navigation"
    why_human: "Full keyboard navigation flow requires interactive browser testing with real focus events"
  - test: "Use a screen reader (NVDA/VoiceOver) to navigate dashboard and water a plant"
    expected: "All landmarks announced, status badges read with text not just color, toast announcements heard"
    why_human: "Screen reader behavior cannot be verified programmatically"
  - test: "Navigate between pages and verify focus moves to h1 heading, even when page content streams in via Suspense"
    expected: "After clicking Plants link, focus should be on the My Plants h1 element; MutationObserver should handle streamed content"
    why_human: "Client-side focus management with streaming requires live browser interaction"
  - test: "Manually set user timezone in DB to a different timezone than browser, reload dashboard"
    expected: "Timezone mismatch warning banner appears with dismiss button; dismissing persists for the session"
    why_human: "Timezone detection and DB-vs-browser comparison requires manual DB manipulation and browser testing"
---

# Phase 7: Polish and Accessibility Verification Report

**Phase Goal:** The app is responsive and touch-friendly on mobile, meets WCAG AA accessibility standards, and handles all known edge cases gracefully
**Verified:** 2026-04-16T06:00:00Z
**Status:** human_needed
**Re-verification:** Yes — after Plan 08 (card height consistency) added post-previous-verification

## Summary

Re-verification following completion of Plan 08 (final gap closure — card height consistency). All 20 previously verified must-haves pass regression checks, with truth #20 updated to reflect Plan 08's intent (uniform card height via `truncate` alone, without `break-all`). One new truth added from Plan 08 must-haves (card height consistency). Total: 21/21. The 7 human verification items remain pending and require visual/device/screen-reader testing.

**Plan 08 implementation note:** The previous VERIFICATION.md verified `truncate break-all` as present. Plan 08 then deliberately removed `break-all` — it was dead code (overridden by `white-space: nowrap` from `truncate`) that caused subtle flex intrinsic-size differences producing inconsistent card heights. The goal-level truth (long names truncated with ellipsis, no overflow) continues to hold. Plan 08 strengthened it by also fixing card height consistency.

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | Bottom tab bar visible on mobile (<640px) with Dashboard, Plants, Rooms, Notifications tabs | VERIFIED | `bottom-tab-bar.tsx`: `sm:hidden` (line 25), 4 tabs (Dashboard/Plants/Rooms/Alerts), `min-h-[44px]`, `pb-[env(safe-area-inset-bottom)]`, notification badge. Wired in `layout.tsx` line 99. |
| 2  | Top nav Plants/Rooms links hidden on mobile, visible on desktop | VERIFIED | `layout.tsx` line 74: `hidden items-center gap-4 sm:flex`. NotificationBell wrapped with `hidden sm:block` (line 89). |
| 3  | All interactive elements meet 44x44px minimum touch target on mobile | VERIFIED | `min-h-[44px]` confirmed in: `bottom-tab-bar.tsx` links (line 39), `filter-chips.tsx` buttons (line 51), `dashboard-plant-card.tsx` snooze pills (line 105), `room-card.tsx` edit/delete (lines 82, 98), `user-menu.tsx` trigger (line 38). |
| 4  | Card grids reflow to 1 column on mobile, 2 on sm, 3 on lg | VERIFIED | `sm:grid-cols-2 lg:grid-cols-3` in `rooms/page.tsx` (line 45), `dashboard/page.tsx` (line 23), and all 3 loading.tsx files. |
| 5  | Main content has bottom padding on mobile to clear the fixed tab bar | VERIFIED | `layout.tsx` line 96: `pb-20 sm:pb-6` on main element. |
| 6  | Skip-to-content link is first tabbable element in layout | VERIFIED | `layout.tsx` lines 47-51: `<a href="#main-content" className="sr-only focus:not-sr-only ...">Skip to content</a>` before header. `id="main-content"` on main (line 96). |
| 7  | After client-side navigation, focus moves to new page's h1 (streaming-safe) | VERIFIED | `use-focus-heading.ts`: MutationObserver-based (line 22). Tries querySelector immediately (line 13), falls back to observer for streamed h1, 3-second safety timeout. `FocusHeading` rendered in `layout.tsx` (lines 11, 54). All page h1 elements have `tabIndex={-1}` and `outline-none`. |
| 8  | Modals render as bottom-up sheet drawers on mobile, centered dialogs on desktop | VERIFIED | `responsive-dialog.tsx`: context-based switching at `max-width: 639px`. `drawer.tsx`: wraps @base-ui/react/drawer. Three consumers import from `responsive-dialog`: add-plant (line 15), edit-plant (lines 10-14), log-watering. |
| 9  | Every status badge has icon + text + color — no color-only indicators | VERIFIED | `dashboard-plant-card.tsx`: AlertTriangle, Droplets, Clock, CheckCircle2 with `aria-hidden="true"`. `plant-card.tsx`: HelpCircle, AlertTriangle, Droplets, Clock with `aria-hidden="true"`. All badges use `gap-1.5 items-center`. |
| 10 | WCAG AA contrast: accent and muted-foreground darkened to pass 4.5:1 | VERIFIED | `globals.css`: `--muted-foreground: oklch(0.45 0 0)`, `--accent: oklch(0.50 0.11 155)`, `--ring: oklch(0.50 0.11 155)`. Full audit comment block at line 84. |
| 11 | Watering log failure toast includes Retry action button | VERIFIED | `dashboard-client.tsx` lines 106 and 119: both error paths include `label: "Retry"` action with `onClick: () => handleWater(plant)`. |
| 12 | Loading skeleton pages exist for dashboard, plants, and rooms routes | VERIFIED | `dashboard/loading.tsx`, `plants/loading.tsx`, `rooms/loading.tsx` all exist, import Skeleton, export default function, use responsive grids. |
| 13 | All interactive elements from Plans 01-04 have visible focus-visible rings | VERIFIED | `bottom-tab-bar.tsx` (line 39): `focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1 rounded-md`. `filter-chips.tsx` (line 51): `focus-visible:ring-2 focus-visible:ring-ring/50`. Button-based elements inherit from buttonVariants. |
| 14 | WCAG AA Contrast Audit comment block documented in globals.css | VERIFIED | `globals.css` line 84: `WCAG AA Contrast Audit (Phase 7)` block with all OKLCH tokens, contrast ratios, pass/fail, and adjustment history. |
| 15 | Edit plant bottom drawer has properly spaced buttons with safe area padding on mobile | VERIFIED | `drawer.tsx` DrawerFooter (line 94): `pb-[calc(1rem+env(safe-area-inset-bottom))]`. `edit-plant-dialog.tsx` imports `ResponsiveDialogFooter as DialogFooter` (lines 10-14), uses it at line 215. |
| 16 | Focus automatically moves to h1 heading after client-side navigation, even with streamed/suspended content | VERIFIED | `use-focus-heading.ts`: MutationObserver replaces 50ms setTimeout. Immediate querySelector attempt (line 13), observer fallback (line 22), 3-second safety timeout, proper cleanup on unmount. |
| 17 | Timezone mismatch warning banner appears on dashboard when browser timezone differs from stored preference | VERIFIED | Full data flow: `schema.prisma` line 20: `timezone String?`. `auth/actions.ts` lines 61-78: `updateTimezone` with auth/demo/validation guards, idempotency. `timezone-sync.tsx`: calls `updateTimezone` with `tz_stored` cookie flag. `timezone-warning.tsx`: accepts `storedTimezone` prop, compares against browser TZ via `Intl.DateTimeFormat`. `dashboard/page.tsx` line 120: queries `timezone: true`, line 132: `<TimezoneWarning storedTimezone={user?.timezone ?? null} />`. |
| 18 | Show password toggle button is vertically centered within the password input on login and register forms | VERIFIED | `login-form.tsx` line 104: `top-1/2 -translate-y-1/2` (1 match). `register-form.tsx` lines 103, 138: `top-1/2 -translate-y-1/2` (2 matches). Old `top-0` positioning absent. |
| 19 | Watering a plant that is already in Recently Watered does not cause a flicker | VERIFIED | `dashboard-client.tsx` function `movePlantToRecentlyWatered` (lines 23+): checks `alreadyInRecent` before prepending. If already in group, keeps in place. Old `removePlantFromGroups`/`removeFromGroups` — 0 matches. |
| 20 | Onboarding seed creates the correct number of plants matching the selected plantCountRange | VERIFIED | `demo/actions.ts`: `plantCountRange` param (line 91), `TARGET_COUNTS` Record (line 96), `additionalProfiles` fetch with `notIn` filter (lines 118-123). `onboarding-banner.tsx` line 45: `seedStarterPlants(range)`. |
| 21 | Plant cards with long unbroken nicknames have the same height as cards with normal-length nicknames; long nicknames truncate with ellipsis | VERIFIED | `dashboard-plant-card.tsx` line 136: `truncate` (only). `plant-card.tsx` line 54: `truncate` (only). `break-all` removed by Plan 08 — it was dead code (overridden by `white-space: nowrap`), causing subtle flex sizing differences. `truncate` alone ensures single-line ellipsis rendering with uniform card height. |

**Score:** 21/21 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/layout/bottom-tab-bar.tsx` | Mobile-only fixed bottom nav bar (min 40 lines) | VERIFIED | Substantive, wired via layout.tsx |
| `src/components/ui/drawer.tsx` | Base UI Drawer wrapper with safe-area footer (min 50 lines) | VERIFIED | Wraps @base-ui/react/drawer, DrawerFooter has `pb-[calc(1rem+env(safe-area-inset-bottom))]` |
| `src/components/shared/responsive-dialog.tsx` | Responsive Dialog/Drawer wrapper (min 40 lines) | VERIFIED | Context-based switching, exports ResponsiveDialogFooter |
| `src/hooks/use-media-query.ts` | Client-side media query hook (min 15 lines) | VERIFIED | Uses `window.matchMedia` |
| `src/hooks/use-focus-heading.ts` | Hook that focuses h1 on pathname change (min 10 lines) | VERIFIED | MutationObserver-based, streaming-safe, 50 lines |
| `src/components/shared/focus-heading.tsx` | Thin Client Component wrapper (min 5 lines) | VERIFIED | Invokes useFocusHeading, rendered in layout.tsx |
| `src/components/shared/pagination.tsx` | Previous/Next pagination (min 30 lines) | VERIFIED | Preserves URL params, used by plants/page.tsx |
| `src/components/shared/empty-state.tsx` | Shared EmptyState component (min 25 lines) | VERIFIED | icon/heading/body/action slots |
| `src/components/shared/timezone-warning.tsx` | Dismissible timezone mismatch banner (min 15 lines) | VERIFIED | Accepts `storedTimezone` prop, compares browser TZ against DB value |
| `src/app/(main)/dashboard/loading.tsx` | Skeleton loading page (min 15 lines) | VERIFIED | Imports Skeleton, responsive grid |
| `src/app/(main)/plants/loading.tsx` | Skeleton loading page (min 15 lines) | VERIFIED | Imports Skeleton, search skeleton + responsive grid |
| `src/app/(main)/rooms/loading.tsx` | Skeleton loading page (min 15 lines) | VERIFIED | Imports Skeleton, responsive grid |
| `prisma/schema.prisma` | User model with timezone column | VERIFIED | Line 20: `timezone String?` |
| `src/components/watering/timezone-sync.tsx` | Timezone sync that persists to DB on first visit | VERIFIED | Calls updateTimezone, uses tz_stored cookie flag |
| `src/features/auth/actions.ts` | updateTimezone Server Action | VERIFIED | Auth-guarded, demo-guarded, validated, idempotent |
| `src/components/plants/edit-plant-dialog.tsx` | Edit dialog using ResponsiveDialogFooter | VERIFIED | Imports ResponsiveDialogFooter, uses DialogFooter component |
| `src/components/auth/login-form.tsx` | Vertically centered show password button | VERIFIED | `top-1/2 -translate-y-1/2` at line 104 |
| `src/components/auth/register-form.tsx` | Vertically centered show password buttons | VERIFIED | `top-1/2 -translate-y-1/2` at lines 103 and 138 |
| `src/components/watering/dashboard-client.tsx` | Flicker-free optimistic update for recently watered plants | VERIFIED | `movePlantToRecentlyWatered` with `alreadyInRecent` guard |
| `src/features/demo/actions.ts` | Range-aware starter plant seeding using plantCountRange param | VERIFIED | `TARGET_COUNTS` mapping, `additionalProfiles` fetch logic |
| `src/components/watering/dashboard-plant-card.tsx` | Consistent card height and clean truncation (Plan 08) | VERIFIED | `truncate` only on nickname (line 136); `break-all` removed |
| `src/components/plants/plant-card.tsx` | Consistent card height and clean truncation (Plan 08) | VERIFIED | `truncate` only on nickname (line 54); `break-all` removed |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `layout.tsx` | `bottom-tab-bar.tsx` | import and render | WIRED | Line 12 import, line 99 render |
| `bottom-tab-bar.tsx` | `usePathname` | active tab detection | WIRED | `pathname.startsWith` pattern (line 31) |
| `responsive-dialog.tsx` | `drawer.tsx` | conditional render on mobile | WIRED | Drawer imports, context switch at 639px |
| `responsive-dialog.tsx` | `dialog.tsx` | conditional render on desktop | WIRED | Dialog imports, fallback |
| `add-plant-dialog.tsx` | `responsive-dialog.tsx` | import replacement | WIRED | Line 15 |
| `edit-plant-dialog.tsx` | `responsive-dialog.tsx` | ResponsiveDialogFooter import | WIRED | Lines 10-14 |
| `layout.tsx` | `focus-heading.tsx` | import and render | WIRED | Lines 11, 54 |
| `focus-heading.tsx` | `use-focus-heading.ts` | hook invocation | WIRED | useFocusHeading() call |
| `plants/page.tsx` | `queries.ts` | getPlants with page param | WIRED | Pagination import, page param at line 44 |
| `plants/page.tsx` | `pagination.tsx` | Pagination UI below plant grid | WIRED | Line 12 import, line 115 render |
| `dashboard/page.tsx` | `empty-state.tsx` | empty state rendering | WIRED | Line 11 import, line 85 render |
| `dashboard/page.tsx` | `timezone-warning.tsx` | storedTimezone prop from server query | WIRED | Lines 120, 132 |
| `timezone-sync.tsx` | `auth/actions.ts` | updateTimezone Server Action call | WIRED | Line 4 import, line 20 call |
| `loading.tsx (x3)` | `skeleton.tsx` | import Skeleton | WIRED | All three import and use Skeleton |
| `onboarding-banner.tsx` | `demo/actions.ts` | seedStarterPlants(range) | WIRED | Line 8 import, line 45 call |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `bottom-tab-bar.tsx` | `notificationCount` | layout.tsx server query (Prisma reminders count) | Yes | FLOWING |
| `pagination.tsx` | `currentPage`, `totalPages` | `getPlants` with `Promise.all([findMany, count])` | Yes — Prisma | FLOWING |
| `timezone-warning.tsx` | `storedTimezone` | dashboard page server query (`user.timezone`) | Yes — Prisma select | FLOWING |
| `timezone-sync.tsx` | `timezone` | `updateTimezone` Server Action writes to `User.timezone` | Yes — Prisma update | FLOWING |
| `dashboard-client.tsx` | `optimisticGroups` | `movePlantToRecentlyWatered` + server revalidation via `logWatering` | Yes — Prisma-backed | FLOWING |
| `demo/actions.ts` | `allProfiles` | `careProfiles` baseline + `additionalProfiles` DB queries | Yes — Prisma findMany with targetCount | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All tests pass (no regressions) | `npx vitest run` | 77 passed, 88 todo, 0 failures | PASS |
| Password toggle centering (login) | grep login-form.tsx | `top-1/2 -translate-y-1/2` found line 104 (1 match) | PASS |
| Password toggle centering (register) | grep register-form.tsx | `top-1/2 -translate-y-1/2` found lines 103, 138 (2 matches) | PASS |
| Flicker-free optimistic update | grep dashboard-client.tsx | `movePlantToRecentlyWatered` (2 matches), old function (0 matches) | PASS |
| Long name truncation — no break-all | grep nickname paragraph | `truncate` only — `break-all` absent from both card files | PASS |
| Seed count range mapping | grep demo/actions.ts | `plantCountRange`, `TARGET_COUNTS`, `additionalProfiles` all found | PASS |
| Range passed to seeder | grep onboarding-banner.tsx | `seedStarterPlants(range)` found line 45 | PASS |
| BottomTabBar focus-visible ring | grep bottom-tab-bar.tsx | `focus-visible:ring-2 focus-visible:ring-ring/50` found line 39 | PASS |
| FilterChips focus-visible ring | grep filter-chips.tsx | `focus-visible:ring-2 focus-visible:ring-ring/50` found line 51 | PASS |
| WCAG audit block in globals.css | grep globals.css | `WCAG AA Contrast Audit (Phase 7)` found line 84 | PASS |
| User model has timezone | grep schema.prisma | `timezone String?` found line 20 | PASS |
| MutationObserver in focus hook | grep use-focus-heading.ts | `MutationObserver` found line 22 | PASS |
| DrawerFooter safe-area padding | grep drawer.tsx | `pb-[calc(1rem+env(safe-area-inset-bottom))]` found line 94 | PASS |
| Pagination wired in plants page | grep plants/page.tsx | `Pagination` import line 12, render line 115 | PASS |
| Character limits in schemas | grep schemas | nickname `.max(40)` in plant schema, `.max(40)` in room schema | PASS |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| UIAX-01 | 07-01, 07-02, 07-06, 07-07, 07-08 | App is responsive and touch-friendly on mobile, optimized on desktop | SATISFIED | BottomTabBar, responsive grids (1/2/3 col), touch targets (44px min-h), responsive dialogs, drawer safe-area padding, loading skeletons, password button centering, flicker-free watering, consistent card height with clean truncation |
| UIAX-02 | 07-03, 07-05, 07-06 | App meets WCAG AA contrast and keyboard navigation requirements | SATISFIED | Contrast adjusted (muted-foreground, accent, ring) with audit doc; FocusHeading with MutationObserver; h1 tabIndex={-1} outline-none across 6 pages; skip-to-content link; aria-labels on both nav elements; focus-visible rings on BottomTabBar and FilterChips |
| UIAX-03 | 07-03 | Forms have proper labels; status uses more than just color | SATISFIED | Status badges have icon + text + color (5 icon types: AlertTriangle/Droplets/Clock/CheckCircle2/HelpCircle), all icons aria-hidden, FormMessage for inline Zod errors, watering retry toast |
| UIAX-04 | 07-04 | Empty states provide helpful guidance | SATISFIED | Shared EmptyState component (icon + heading + body + action) used in dashboard (no plants), plants page (empty collection + no results), rooms page (no rooms), room detail (no plants in room), notification bell |

All 4 phase requirements marked Complete in REQUIREMENTS.md (Phase 7). No orphaned or unmapped Phase 7 requirements found.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

No TODOs, FIXMEs, placeholders, or empty-return stubs detected in Phase 07 modified files. All data sources are wired to real Prisma queries.

### Human Verification Required

### 1. Mobile Bottom Tab Bar Layout

**Test:** Open app on a 375px viewport. Verify bottom tab bar shows 4 tabs.
**Expected:** Dashboard, Plants, Rooms, Alerts tabs visible at bottom; top nav Plants/Rooms links hidden.
**Why human:** Responsive layout behavior requires visual viewport testing.

### 2. Drawer Sheet on Mobile

**Test:** On 375px viewport, tap "Add Plant" button. Verify dialog opens as bottom sheet.
**Expected:** Add Plant dialog slides up from bottom with rounded corners. Swipe down to dismiss.
**Why human:** Touch gesture interaction and visual drawer rendering require device testing.

### 3. Drawer Footer Safe-Area Spacing

**Test:** On 375px viewport, tap Edit on a plant. Verify bottom drawer footer buttons have proper spacing from device bottom edge.
**Expected:** Cancel and Save buttons are well-spaced above the device home bar/safe area, not cut off or cramped.
**Why human:** Safe area inset behavior requires testing on a notched/home-bar device (iPhone, modern Android).

### 4. Full Keyboard Navigation

**Test:** Tab through entire dashboard page using keyboard only.
**Expected:** Skip-to-content link appears first, all interactive elements (BottomTabBar tabs, FilterChips) receive visible green focus rings, tab order is logical.
**Why human:** Full keyboard flow requires interactive browser testing with real focus events.

### 5. Screen Reader Navigation

**Test:** Use NVDA or VoiceOver to navigate dashboard and water a plant.
**Expected:** Landmarks announced (Top navigation, Main navigation), status badges read with text labels, toast announcements heard.
**Why human:** Screen reader behavior cannot be verified programmatically.

### 6. Focus After Navigation with Streaming

**Test:** Navigate between pages using nav links. Verify focus moves to h1 heading even when content streams in via Suspense.
**Expected:** After clicking Plants link, focus should be on the "My Plants" h1. MutationObserver handles streamed content.
**Why human:** Client-side focus management with streaming requires live browser interaction.

### 7. Timezone Mismatch Warning

**Test:** Manually set user's timezone column in DB to a different timezone than browser (e.g., "Asia/Tokyo"), reload dashboard.
**Expected:** Timezone mismatch warning banner appears with dismiss button. Dismissing persists for the browser session.
**Why human:** Timezone detection and DB-vs-browser comparison requires manual DB manipulation.

### Gaps Summary

No programmatic gaps. All 21 must-haves verified against the actual codebase.

**Plan 08 regression check (card height):**
- Previous VERIFICATION.md (truth #20) reported `truncate break-all` present — this was the state BEFORE Plan 08.
- Plan 08 REMOVED `break-all` intentionally (it was dead code causing subtle flex sizing bugs).
- Current state: `truncate` only on both card files — verified. The goal (no overflow, ellipsis, consistent height) is better served by `truncate` alone.
- This is NOT a regression; it is the intended final state per Plan 08 scope.

**Test suite:** 77 passed, 0 failures (`npx vitest run`).

The 7 human verification items (visual layout, drawer gestures, safe-area spacing, keyboard navigation, screen reader, streaming focus, timezone warning) require browser/device testing and cannot be closed programmatically.

---

_Verified: 2026-04-16T06:00:00Z_
_Verifier: Claude (gsd-verifier)_

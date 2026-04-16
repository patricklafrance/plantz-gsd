---
phase: 07-polish-and-accessibility
verified: 2026-04-16T05:00:00Z
status: human_needed
score: 20/20 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 16/16
  gaps_closed:
    - "Show password toggle button is vertically centered within the password input on login and register forms"
    - "Watering a plant that is already in Recently Watered does not cause a flicker — the plant stays in place with updated dates"
    - "Onboarding seed creates the correct number of plants matching the selected plantCountRange (5, 10, 20, or 30+)"
    - "Long plant names without word breaks are truncated with ellipsis and do not overflow their containers"
  gaps_remaining: []
  regressions: []
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
**Verified:** 2026-04-16T05:00:00Z
**Status:** human_needed
**Re-verification:** Yes -- after human-testing gap closure (Plan 07-07)

## Summary

All 4 gaps from the previous `gaps_found` verification (Plan 07-07 gap closure) are confirmed closed. All 16 previously verified must-haves pass regression checks. 4 new must-haves from Plan 07 added and verified, bringing the total to 20/20. The 7 human verification items remain pending — they require visual/device/screen-reader testing that cannot be verified programmatically.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Bottom tab bar visible on mobile (<640px) with Dashboard, Plants, Rooms, Notifications tabs | VERIFIED | `bottom-tab-bar.tsx`: 4 tabs, `sm:hidden`, `min-h-[44px]`, `pb-[env(safe-area-inset-bottom)]`, notification badge. Wired in `layout.tsx` line 99. |
| 2 | Top nav Plants/Rooms links hidden on mobile, visible on desktop | VERIFIED | `layout.tsx` line 74: `hidden items-center gap-4 sm:flex`. NotificationBell wrapped with `hidden sm:block`. |
| 3 | All interactive elements meet 44x44px minimum touch target on mobile | VERIFIED | `min-h-[44px]` in: `bottom-tab-bar.tsx`, `filter-chips.tsx`, `dashboard-plant-card.tsx`, `room-card.tsx`, `user-menu.tsx`. |
| 4 | Card grids reflow to 1 column on mobile, 2 on sm, 3 on lg | VERIFIED | `sm:grid-cols-2 lg:grid-cols-3` in `rooms/page.tsx`, `dashboard/page.tsx`, `plant-grid.tsx`, `dashboard-section.tsx`, all `loading.tsx` files. |
| 5 | Skip-to-content link is first tabbable element in layout | VERIFIED | `layout.tsx` lines 47-51: `<a href="#main-content" className="sr-only focus:not-sr-only ...">Skip to content</a>` before header. `id="main-content"` on main. |
| 6 | After client-side navigation, focus moves to new page's h1 (streaming-safe) | VERIFIED | `use-focus-heading.ts` (50 lines): MutationObserver-based. Tries querySelector immediately, falls back to observer for streamed h1. 3-second safety timeout. `FocusHeading` rendered in `layout.tsx`. All page h1 elements have `tabIndex={-1}` and `outline-none`. |
| 7 | Modals render as bottom-up sheet drawers on mobile, centered dialogs on desktop | VERIFIED | `responsive-dialog.tsx` (126 lines): context-based switching at 639px. `drawer.tsx` (145 lines): wraps @base-ui/react/drawer. Three consumers import from responsive-dialog (add-plant, edit-plant, log-watering). |
| 8 | Every status badge has icon + text + color -- no color-only indicators | VERIFIED | `dashboard-plant-card.tsx`: AlertTriangle, Droplets, Clock, CheckCircle2 with `aria-hidden="true"`. `plant-card.tsx`: AlertTriangle, Droplets, Clock, HelpCircle with `aria-hidden="true"`. All badges have `gap-1.5 items-center`. |
| 9 | WCAG AA contrast: accent and muted-foreground darkened to pass 4.5:1 | VERIFIED | `globals.css`: `--muted-foreground: oklch(0.45 0 0)`, `--accent: oklch(0.50 0.11 155)`, `--ring: oklch(0.50 0.11 155)`. Full audit comment block at line 84. |
| 10 | Watering log failure toast includes Retry action button | VERIFIED | `dashboard-client.tsx` lines 104-109 and 117-122: both error paths include `label: "Retry"` action with `onClick: () => handleWater(plant)`. |
| 11 | Loading skeleton pages exist for dashboard, plants, and rooms routes | VERIFIED | `dashboard/loading.tsx` (32 lines), `plants/loading.tsx` (37 lines), `rooms/loading.tsx` (32 lines). All import Skeleton, export default, use responsive grids. |
| 12 | All interactive elements from Plans 01-04 have visible focus-visible rings | VERIFIED | `bottom-tab-bar.tsx`: `focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1 rounded-md`. `filter-chips.tsx`: `focus-visible:ring-2 focus-visible:ring-ring/50`. Button-based elements inherit from buttonVariants. |
| 13 | WCAG AA Contrast Audit comment block documented in globals.css | VERIFIED | `globals.css` line 84: `WCAG AA Contrast Audit (Phase 7)` block with all OKLCH tokens, contrast ratios, pass/fail, and adjustment history. |
| 14 | Edit plant bottom drawer has properly spaced buttons with safe area padding on mobile | VERIFIED | `drawer.tsx` DrawerFooter: `pb-[calc(1rem+env(safe-area-inset-bottom))]`. `edit-plant-dialog.tsx` imports `ResponsiveDialogFooter as DialogFooter`, uses it at line 215. |
| 15 | Focus automatically moves to h1 heading after client-side navigation, even with streamed/suspended content | VERIFIED | `use-focus-heading.ts`: MutationObserver replaces 50ms setTimeout. Immediate querySelector attempt (line 13), observer fallback (line 22), 3-second safety timeout, proper cleanup. |
| 16 | Timezone mismatch warning banner appears on dashboard when browser timezone differs from stored preference | VERIFIED | Full data flow: `schema.prisma` has `timezone String?` (line 20). `auth/actions.ts` has `updateTimezone` with auth/demo/validation guards and idempotency. `timezone-sync.tsx` calls `updateTimezone` with `tz_stored` cookie flag. `timezone-warning.tsx` accepts `storedTimezone` prop, compares against browser TZ. `dashboard/page.tsx` queries `timezone: true` and passes `storedTimezone`. |
| 17 | Show password toggle button is vertically centered within the password input on login and register forms | VERIFIED | `login-form.tsx` line 104: `top-1/2 -translate-y-1/2` (1 match). `register-form.tsx` lines 103, 138: `top-1/2 -translate-y-1/2` (2 matches). Old `top-0` positioning absent. |
| 18 | Watering a plant that is already in Recently Watered does not cause a flicker | VERIFIED | `dashboard-client.tsx` function `movePlantToRecentlyWatered` (lines 23-63): checks `alreadyInRecent` before prepending. If already in group, keeps as-is. Old `removePlantFromGroups`/`removeFromGroups` — 0 matches. |
| 19 | Onboarding seed creates the correct number of plants matching the selected plantCountRange | VERIFIED | `demo/actions.ts`: `plantCountRange` param (line 91), `TARGET_COUNTS` Record (line 96), `additionalProfiles` fetch with `notIn` filter (lines 118-123). `onboarding-banner.tsx` line 45: `seedStarterPlants(range)` passes range. |
| 20 | Long plant names without word breaks are truncated with ellipsis and do not overflow their containers | VERIFIED | `dashboard-plant-card.tsx` line 136: `truncate break-all`. `plant-card.tsx` line 54: `truncate break-all`. Both confirmed present. |

**Score:** 20/20 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/layout/bottom-tab-bar.tsx` | Mobile-only fixed bottom nav bar (min 40 lines) | VERIFIED | Substantive, wired via layout.tsx |
| `src/components/ui/drawer.tsx` | Base UI Drawer wrapper with safe-area footer (min 50 lines) | VERIFIED | Wraps @base-ui/react/drawer, DrawerFooter has `pb-[calc(1rem+env(safe-area-inset-bottom))]` |
| `src/components/shared/responsive-dialog.tsx` | Responsive Dialog/Drawer wrapper (min 40 lines) | VERIFIED | Context-based switching, exports ResponsiveDialogFooter |
| `src/hooks/use-media-query.ts` | Client-side media query hook (min 15 lines) | VERIFIED | Uses window.matchMedia |
| `src/hooks/use-focus-heading.ts` | Hook that focuses h1 on pathname change (min 10 lines) | VERIFIED | MutationObserver-based, streaming-safe |
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

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `layout.tsx` | `bottom-tab-bar.tsx` | import and render | WIRED | Line 12 import, line 99 render |
| `bottom-tab-bar.tsx` | `usePathname` | active tab detection | WIRED | `pathname.startsWith` pattern |
| `responsive-dialog.tsx` | `drawer.tsx` | conditional render on mobile | WIRED | Drawer imports, context switch |
| `responsive-dialog.tsx` | `dialog.tsx` | conditional render on desktop | WIRED | Dialog imports, fallback |
| `add-plant-dialog.tsx` | `responsive-dialog.tsx` | import replacement | WIRED | Lines 10-14 |
| `edit-plant-dialog.tsx` | `responsive-dialog.tsx` | ResponsiveDialogFooter import | WIRED | Line 12 |
| `layout.tsx` | `focus-heading.tsx` | import and render | WIRED | Line 11 import, render confirmed |
| `focus-heading.tsx` | `use-focus-heading.ts` | hook invocation | WIRED | useFocusHeading() call |
| `plants/page.tsx` | `queries.ts` | getPlants with page param | WIRED | Pagination import, page param |
| `dashboard/page.tsx` | `empty-state.tsx` | empty state rendering | WIRED | Import, render confirmed |
| `dashboard/page.tsx` | `timezone-warning.tsx` | storedTimezone prop from server query | WIRED | `storedTimezone={user?.timezone ?? null}` |
| `timezone-sync.tsx` | `auth/actions.ts` | updateTimezone Server Action call | WIRED | Import, call confirmed |
| `loading.tsx files (x3)` | `skeleton.tsx` | import Skeleton | WIRED | All three import and use Skeleton |
| `onboarding-banner.tsx` | `demo/actions.ts` | seedStarterPlants(range) | WIRED | Line 45: `seedStarterPlants(range)` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `bottom-tab-bar.tsx` | notificationCount | layout.tsx server query | Yes -- Prisma query | FLOWING |
| `pagination.tsx` | currentPage, totalPages | getPlants with count | Yes -- Prisma findMany + count | FLOWING |
| `timezone-warning.tsx` | storedTimezone | dashboard server query (user.timezone) | Yes -- Prisma select | FLOWING |
| `timezone-sync.tsx` | timezone | updateTimezone Server Action | Yes -- writes to User.timezone via Prisma | FLOWING |
| `dashboard-client.tsx` | optimisticGroups | movePlantToRecentlyWatered + server revalidation | Yes -- Prisma-backed real data | FLOWING |
| `demo/actions.ts` | allProfiles | careProfiles + additionalProfiles DB queries | Yes -- Prisma findMany with range-based targetCount | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All tests pass (no regressions) | `npx vitest run` | 77 passed, 88 todo, 0 failures | PASS |
| Password toggle centering (login) | grep login-form.tsx | `top-1/2 -translate-y-1/2` found line 104 (1 match) | PASS |
| Password toggle centering (register) | grep register-form.tsx | `top-1/2 -translate-y-1/2` found lines 103, 138 (2 matches) | PASS |
| Flicker-free optimistic update | grep dashboard-client.tsx | `movePlantToRecentlyWatered` (2 matches), old function (0 matches) | PASS |
| Long name overflow protection | grep for truncate break-all | found in both dashboard-plant-card.tsx and plant-card.tsx | PASS |
| Seed count range mapping | grep demo/actions.ts | `plantCountRange`, `TARGET_COUNTS`, `additionalProfiles` all found | PASS |
| Range passed to seeder | grep onboarding-banner.tsx | `seedStarterPlants(range)` found line 45 | PASS |
| BottomTabBar focus-visible ring | grep bottom-tab-bar.tsx | `focus-visible:ring-2 focus-visible:ring-ring/50` found | PASS |
| WCAG audit block in globals.css | grep globals.css | `WCAG AA Contrast Audit (Phase 7)` found line 84 | PASS |
| User model has timezone | grep schema.prisma | `timezone String?` found line 20 | PASS |
| MutationObserver in focus hook | grep use-focus-heading.ts | `MutationObserver` found line 22 | PASS |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| UIAX-01 | 07-01, 07-02, 07-06, 07-07 | App is responsive and touch-friendly on mobile, optimized on desktop | SATISFIED | BottomTabBar, responsive grids, touch targets (44px), responsive dialogs, drawer safe-area padding, loading skeletons, password button centering, flicker-free watering, long name overflow |
| UIAX-02 | 07-03, 07-05, 07-06 | App meets WCAG AA contrast and keyboard navigation requirements | SATISFIED | Contrast adjusted with audit doc; FocusHeading with MutationObserver; h1 tabIndex; skip link; aria-labels; focus-visible rings |
| UIAX-03 | 07-03 | Forms have proper labels; status uses more than just color | SATISFIED | Status badges have icon + text + color (5 icon types), aria-hidden on decorative icons, FormMessage for inline errors |
| UIAX-04 | 07-04 | Empty states provide helpful guidance | SATISFIED | EmptyState component in 4 pages with icon + heading + body + action CTA |

All 4 phase requirements are marked Complete in REQUIREMENTS.md. No orphaned or unmapped requirements found for Phase 7.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | - | - | - | - |

No TODOs, FIXMEs, placeholders, or stub patterns detected in Plan 07-07 modified files.

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
**Why human:** Safe area inset behavior requires testing on a notched/home-bar device.

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

No programmatic gaps. All 4 previously documented gaps from Plan 07-07 are confirmed closed:

1. **Gap 1 (password toggle centering) — CLOSED:** `login-form.tsx` and `register-form.tsx` both use `top-1/2 -translate-y-1/2` (3 total matches across 2 files).
2. **Gap 2 (watering flicker) — CLOSED:** `movePlantToRecentlyWatered` function with `alreadyInRecent` guard eliminates remove-then-reappear cycle. Old `removePlantFromGroups`/`removeFromGroups` fully replaced (0 matches).
3. **Gap 3 (seed count mismatch) — CLOSED:** `seedStarterPlants()` accepts `plantCountRange`, maps to target counts via `TARGET_COUNTS`, fetches additional CareProfile entries when needed. `onboarding-banner.tsx` passes `range` to the seeder.
4. **Gap 4 (long name overflow) — CLOSED:** `truncate break-all` applied to plant nickname paragraphs in both `dashboard-plant-card.tsx` and `plant-card.tsx`.

Automated test suite: 77 passed, 0 failures.

The 7 remaining human verification items (visual layout, drawer gestures, safe-area spacing, keyboard navigation, screen reader, streaming focus, timezone warning) require browser/device testing and cannot be closed programmatically.

---

_Verified: 2026-04-16T05:00:00Z_
_Verifier: Claude (gsd-verifier)_

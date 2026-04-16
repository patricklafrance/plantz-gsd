---
phase: 07-polish-and-accessibility
verified: 2026-04-16T23:55:00Z
status: human_needed
score: 16/16 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 13/13
  gaps_closed: []
  gaps_remaining: []
  regressions: []
  new_items_verified:
    - "Edit plant bottom drawer has properly spaced buttons with safe area padding on mobile"
    - "Focus automatically moves to h1 heading after client-side navigation, even with streamed/suspended content"
    - "Timezone mismatch warning banner appears on dashboard when browser timezone differs from stored preference"
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
**Verified:** 2026-04-16T23:55:00Z
**Status:** human_needed
**Re-verification:** Yes -- after UAT gap closure (Plan 07-06)

## Goal Achievement

All 13 must-haves from the previous verification remain verified (quick regression checks passed). 3 new must-haves from Plan 06 (UAT gap closure) are also verified, bringing the total to 16/16. Human verification items expanded to cover the new Plan 06 fixes.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Bottom tab bar visible on mobile (<640px) with Dashboard, Plants, Rooms, Notifications tabs | VERIFIED | `bottom-tab-bar.tsx` (62 lines): 4 tabs, `sm:hidden`, `min-h-[44px]`, `pb-[env(safe-area-inset-bottom)]`, notification badge. Wired in layout.tsx line 99. |
| 2 | Top nav Plants/Rooms links hidden on mobile, visible on desktop | VERIFIED | `layout.tsx` line 74: `hidden items-center gap-4 sm:flex`. NotificationBell wrapped with `hidden sm:block`. |
| 3 | All interactive elements meet 44x44px minimum touch target on mobile | VERIFIED | `min-h-[44px]` in: bottom-tab-bar.tsx, filter-chips.tsx, dashboard-plant-card.tsx, room-card.tsx, user-menu.tsx. |
| 4 | Card grids reflow to 1 column on mobile, 2 on sm, 3 on lg | VERIFIED | `sm:grid-cols-2 lg:grid-cols-3` in rooms/page.tsx, dashboard/page.tsx, plant-grid.tsx, dashboard-section.tsx, all loading.tsx files. |
| 5 | Skip-to-content link is first tabbable element in layout | VERIFIED | `layout.tsx` lines 47-51: `<a href="#main-content" className="sr-only focus:not-sr-only ...">Skip to content</a>` before header. `id="main-content"` on main at line 96. |
| 6 | After client-side navigation, focus moves to new page's h1 (streaming-safe) | VERIFIED | `use-focus-heading.ts` (50 lines): MutationObserver-based. Tries querySelector immediately, falls back to observer for streamed h1. 3-second safety timeout. `FocusHeading` rendered in layout.tsx line 54. All page h1 elements have `tabIndex={-1}` and `outline-none`. |
| 7 | Modals render as bottom-up sheet drawers on mobile, centered dialogs on desktop | VERIFIED | `responsive-dialog.tsx` (126 lines): context-based switching at 639px. `drawer.tsx` (145 lines): wraps @base-ui/react/drawer. Three consumers import from responsive-dialog (add-plant, edit-plant, log-watering). |
| 8 | Every status badge has icon + text + color -- no color-only indicators | VERIFIED | `dashboard-plant-card.tsx`: AlertTriangle, Droplets, Clock, CheckCircle2 with `aria-hidden="true"`. `plant-card.tsx`: AlertTriangle, Droplets, Clock, HelpCircle with `aria-hidden="true"`. All badges have `gap-1.5 items-center`. |
| 9 | WCAG AA contrast: accent and muted-foreground darkened to pass 4.5:1 | VERIFIED | `globals.css`: `--muted-foreground: oklch(0.45 0 0)`, `--accent: oklch(0.50 0.11 155)`, `--ring: oklch(0.50 0.11 155)`. Full audit comment block at line 84. |
| 10 | Watering log failure toast includes Retry action button | VERIFIED | `dashboard-client.tsx` lines 76 and 89: both error paths include `label: "Retry"` action. |
| 11 | Loading skeleton pages exist for dashboard, plants, and rooms routes | VERIFIED | `dashboard/loading.tsx` (32 lines), `plants/loading.tsx` (37 lines), `rooms/loading.tsx` (32 lines). All import Skeleton, export default, use responsive grids. |
| 12 | All interactive elements from Plans 01-04 have visible focus-visible rings | VERIFIED | `bottom-tab-bar.tsx`: `focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1 rounded-md`. `filter-chips.tsx`: `focus-visible:ring-2 focus-visible:ring-ring/50`. Button-based elements inherit from buttonVariants. |
| 13 | WCAG AA Contrast Audit comment block documented in globals.css | VERIFIED | `globals.css` line 84: `WCAG AA Contrast Audit (Phase 7)` block with all OKLCH tokens, contrast ratios, pass/fail, and adjustment history. |
| 14 | Edit plant bottom drawer has properly spaced buttons with safe area padding on mobile | VERIFIED | `drawer.tsx` DrawerFooter (line 94): `pb-[calc(1rem+env(safe-area-inset-bottom))]`. `edit-plant-dialog.tsx` (line 12): imports `ResponsiveDialogFooter as DialogFooter`, uses it at line 215. |
| 15 | Focus automatically moves to h1 heading after client-side navigation, even with streamed/suspended content | VERIFIED | `use-focus-heading.ts`: MutationObserver replaces 50ms setTimeout. Immediate querySelector attempt (line 13), observer fallback (line 22), 3-second safety timeout (line 37), proper cleanup (line 44). |
| 16 | Timezone mismatch warning banner appears on dashboard when browser timezone differs from stored preference | VERIFIED | Full data flow: `schema.prisma` has `timezone String?` (line 20). `auth/actions.ts` has `updateTimezone` (line 61) with auth/demo/validation guards and idempotency. `timezone-sync.tsx` calls `updateTimezone` with `tz_stored` cookie flag. `timezone-warning.tsx` accepts `storedTimezone` prop (line 11), compares against browser TZ. `dashboard/page.tsx` queries `timezone: true` (line 120) and passes `storedTimezone` (line 132). |

**Score:** 16/16 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/layout/bottom-tab-bar.tsx` | Mobile-only fixed bottom nav bar (min 40 lines) | VERIFIED | 62 lines, substantive, wired via layout.tsx |
| `src/components/ui/drawer.tsx` | Base UI Drawer wrapper with safe-area footer (min 50 lines) | VERIFIED | 145 lines, wraps @base-ui/react/drawer, DrawerFooter has safe-area padding |
| `src/components/shared/responsive-dialog.tsx` | Responsive Dialog/Drawer wrapper (min 40 lines) | VERIFIED | 126 lines, context-based switching, exports ResponsiveDialogFooter, used by 3 consumers |
| `src/hooks/use-media-query.ts` | Client-side media query hook (min 15 lines) | VERIFIED | 17 lines, uses window.matchMedia |
| `src/hooks/use-focus-heading.ts` | Hook that focuses h1 on pathname change (min 10 lines) | VERIFIED | 50 lines, MutationObserver-based, streaming-safe |
| `src/components/shared/focus-heading.tsx` | Thin Client Component wrapper (min 5 lines) | VERIFIED | 7 lines, invokes useFocusHeading, rendered in layout.tsx |
| `src/components/shared/pagination.tsx` | Previous/Next pagination (min 30 lines) | VERIFIED | 64 lines, preserves URL params, used by plants/page.tsx |
| `src/components/shared/empty-state.tsx` | Shared EmptyState component (min 25 lines) | VERIFIED | 35 lines, icon/heading/body/action slots, used by 4 pages |
| `src/components/shared/timezone-warning.tsx` | Dismissible timezone mismatch banner (min 15 lines) | VERIFIED | 51 lines, accepts storedTimezone prop, compares browser TZ against DB value |
| `src/app/(main)/dashboard/loading.tsx` | Skeleton loading page (min 15 lines) | VERIFIED | 32 lines, imports Skeleton, responsive grid |
| `src/app/(main)/plants/loading.tsx` | Skeleton loading page (min 15 lines) | VERIFIED | 37 lines, imports Skeleton, search skeleton + responsive grid |
| `src/app/(main)/rooms/loading.tsx` | Skeleton loading page (min 15 lines) | VERIFIED | 32 lines, imports Skeleton, responsive grid |
| `prisma/schema.prisma` | User model with timezone column | VERIFIED | Line 20: `timezone String?` |
| `src/components/watering/timezone-sync.tsx` | Timezone sync that persists to DB on first visit | VERIFIED | Calls updateTimezone, uses tz_stored cookie flag |
| `src/features/auth/actions.ts` | updateTimezone Server Action | VERIFIED | Auth-guarded, demo-guarded, validated, idempotent |
| `src/components/plants/edit-plant-dialog.tsx` | Edit dialog using ResponsiveDialogFooter | VERIFIED | Line 12 imports ResponsiveDialogFooter, line 215 uses DialogFooter |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| layout.tsx | bottom-tab-bar.tsx | import and render | WIRED | Line 12 import, line 99 render |
| bottom-tab-bar.tsx | usePathname | active tab detection | WIRED | `pathname.startsWith` pattern |
| responsive-dialog.tsx | drawer.tsx | conditional render on mobile | WIRED | Drawer imports, context switch |
| responsive-dialog.tsx | dialog.tsx | conditional render on desktop | WIRED | Dialog imports, fallback |
| add-plant-dialog.tsx | responsive-dialog.tsx | import replacement | WIRED | Lines 10-14 |
| edit-plant-dialog.tsx | responsive-dialog.tsx | ResponsiveDialogFooter import | WIRED | Line 12 |
| layout.tsx | focus-heading.tsx | import and render | WIRED | Line 11 import, line 54 render |
| focus-heading.tsx | use-focus-heading.ts | hook invocation | WIRED | useFocusHeading() call |
| plants/page.tsx | queries.ts | getPlants with page param | WIRED | Pagination import, page param |
| dashboard/page.tsx | empty-state.tsx | empty state rendering | WIRED | Line 11 import, line 85 render |
| dashboard/page.tsx | timezone-warning.tsx | storedTimezone prop from server query | WIRED | Line 132: `storedTimezone={user?.timezone ?? null}` |
| timezone-sync.tsx | auth/actions.ts | updateTimezone Server Action call | WIRED | Line 4 import, line 20 call |
| loading.tsx files (x3) | skeleton.tsx | import Skeleton | WIRED | All three import and use Skeleton |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| bottom-tab-bar.tsx | notificationCount | layout.tsx server query | Yes -- Prisma query | FLOWING |
| pagination.tsx | currentPage, totalPages | getPlants with count | Yes -- Prisma findMany + count | FLOWING |
| empty-state.tsx | icon, heading, body | Props from page components | Static props per UI-SPEC | FLOWING |
| timezone-warning.tsx | storedTimezone | dashboard server query (user.timezone) | Yes -- Prisma select | FLOWING |
| timezone-sync.tsx | timezone | updateTimezone Server Action | Yes -- writes to User.timezone via Prisma | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All tests pass | `npx vitest run` | 77 passed, 88 todo, 0 failures | PASS |
| DrawerFooter safe-area padding | grep drawer.tsx | `pb-[calc(1rem+env(safe-area-inset-bottom))]` found line 94 | PASS |
| MutationObserver in focus hook | grep use-focus-heading.ts | `MutationObserver` found line 22 | PASS |
| User model has timezone | grep schema.prisma | `timezone String?` found line 20 | PASS |
| Dashboard passes storedTimezone | grep dashboard/page.tsx | `storedTimezone={user?.timezone ?? null}` found line 132 | PASS |
| BottomTabBar focus-visible ring | grep bottom-tab-bar.tsx | `focus-visible:ring-2 focus-visible:ring-ring/50` found | PASS |
| FilterChips focus-visible ring | grep filter-chips.tsx | `focus-visible:ring-2 focus-visible:ring-ring/50` found | PASS |
| WCAG audit block in globals.css | grep globals.css | `WCAG AA Contrast Audit (Phase 7)` found line 84 | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| UIAX-01 | 07-01, 07-02, 07-06 | App is responsive and touch-friendly on mobile, optimized on desktop | SATISFIED | BottomTabBar, responsive grids, touch targets (44px), responsive dialogs, drawer safe-area padding, loading skeletons |
| UIAX-02 | 07-03, 07-05, 07-06 | App meets WCAG AA contrast and keyboard navigation requirements | SATISFIED | Contrast adjusted with audit doc; FocusHeading with MutationObserver; h1 tabIndex; skip link; aria-labels; focus-visible rings |
| UIAX-03 | 07-03 | Forms have proper labels; status uses more than just color | SATISFIED | Status badges have icon + text + color (5 icon types), aria-hidden on decorative icons, FormMessage for inline errors |
| UIAX-04 | 07-04 | Empty states provide helpful guidance | SATISFIED | EmptyState component in 4 pages (dashboard, plants, rooms, room detail) with icon + heading + body + action CTA |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | - | - | - | - |

No TODOs, FIXMEs, placeholders, or stub patterns detected in Plan 06 modified files.

### Human Verification Required

### 1. Mobile Bottom Tab Bar Layout
**Test:** Open app on a 375px viewport. Verify bottom tab bar shows 4 tabs.
**Expected:** Dashboard, Plants, Rooms, Alerts tabs visible at bottom; top nav Plants/Rooms links hidden.
**Why human:** Responsive layout behavior requires visual viewport testing.

### 2. Drawer Sheet on Mobile
**Test:** On 375px viewport, tap "Add Plant" button. Verify dialog opens as bottom sheet.
**Expected:** Add Plant dialog slides up from bottom with rounded corners. Swipe down to dismiss.
**Why human:** Touch gesture interaction and visual drawer rendering require device testing.

### 3. Drawer Footer Safe-Area Spacing (Plan 06 fix)
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

### 6. Focus After Navigation with Streaming (Plan 06 fix)
**Test:** Navigate between pages using nav links. Verify focus moves to h1 heading even when content streams in via Suspense.
**Expected:** After clicking Plants link, focus should be on the "My Plants" h1. MutationObserver handles streamed content.
**Why human:** Client-side focus management with streaming requires live browser interaction.

### 7. Timezone Mismatch Warning (Plan 06 fix)
**Test:** Manually set user's timezone column in DB to a different timezone than browser (e.g., "Asia/Tokyo"), reload dashboard.
**Expected:** Timezone mismatch warning banner appears with dismiss button. Dismissing persists for the browser session.
**Why human:** Timezone detection and DB-vs-browser comparison requires manual DB manipulation.

### Gaps Summary

No gaps found. All 16 must-haves pass programmatic verification across existence (L1), substance (L2), wiring (L3), and data flow (L4) checks. All 4 UIAX requirements are satisfied. Plan 06 UAT fixes (drawer safe-area, MutationObserver focus, DB-backed timezone warning) are properly implemented and wired.

Phase goal is programmatically achieved. 7 human verification items remain for visual/interactive testing before phase closure.

---

_Verified: 2026-04-16T23:55:00Z_
_Verifier: Claude (gsd-verifier)_

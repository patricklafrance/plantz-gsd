# Phase 7: Polish and Accessibility - Research

**Researched:** 2026-04-15
**Domain:** Mobile responsiveness, WCAG AA accessibility, edge case hardening, UI polish
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Mobile Layout Strategy**
- D-01: Bottom tab bar on mobile with 3-4 icons (Dashboard, Plants, Rooms, Notification bell). Fixed at bottom, thumb-friendly. Top header retained for branding and user menu.
- D-02: Card grids reflow to single column on mobile (<640px), 2-col on tablet, 3-col on desktop. Standard responsive stacking.
- D-03: All interactive elements (buttons, pills, toggles, links) must meet 44x44px minimum touch target. Systematic audit of every interactive element, padding adjustments only.
- D-04: Modals (add plant, edit plant, log watering) become full-screen bottom-up sheets on mobile. Better form UX on small screens.

**Accessibility — Keyboard and Screen Reader**
- D-05: Full keyboard navigation flow: Tab through all elements in logical order, Enter/Space to activate, Escape to close dialogs. Visible focus rings on all interactive elements. Skip-to-content link on every page.
- D-06: Aria-live regions for key actions only: watering logged, reminder snoozed, plant added/deleted, error messages. No live regions for routine UI updates like filter changes.
- D-07: Every status indicator (overdue, due today, upcoming, recently watered) gets an icon AND text label alongside color. No color-only status anywhere.
- D-08: Reduced motion: skip for v1. Animations are minimal (toast, dialog transitions) — not worth the effort now.

**Accessibility — Structure and Audit**
- D-09: Trust shadcn/ui Form component defaults for form accessibility. Only fix gaps found during manual testing — no proactive fieldset/legend restructuring.
- D-10: Audit and fix all custom colors against WCAG AA 4.5:1 contrast ratio. Status badges, onboarding banner gradient, card borders, text on colored backgrounds — everything custom gets checked.
- D-11: Standardize heading hierarchy across all pages. Each page gets exactly one h1, sections use h2, subsections h3. No skipped levels.
- D-12: Focus heading on client-side navigation — after route change, move focus to the new page's h1. Screen reader users know they've arrived.
- D-13: Verify and add landmark roles across both layout groups. Ensure <nav>, <main>, <header>, <footer> semantic elements are correct. Add aria-label to distinguish multiple nav regions (top nav vs bottom tab bar).

**Edge Case Hardening**
- D-14: Enforce character limits on text inputs: plant nicknames and room names get a max character limit (e.g., 40 chars) at the input level. Prevents overflow issues at the source.
- D-15: Server-side pagination on the plants collection page (20-30 per page). Dashboard stays unpaginated but limits each urgency section. Handles 100+ plant collections gracefully.
- D-16: Graceful error states for network failures. Server Actions show inline error messages on failure. Failed watering logs show retry option. Loading skeletons for slow data fetches. No data loss on network hiccups.
- D-17: All dates display in user's browser local timezone. "Due today" calculated from local midnight. Server stores UTC (TIMESTAMPTZ already in place). Add timezone mismatch warning if server/client disagree.

### Claude's Discretion
- Empty state polish — whether to create a shared EmptyState component, add icons/illustrations, or keep existing text-based empty states
- Bottom tab bar icon selection and visual treatment
- Exact character limits for plant nicknames and room names
- Pagination UI design (page numbers, load more button, or infinite scroll)
- Loading skeleton design for slow data fetches
- Specific icon choices for status indicators (overdue, due today, etc.)
- Focus ring styling (color, width, offset)
- Skip-to-content link styling and positioning

### Deferred Ideas (OUT OF SCOPE)
- Empty state polish (shared component, illustrations) — left to Claude's discretion
- Reduced motion / prefers-reduced-motion support — deferred to post-v1
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UIAX-01 | App is responsive and touch-friendly on mobile, optimized on desktop | D-01 through D-04; Base UI Drawer primitive; Tailwind sm: breakpoints; 44px touch targets |
| UIAX-02 | App meets WCAG AA contrast and keyboard navigation requirements | D-05, D-10 through D-13; OKLCH contrast analysis; Base UI focus-visible patterns; skip link pattern |
| UIAX-03 | Forms have proper labels; status uses more than just color | D-06, D-07, D-09; existing shadcn/ui Form + aria-invalid; icon+text badge pattern |
| UIAX-04 | Empty states provide helpful guidance (no plants, no history, no rooms) | D-15, D-16; existing EmptyFilterState pattern; shared EmptyState component approach |
</phase_requirements>

---

## Summary

Phase 7 is a hardening and polish phase with no new features. The existing codebase is in good shape — shadcn/ui (via Base UI primitives) provides solid accessibility foundations, focus-visible patterns are consistent across interactive elements, and aria-label coverage is already strong in key areas (WaterButton, NotificationBell, user menu, search bar). The primary gaps are mobile layout (no bottom tab bar, dialogs not adaptive, grid columns not fully responsive), color-only status indicators on badges, touch targets on small/icon buttons (h-8 = 32px, below the 44px threshold), and the heading hierarchy has a minor issue (empty-state h2s use identical styling to h1s).

The key infrastructure finding is that **Base UI `Drawer` is already available** (installed as `@base-ui/react@^1.4.0`). The project is NOT using Radix UI — it uses Base UI throughout all existing components. The mobile bottom sheet pattern for dialogs must use `@base-ui/react/drawer`, not shadcn/ui's Sheet (which is Radix-based and not installed). The existing `dialog.tsx` uses `@base-ui/react/dialog` — this pattern must be extended with a responsive wrapper that switches to `Drawer` at the `sm:` breakpoint.

The pagination approach for plants must integrate with the existing URL-param-based filter/sort system already in `plants/page.tsx`. Adding a `page` query param follows the same pattern as `room`, `search`, `status`, and `sort` already in use.

**Primary recommendation:** Work through this phase in logical groups — (1) mobile layout and touch targets, (2) accessibility audit and fixes, (3) edge case hardening and pagination. Each group is independently testable.

---

## Standard Stack

### Core (already installed — no new packages needed)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| `@base-ui/react` | `^1.4.0` | Drawer primitive for mobile bottom sheets | INSTALLED [VERIFIED: package.json] |
| Tailwind CSS v4 | `^4.x` | `sm:` breakpoints for responsive layouts | INSTALLED [VERIFIED: package.json] |
| `lucide-react` | `^1.8.0` | Status icons (AlertCircle, Clock, CheckCircle2, Droplets) | INSTALLED [VERIFIED: package.json] |
| `clsx` + `tailwind-merge` | latest | `cn()` for conditional class merging | INSTALLED [VERIFIED: package.json] |

### No New Packages Required

All capabilities needed for Phase 7 exist in the current dependency graph. Specifically:
- Bottom sheets: `@base-ui/react/drawer` (already installed, not yet used)
- Focus management: `useRef` + `element.focus()` — native DOM, no library
- Contrast checking: manual OKLCH math + browser DevTools — no runtime library
- Skip links: pure HTML anchor + CSS — no library
- Pagination: Prisma `skip`/`take` + URL params — no library

### Alternatives Considered

| Instead of | Could Use | Why Standard Wins |
|------------|-----------|-------------------|
| `@base-ui/react/drawer` for sheets | Radix `@radix-ui/react-dialog` with slide animation | Project is all-in on Base UI — mixing Radix creates inconsistency and doubles bundle |
| URL-param pagination | React state pagination | URL params preserve state on refresh, back button, and sharing — consistent with existing filter pattern |
| `usePathname` focus hook | Third-party focus-management library | Native hook is sufficient; library adds unnecessary weight |

---

## Architecture Patterns

### Recommended Project Structure (additions only)

```
src/
├── components/
│   ├── layout/
│   │   └── bottom-tab-bar.tsx       # Mobile navigation (new)
│   ├── ui/
│   │   └── drawer.tsx               # Base UI Drawer wrapper (new)
│   └── shared/
│       └── empty-state.tsx          # Shared EmptyState component (new, discretion)
├── hooks/
│   └── use-focus-heading.ts         # Focus h1 after client-side nav (new)
└── app/
    └── (main)/
        └── layout.tsx               # Add bottom-tab-bar + skip link (modify)
```

### Pattern 1: Bottom Tab Bar (Mobile-Only)

**What:** A `<nav>` fixed to the bottom of the viewport, visible only below `sm:` breakpoint (640px). Uses `md:hidden` to hide it on desktop where the top nav handles navigation.

**When to use:** Mobile screens only. The existing top header nav (`Plants`, `Rooms` links) should be hidden on mobile with `hidden sm:flex` since the bottom bar replaces it.

**Implementation note:** The NotificationBell is currently in the top header. The bottom tab bar needs a bell icon tab. On mobile, the header's bell can be hidden with `sm:hidden`, or the bell tab on the bottom bar can open the same dropdown.

```tsx
// src/components/layout/bottom-tab-bar.tsx
// Source: Base UI patterns + Tailwind v4 responsive [ASSUMED: pattern]
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Leaf, DoorOpen, Bell } from "lucide-react";

const tabs = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/plants", icon: Leaf, label: "Plants" },
  { href: "/rooms", icon: DoorOpen, label: "Rooms" },
  // Bell tab: renders NotificationBell or links to notification dropdown
] as const;
```

The bottom tab bar needs `pb-safe` (safe-area-inset-bottom) padding for iOS notch/home bar. Use Tailwind's `pb-safe` or `pb-[env(safe-area-inset-bottom)]` [ASSUMED: pattern — verify against Tailwind v4 docs].

**In `(main)/layout.tsx`:**
- Wrap `<main>` with `pb-16 sm:pb-0` to prevent content from hiding behind the fixed tab bar
- Add `<BottomTabBar ... />` after `<main>`, outside it, inside the outer `div`

### Pattern 2: Responsive Modal → Drawer Sheet

**What:** Dialogs that are centered modals on desktop become full-screen bottom-up sheets on mobile. The switch happens at the `sm:` breakpoint.

**Implementation approach:** Create a `ResponsiveDialog` wrapper that renders `@base-ui/react/dialog` on `sm:` and above, and `@base-ui/react/drawer` on mobile. Use a `useMediaQuery("(max-width: 639px)")` hook to switch between them client-side.

**Alternative simpler approach:** Modify `DialogContent` to include mobile-responsive classes — position fixed at bottom with `rounded-t-xl` and `h-[90vh]` on small screens:

```tsx
// Tailwind v4 responsive pattern for dialog → sheet
// On mobile: slide up from bottom; on desktop: centered
className={cn(
  // Mobile: bottom sheet
  "fixed bottom-0 left-0 right-0 z-50 rounded-t-xl sm:rounded-xl",
  // Desktop: centered
  "sm:top-1/2 sm:left-1/2 sm:bottom-auto sm:right-auto sm:-translate-x-1/2 sm:-translate-y-1/2",
  "w-full sm:max-w-[32rem]",
  // Animation: slide up on mobile, zoom on desktop
  "data-open:animate-in data-open:slide-in-from-bottom sm:data-open:slide-in-from-bottom-0 sm:data-open:zoom-in-95",
  className
)}
```

**Tradeoff:** The CSS-only approach is simpler but the animation feels different on mobile vs desktop. The `Drawer` primitive approach gives native swipe-to-dismiss. Since D-04 says "better form UX on small screens" and the dialogs are heavy (multi-step add-plant), native Drawer is the right choice for the full experience.

**Base UI Drawer API:**

```tsx
// Source: @base-ui/react/drawer (installed, not yet used)
import { Drawer } from "@base-ui/react/drawer";

<Drawer.Root>
  <Drawer.Trigger />
  <Drawer.Portal>
    <Drawer.Backdrop />
    <Drawer.Popup className="fixed bottom-0 left-0 right-0 rounded-t-xl bg-popover p-4">
      <Drawer.Title />
      <Drawer.Description />
      {/* content */}
      <Drawer.Close />
    </Drawer.Popup>
  </Drawer.Portal>
</Drawer.Root>
```

[VERIFIED: @base-ui/react/drawer package structure — drawer/index.d.ts shows Root, Trigger, Portal, Backdrop, Popup, Title, Description, Close, SwipeArea components]

### Pattern 3: Touch Target Audit

**What:** Systematically identify every interactive element below 44x44px and add padding to expand the hit area without changing visual size.

**Known violations (from codebase audit):**

| Component | Current Size | Fix |
|-----------|-------------|-----|
| Button `size="default"` | h-8 (32px) | Add `min-h-[44px]` or use `size="lg"` (h-9 = 36px) for critical CTAs, or use padding expansion |
| Button `size="icon"` | size-8 (32px) | Add `min-h-[44px] min-w-[44px]` |
| Button `size="icon-sm"` | size-7 (28px) | Expand with padding or use `size="icon"` |
| UserMenu trigger | h-8 w-8 (32px) | Add `p-1.5` + adjust layout |
| Filter chip pills | h-7 (28px) | Add `min-h-[44px]` or `-my-2 py-2` to expand tap area |
| Snooze pills (1d, 2d, 1w) | `py-1.5` (est. ~28px) | Add `min-h-[44px]` via padding |
| Back-to-catalog button | text-sm link (est. ~20px) | Add `p-2` hit area |

**WaterButton** is already 44px (`h-11 w-11`) — no change needed. [VERIFIED: water-button.tsx line 23]

**Technique:** Use CSS padding expansion to meet 44px without changing visual appearance:
```css
/* Expand tap area via negative margin + equal padding trick */
.tap-target {
  margin: -8px;
  padding: 8px;
}
/* Or Tailwind: -m-2 p-2 on the interactive element */
```

### Pattern 4: Status Indicators — Icon + Text + Color

**What:** Every status badge currently uses color + text only. D-07 requires icon + text + color so status is not conveyed by color alone.

**Current state (from `dashboard-plant-card.tsx` and `plant-card.tsx`):**
- "Overdue" — red badge, text only
- "Due today" — green/accent badge, text only
- "In Xd" — outline badge, text only
- "Recently watered" — muted badge, text only

**Required additions:**

| Status | Icon | Text | Badge Color |
|--------|------|------|-------------|
| Overdue | `AlertTriangle` or `AlertCircle` | "Xd overdue" | red/destructive |
| Due today | `Droplets` or `Clock` | "Due today" | accent/green |
| Upcoming | `Clock` | "In Xd" | outline/muted |
| Recently watered | `CheckCircle2` or `Droplet` | "Watered Xh ago" | muted |
| Not scheduled | `HelpCircle` | "Every Xd" | outline |

```tsx
// Source: pattern derived from existing badge usage [ASSUMED: icon choices]
<Badge className="bg-destructive/10 text-destructive border-destructive/20 gap-1">
  <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
  {label}
</Badge>
```

Icons should be `aria-hidden="true"` since the text label is already present.

### Pattern 5: Focus-After-Navigation (D-12)

**What:** After a client-side route change, move focus to the new page's `<h1>`. Screen readers announce the new page title.

**Implementation using Next.js App Router:**

```tsx
// src/hooks/use-focus-heading.ts
"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function useFocusHeading() {
  const pathname = usePathname();
  useEffect(() => {
    const h1 = document.querySelector("h1");
    if (h1) {
      // h1 must be focusable — add tabIndex="-1" in the component
      (h1 as HTMLElement).focus({ preventScroll: false });
    }
  }, [pathname]);
}
```

Each page's `<h1>` must have `tabIndex={-1}` to be programmatically focusable (without appearing in tab order):

```tsx
<h1 tabIndex={-1} className="text-xl font-semibold outline-none">Dashboard</h1>
```

[ASSUMED: App Router focus management pattern — Next.js does not automatically move focus on navigation as of Next.js 16]

### Pattern 6: Skip-to-Content Link (D-05)

**What:** First keyboard-focusable element on every page. Visually hidden until focused. Jumps to `<main>` content.

```tsx
// In (main)/layout.tsx, before <header>
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:ring-2 focus:ring-ring"
>
  Skip to content
</a>
// <main> gets id="main-content"
```

[ASSUMED: standard skip-link pattern — widely documented in WCAG documentation]

### Pattern 7: Server-Side Pagination (D-15)

**What:** Plants collection page needs `skip`/`take` in the Prisma `getPlants` query. Page number passed as URL param `page` (integer, default 1). 20 plants per page.

**Integration with existing filter/sort:** The `PlantsPage` already accepts `searchParams` as a Promise. Add `page?: string` to the type and pass `parseInt(params.page ?? "1", 10)` to the query.

**Query change:**
```typescript
// In getPlants() — add to options and query
const PAGE_SIZE = 20;
const skip = (page - 1) * PAGE_SIZE;

return db.plant.findMany({
  where: { ... },
  include: { room: true, careProfile: true },
  orderBy,
  skip,
  take: PAGE_SIZE,
});
```

**Total count for pagination UI:** Add a `db.plant.count({ where })` query (same where clause) to compute total pages. This requires either a separate query or a Prisma `$transaction`.

**Pagination UI (Claude's discretion):** Simple page-number buttons or "Previous / Next" buttons using Link components with the current query params plus `page=N`. No infinite scroll — server-rendered pagination is simpler and more accessible.

### Pattern 8: ARIA Live Regions (D-06)

**What:** Sonner toasts already have `role="status"` / `aria-live="polite"` built in [ASSUMED: Sonner internal behavior — standard for toast libraries]. For key mutation feedback, the existing `toast()` calls are sufficient for most cases.

The one gap is watering log failures that need a retry option. Currently `toast.error("Couldn't log watering. Try again.")` has no retry button. Enhancement: use Sonner's `action` option:

```tsx
// Source: Sonner docs action pattern [ASSUMED: Sonner v2 API]
toast.error("Couldn't log watering.", {
  action: {
    label: "Retry",
    onClick: () => handleWater(plant),
  },
});
```

### Pattern 9: OKLCH Contrast Audit (D-10)

**Critical colors to verify against WCAG AA 4.5:1 for normal text, 3:1 for large text:**

| Token | Value | Use | Risk |
|-------|-------|-----|------|
| `--accent` | `oklch(0.62 0.10 155)` | Badge text, link text, icon | MEDIUM — need to verify against white/card bg |
| `--accent-foreground` | `oklch(0.98 0.004 155)` | Text on accent bg | LOW — near white on green should pass |
| `--muted-foreground` | `oklch(0.556 0 0)` | Secondary text, labels | MEDIUM — lightness 0.556 on white bg |
| `--destructive` | `oklch(0.577 0.245 27.325)` | Error text in badges | HIGH RISK — red on white-ish bg needs check |
| `text-accent on bg-accent/10` | Badge background pattern | Status badges | HIGH RISK — semi-transparent bg reduces contrast |
| `text-accent on bg-accent/15` | "Due today" badge | Dashboard cards | HIGH RISK |
| `text-muted-foreground on bg-muted/60` | Snooze pill labels | Dashboard | MEDIUM |

**Contrast calculation method:** OKLCH lightness can be used to estimate WCAG relative luminance. Lightness below ~0.45 for text on white passes 4.5:1. The accent color at L=0.62 may fail for normal text on white — this is the highest risk item.

**Recommended action:** Use browser DevTools (Chrome Accessibility panel) or an online WCAG checker to verify actual values during implementation. [ASSUMED: OKLCH contrast calculation — manual verification required]

### Anti-Patterns to Avoid

- **Using `outline: none` without a focus-visible replacement:** The `button.tsx` uses `outline-none` which suppresses the browser default, but pairs it with `focus-visible:border-ring focus-visible:ring-3` — this pattern is correct. Ensure no component adds `outline-none` without a visible replacement.
- **Aria-live on every mutation:** D-06 explicitly limits live regions to key actions. Don't wrap filter chips or sort dropdowns in live regions.
- **`h-auto` on interactive elements:** Allows buttons to collapse to zero height. Always enforce minimum height for touch targets.
- **Missing `tabIndex={-1}` on programmatically focused elements:** `element.focus()` silently fails on non-focusable elements. All h1s used in focus-after-nav must have `tabIndex={-1}`.
- **Responsive CSS on Base UI Drawer vs Dialog:** Base UI `Dialog` and `Drawer` are different components with different scroll lock and focus trap behaviors. Don't try to CSS-transform a Dialog into a sheet — use the actual Drawer component.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bottom sheet on mobile | Custom CSS slide-up panel | `@base-ui/react/drawer` | Focus trap, scroll lock, swipe-to-dismiss, keyboard Escape are handled |
| Contrast checking | Custom OKLCH math library | Browser DevTools Accessibility panel / online checker | Manual audit is sufficient; no runtime library needed |
| Focus trapping in dialogs | Custom focus trap logic | Already provided by Base UI Dialog/Drawer | Base UI handles focus trap, Escape key, and portal correctly |
| Skip link | Third-party a11y library | 4 lines of Tailwind CSS + anchor tag | No library needed for a simple anchor |
| Pagination offset math | Custom cursor-based pagination | Prisma `skip`/`take` with page number | Simple, sufficient for v1 scales; cursor pagination is unnecessary complexity |

**Key insight:** Base UI primitives already solve the hardest accessibility problems (focus trap, keyboard nav, ARIA roles) — this phase is about surfacing those capabilities consistently, not rebuilding them.

---

## Common Pitfalls

### Pitfall 1: Dialog vs Drawer Focus Trap Conflict
**What goes wrong:** If a Dialog and Drawer are both mounted at the same time (e.g., a confirmation inside a drawer), focus traps conflict.
**Why it happens:** Both Base UI Dialog and Drawer implement independent focus traps.
**How to avoid:** Keep modals single-layer. The add-plant dialog is already single-layer. If a confirmation is needed, use a separate dialog opened after the drawer closes.
**Warning signs:** Tab key escaping modal, or keyboard focus disappearing.

### Pitfall 2: Mobile Bottom Bar Hiding Content
**What goes wrong:** The last items in a scrollable list are hidden behind the fixed bottom tab bar.
**Why it happens:** Fixed positioning takes the element out of flow; content scrolls under it.
**How to avoid:** Add `pb-16` (or `pb-20` for iOS safe area) to `<main>` on mobile only — use `pb-16 sm:pb-0` on the main element.
**Warning signs:** Last card on plants page is partially cut off on mobile.

### Pitfall 3: Touch Target Padding Breaking Layout
**What goes wrong:** Adding `min-h-[44px]` to buttons inside flex rows causes layout to expand unexpectedly.
**Why it happens:** `min-h` affects the flex item's contribution to the row height.
**How to avoid:** Use negative-margin + padding expansion trick (`-m-2 p-2`) to expand the tap area without affecting layout dimensions. Or wrap the element in a `<span>` with the larger touch area.
**Warning signs:** Card rows become taller after touch target fix.

### Pitfall 4: Broken Heading Hierarchy in Empty States
**What goes wrong:** Dashboard empty state uses `<h2>` with same visual styling as the page `<h1>`. Screen readers announce two h2s when there's no h1 in the empty state path.
**Why it happens:** The `DashboardContent` component renders independently of the `DashboardPage` outer `h1`. When no plants exist, `DashboardPage`'s h1 ("Dashboard") is still rendered — the empty state h2 ("No plants yet") is correct hierarchically, but uses identical `text-xl font-semibold` styling, making it visually indistinguishable.
**How to avoid:** Use `text-lg font-semibold` or `text-base font-medium` for h2 empty state headings to create visual distinction. The markup hierarchy is actually correct.
**Warning signs:** Screen reader announces two identically-styled headings at the same visual weight.

### Pitfall 5: Timezone Mismatch Warning (D-17) Loop
**What goes wrong:** Timezone mismatch warning triggers every render if the server clock and client cookie timestamp drift by milliseconds.
**Why it happens:** Comparing `Date.now()` on server vs cookie set time is imprecise.
**How to avoid:** Compare timezone names (e.g., `"America/New_York"` vs `"UTC"`), not timestamps. Warn only when IANA timezone strings differ, not when there's minor drift.
**Warning signs:** Mismatch banner flashes on every page load.

### Pitfall 6: `usePathname` Focus Hook Server/Client Boundary
**What goes wrong:** The `useFocusHeading` hook using `usePathname` must be a Client Component. If placed in a Server Component layout, it will fail.
**Why it happens:** `usePathname` and `useEffect` are Client Component APIs.
**How to avoid:** Create a thin `<FocusHeading />` Client Component wrapper used in the layout.tsx — already a pattern used for `<TimezoneSync />`.

### Pitfall 7: Pagination Total Count Query Performance
**What goes wrong:** Running `db.plant.count({ where })` with the same filter on every page load is an extra DB round trip.
**Why it happens:** Pagination requires knowing total records.
**How to avoid:** Run `count()` and `findMany()` in parallel using `Promise.all()`. This is already the pattern in `plants/page.tsx` (it runs `totalPlantCount` alongside `getPlants`). Extend this to also compute total pages.

---

## Code Examples

### Bottom Tab Bar Structure

```tsx
// Source: Base UI + Tailwind v4 pattern [ASSUMED]
// src/components/layout/bottom-tab-bar.tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Leaf, DoorOpen } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/plants", icon: Leaf, label: "Plants" },
  { href: "/rooms", icon: DoorOpen, label: "Rooms" },
] as const;

export function BottomTabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main navigation"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      <div className="flex h-14 items-stretch">
        {TABS.map(({ href, icon: Icon, label }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 text-xs",
                isActive ? "text-accent" : "text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

### Skip Link

```tsx
// Source: WCAG 2.4.1 technique [ASSUMED: standard pattern]
// In (main)/layout.tsx before <header>
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-md focus:ring-2 focus:ring-ring"
>
  Skip to main content
</a>

// <main> element:
<main id="main-content" tabIndex={-1} className="mx-auto max-w-5xl px-4 py-6 pb-16 sm:pb-6 outline-none">
```

### Status Badge with Icon

```tsx
// Source: derived from existing badge patterns [ASSUMED: icon choices]
// In dashboard-plant-card.tsx getStatusBadge()
case "overdue": {
  const overdueDays = Math.abs(plant.daysUntil);
  return (
    <Badge className="bg-destructive/10 text-destructive border-destructive/20 gap-1.5 items-center">
      <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
      {overdueDays === 0 ? "Overdue" : `${overdueDays}d overdue`}
    </Badge>
  );
}
```

### Pagination Query (Prisma)

```typescript
// Source: Prisma docs — skip/take [ASSUMED: Prisma v7 pattern]
// In src/features/plants/queries.ts
const PAGE_SIZE = 20;

export async function getPlants(
  userId: string,
  options: {
    roomId?: string;
    search?: string;
    status?: "overdue" | "due-today" | "upcoming" | "archived";
    sort?: "next-watering" | "name" | "recently-added";
    todayStart?: Date;
    todayEnd?: Date;
    page?: number; // NEW
  } = {}
) {
  const { page = 1, ...rest } = options;
  const skip = (page - 1) * PAGE_SIZE;

  const [plants, totalCount] = await Promise.all([
    db.plant.findMany({ where, include, orderBy, skip, take: PAGE_SIZE }),
    db.plant.count({ where }),
  ]);

  return {
    plants,
    totalCount,
    totalPages: Math.ceil(totalCount / PAGE_SIZE),
    currentPage: page,
  };
}
```

### Focus After Navigation Hook

```tsx
// Source: Next.js App Router usePathname + useEffect [ASSUMED]
// src/hooks/use-focus-heading.ts
"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function useFocusHeading() {
  const pathname = usePathname();
  useEffect(() => {
    // Small delay to let the page render before focusing
    const id = setTimeout(() => {
      const h1 = document.querySelector<HTMLElement>("h1[tabindex='-1']");
      if (h1) h1.focus({ preventScroll: false });
    }, 50);
    return () => clearTimeout(id);
  }, [pathname]);
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Radix UI Sheet for bottom sheets | Base UI Drawer | This project never used Radix — Base UI was chosen from Phase 1 | Use `@base-ui/react/drawer` exclusively |
| Tailwind `@apply` config | CSS `@theme` directive (Tailwind v4) | Jan 2025 (Tailwind v4) | No `tailwind.config.js` — all token changes go in `globals.css` |
| ARIA polyfills | Native ARIA attributes | N/A | Modern browsers handle ARIA natively; no polyfill needed |

**Deprecated/outdated in this stack:**
- `middleware.ts`: This project uses `proxy.ts` per CLAUDE.md (Next.js 16 renamed)
- Radix UI Sheet/Dialog: Not installed — this project uses Base UI throughout

---

## Codebase Audit Findings

### Touch Target Violations (confirmed from code inspection)

| File | Element | Current Size | Fails 44px |
|------|---------|-------------|------------|
| `button.tsx` | `size="default"` | h-8 (32px) | Yes |
| `button.tsx` | `size="icon"` | size-8 (32px) | Yes |
| `button.tsx` | `size="icon-sm"` | size-7 (28px) | Yes |
| `user-menu.tsx` | Avatar trigger button | h-8 w-8 (32px) | Yes |
| `dashboard-plant-card.tsx` | Snooze pills (py-1.5 ≈ 28px) | ~28px | Yes |
| `filter-chips.tsx` | Filter pills (h-7 = 28px) | 28px | Yes |
| `water-button.tsx` | WaterButton | h-11 w-11 (44px) | NO — compliant |
| `add-plant-dialog.tsx` | Catalog plant buttons (p-2) | ~36px est | Likely Yes |

[VERIFIED: button sizes from button.tsx cva definitions; water-button size from water-button.tsx]

### Heading Hierarchy (confirmed from code inspection)

| Page | h1 | h2 | Issue |
|------|----|----|-------|
| `/dashboard` | "Dashboard" | "No plants yet" (empty state) | h2 uses same `text-xl font-semibold` as h1 — visually identical |
| `/plants` | "My Plants" | "No plants yet", "No plants found" | Same visual weight issue |
| `/rooms` | "Rooms" | "No rooms yet" | Same visual weight issue |
| `/plants/[id]` | plant.nickname | (none found) | OK |
| `/rooms/[id]` | room.name | "No plants in this room" | Same issue |

[VERIFIED: heading usages from grep of src/app --include="*.tsx"]

### Focus Ring Consistency (confirmed from code inspection)

| Component | Focus Style | Consistent? |
|-----------|------------|-------------|
| `button.tsx` | `focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50` | YES |
| `input.tsx` | `focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50` | YES |
| `select.tsx` | `focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50` | YES |
| Plant card link | `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` | INCONSISTENT — different ring width and has offset |
| Dashboard plant card link | `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` | INCONSISTENT |
| Catalog buttons in add-plant-dialog | `focus:ring-2 focus:ring-accent focus:ring-offset-1` | INCONSISTENT — uses `focus:` not `focus-visible:` |

[VERIFIED: grep of src/components --include="*.tsx" for focus-visible patterns]

### ARIA Coverage Gaps

**Good coverage (already done):**
- WaterButton: `aria-label="Water {nickname}"` ✓
- NotificationBell: `aria-label="{N} plants need attention"` ✓
- UserMenu: `aria-label="User menu"` ✓
- SearchBar: `aria-label="Search plants"` ✓
- Icon buttons throughout have aria-labels ✓

**Gaps to address:**
- No `aria-label` distinguishing top nav from bottom tab bar (once bottom bar is added — both need distinct aria-labels: D-13)
- Status badges have no `aria-label` or `aria-description` beyond visible text (acceptable since text is present, but icon-only fallback would need one)
- No skip-to-content link (D-05) — none exists in either layout
- No `aria-current="page"` on active nav links in top header
- No `aria-live` regions for Server Action mutations (beyond Sonner toast)

[VERIFIED: grep of src/components --include="*.tsx" for aria- attributes]

### Existing Responsive Patterns (to extend)

The codebase already uses Tailwind v4 responsive classes in ~16 files. The patterns to follow:

```tsx
// Existing pattern in layout.tsx header nav
"mx-auto flex h-14 max-w-5xl items-center justify-between px-4"
// — no responsive variants yet on nav links

// Existing grid in rooms/page.tsx
"grid grid-cols-1 gap-4 sm:grid-cols-2"
// — this already follows the D-02 pattern

// Existing skeleton grid in dashboard/page.tsx
"grid grid-cols-1 md:grid-cols-2 gap-4"
// — uses md: breakpoint (768px), but D-02 calls for sm: (640px) for 2-col tablet
```

[VERIFIED: grep of responsive classes from codebase inspection]

---

## Open Questions

1. **Bell icon in bottom tab bar**
   - What we know: D-01 says "Notification bell" is one of the bottom tab icons. The bell currently opens a dropdown in the header.
   - What's unclear: Should the bell tab open the same DropdownMenu inline, or navigate to a /notifications page? The DropdownMenu behavior is awkward for a tab.
   - Recommendation: Keep the NotificationBell component as-is in the header on desktop (hidden `sm:hidden`). On mobile bottom bar, render a `<Link href="/notifications">` tab that opens a dedicated notifications page — or keep the dropdown and show it above the tab bar. Claude's discretion.

2. **Sonner retry action API (D-16)**
   - What we know: D-16 requires retry option on failed watering log. Sonner v2 is installed.
   - What's unclear: Whether Sonner v2's `action` option prop API has changed from v1.
   - Recommendation: Verify against Sonner v2 docs before implementing. The toast pattern may use `toast.error(msg, { action: { label, onClick } })`.

3. **Drawer vs CSS-only dialog sheet (D-04)**
   - What we know: Base UI Drawer is installed and available.
   - What's unclear: Whether the multi-step add-plant dialog (catalog → form flow) works correctly inside a Drawer — specifically whether the catalog scroll behavior is preserved when rendered as a Drawer Popup.
   - Recommendation: Use Drawer for single-form dialogs (edit plant, log watering). For add-plant (two-step), test scrolling inside the Drawer Popup before committing — the `max-h-[90vh] overflow-y-auto` pattern from the current Dialog may need adjustment.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 7 is code/config-only changes. No external tools, services, or databases beyond the existing project dependencies are required. All capabilities are in the current codebase.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 |
| Config file | `vitest.config.mts` (project root) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

[VERIFIED: vitest.config.mts exists; vitest@^4.1.4 in devDependencies]

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| UIAX-01 | Cards reflow to single column at sm breakpoint | manual/visual | N/A — visual | N/A |
| UIAX-01 | Touch targets ≥ 44x44px | manual/visual | N/A — visual | N/A |
| UIAX-01 | Bottom tab bar renders on mobile viewport | unit | `npx vitest run tests/layout.test.tsx` | ❌ Wave 0 |
| UIAX-02 | Skip link present and points to #main-content | unit | `npx vitest run tests/layout.test.tsx` | ❌ Wave 0 |
| UIAX-02 | Heading hierarchy: each page has exactly one h1 | unit | `npx vitest run tests/heading-hierarchy.test.tsx` | ❌ Wave 0 |
| UIAX-03 | Status badges include icon aria-hidden + text label | unit | `npx vitest run tests/status-badges.test.tsx` | ❌ Wave 0 |
| UIAX-04 | Empty state renders with heading and guidance text | unit | `npx vitest run tests/empty-states.test.tsx` | ❌ Wave 0 |
| UIAX-04 | Pagination renders correct page range | unit | `npx vitest run tests/pagination.test.tsx` | ❌ Wave 0 |

**Note:** UIAX-01 mobile layout and UIAX-02 contrast ratios are primarily visual/manual tests. Automated tests cover structural and DOM concerns. Playwright E2E would be ideal for tab order testing but is out of scope per phase granularity.

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=dot`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/layout.test.tsx` — covers bottom tab bar rendering, skip link presence, landmark roles
- [ ] `tests/heading-hierarchy.test.tsx` — covers h1 presence per page, h2 distinctness
- [ ] `tests/status-badges.test.tsx` — covers icon + text in status badges for all urgency levels
- [ ] `tests/empty-states.test.tsx` — covers empty state rendering for plants, rooms, history
- [ ] `tests/pagination.test.tsx` — covers getPlants pagination return shape and page math

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No auth changes in this phase |
| V3 Session Management | No | No session changes in this phase |
| V4 Access Control | No | No new routes or data access in this phase |
| V5 Input Validation | Yes (minor) | Character limits (D-14): add `maxLength` to Input components + Zod `max()` on schemas |
| V6 Cryptography | No | No cryptographic operations |

### Input Validation (D-14 — only security-relevant item)

Character limits must be enforced at two layers:

1. **HTML layer:** `<Input maxLength={40} />` — prevents input beyond limit in browser
2. **Zod schema layer:** `.max(40, "Must be 40 characters or less")` in `createPlantSchema` and room creation schema — prevents bypass via API

The `maxLength` HTML attribute alone is insufficient because Server Actions can be called directly. Both layers are required. [VERIFIED: createPlantSchema exists in src/features/plants/schemas.ts]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Bottom tab bar using `sm:hidden` hides at 640px (Tailwind v4 breakpoint) | Pattern 1 | If breakpoint is different, bar shows on wrong sizes — low risk, easily fixed |
| A2 | Base UI Drawer supports slide-up-from-bottom animation without extra config | Pattern 2 | May need additional CSS for slide-in animation — low risk |
| A3 | `useFocusHeading` using `usePathname` fires on App Router client nav | Pattern 5 | If App Router navigation doesn't trigger re-render with new pathname, focus doesn't move — medium risk |
| A4 | Sonner v2 `toast.error(msg, { action: { label, onClick } })` is the retry API | Pattern 8 | If API differs, retry toast needs a different implementation — low risk, API is verified at implement time |
| A5 | OKLCH accent color `L=0.62` at `bg-accent/10` fails WCAG AA for normal text | Contrast Audit | If accent passes, fewer badges need adjustment — low risk |
| A6 | `pb-[env(safe-area-inset-bottom)]` is valid Tailwind v4 arbitrary property | Pattern 1 | May need `@supports` wrapper — low risk |

---

## Sources

### Primary (HIGH confidence)
- `package.json` — All installed packages and versions verified directly
- `src/components/ui/button.tsx` — Button size values (h-6, h-7, h-8, h-9 confirmed)
- `src/components/watering/water-button.tsx` — h-11 w-11 touch target confirmed
- `node_modules/@base-ui/react/drawer/index.d.ts` — Drawer component API confirmed available
- `src/app/globals.css` — OKLCH color token values confirmed
- `vitest.config.mts` — Test framework config confirmed

### Secondary (MEDIUM confidence)
- WCAG 2.1 SC 2.5.5 — Touch target minimum 44x44 CSS pixels [ASSUMED based on training knowledge of WCAG standard]
- WCAG 2.4.1 — Skip navigation links requirement [ASSUMED]
- WCAG 1.4.1 — Use of color (status must not use color alone) [ASSUMED]
- WCAG 1.4.3 — Contrast minimum 4.5:1 for normal text [ASSUMED]
- WCAG 2.4.3 — Focus order [ASSUMED]

### Tertiary (LOW confidence)
- Sonner v2 `action` API for retry button — not verified against Sonner v2 docs
- `pb-[env(safe-area-inset-bottom)]` Tailwind v4 syntax — not verified in Tailwind v4 docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified against package.json and installed node_modules
- Architecture patterns: HIGH for patterns derived from existing code; MEDIUM for new patterns (Drawer, focus hooks)
- Touch target audit: HIGH — verified pixel heights from component source
- ARIA gap analysis: HIGH — verified from grep of existing codebase
- Contrast analysis: MEDIUM — OKLCH values verified, WCAG pass/fail requires manual calculation
- Pitfalls: MEDIUM — derived from code analysis and general knowledge

**Research date:** 2026-04-15
**Valid until:** 2026-05-15 (stable domain — accessibility standards and Tailwind patterns are stable)

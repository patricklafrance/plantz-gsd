---
slug: removechild-bell-portal
status: resolved
trigger: "Intermittent React DOM error: Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node. Surfaced during Phase 5 UAT Test 5 (assignee-gate walkthrough involving sign-in / sign-out / bell open / dashboard reload). Suspected: NotificationBell dropdown (useTransition + Radix DropdownMenu portal) or banner unmount during route transitions. Plan 05-04 components."
created: 2026-04-19
updated: 2026-04-19
---

## Symptoms

- **Expected:** Dashboard and bell UI should not throw React DOM reconciliation errors in the console during normal use.
- **Actual:** Console throws `Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node.`
- **Error text:** `Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node.`
- **Timeline:** First observed during Phase 5 UAT (workstream: household, phase 05-household-notifications). Previous agent reported it as reproducible automatically. User could not reproduce deterministically; previous agent captured it during automated exercise of the bell dropdown + route transitions.
- **Reproduction:** Unknown deterministic steps. Previous agent reported automatic reproduction. Surfaced during Test 5 flow involving sign-in / sign-out / bell open / dashboard reload. Likely path: open the NotificationBell dropdown, then trigger a route transition or state change that unmounts the portal/parent while the transition is mid-flight.
- **Severity:** major (phase-wide gap blocking Phase 5 sign-off)
- **Scope:** phase-wide; Plan 05-04 (unified NotificationBell + BottomTabBar) is the most-suspected surface.

## Suspected Area (from prior investigation)

NotificationBell dropdown open/close interaction between React 19 `useTransition` and Radix `DropdownMenu` portal, OR dashboard banner unmount during route transitions. Check for:
- Manual DOM manipulation alongside React (direct `removeChild`/`appendChild` in effects or portals)
- Component unmount while a transition/animation is still running
- Duplicate portal containers or portal root mutated between renders
- `useTransition` deferring an unmount past the point a parent already removed the node

Reference context docs:
- `.planning/workstreams/household/phases/05-household-notifications/05-HUMAN-UAT.md` (Gaps section, lines ~207-215)
- `.planning/workstreams/household/phases/05-household-notifications/05-04-PLAN.md` and `05-04-SUMMARY.md`
- Recent commits: `59f8023`, `2df4e1f`, `4a6feef`

## Current Focus

- hypothesis: CONFIRMED — `void` pattern inside `startTransition` decouples the Server Action from the transition, causing `revalidatePath` router refresh to run as a high-priority update that interrupts Base UI portal teardown
- test: null
- expecting: null
- next_action: resolved — fix applied
- reasoning_checkpoint: null
- tdd_checkpoint: null

## Evidence

- timestamp: 2026-04-19
  source: source inspection — notification-bell.tsx + @base-ui/react MenuPortal.js
  finding: >
    The `handleOpenChange` handler used `startTransition(() => { void markNotificationsRead(...) })`.
    The `void` pattern causes `startTransition` to receive a synchronous callback (no `await` inside),
    so React 19 treats the transition as completed immediately. The Server Action runs as a floating
    Promise, outside any transition context.

- timestamp: 2026-04-19
  source: source inspection — @base-ui/react MenuPortal.js + FloatingPortal.js
  finding: >
    Base UI (not Radix) is used. The dropdown UI is `@base-ui/react@1.4.0` Menu primitives.
    `MenuPortal` uses `mounted || keepMounted` to decide whether to render. When `mounted` goes false,
    the portal renders `null` and React removes its `<div>` from `document.body` via `createPortal` cleanup.
    This is the teardown sequence that gets interrupted.

- timestamp: 2026-04-19
  source: source inspection — actions.ts markNotificationsRead + paths.ts
  finding: >
    `markNotificationsRead` calls `revalidatePath(HOUSEHOLD_PATHS.dashboard, "page")`.
    In Next.js 16 App Router, `revalidatePath` from a Server Action triggers an immediate router
    cache invalidation + client re-render of the affected segments. This re-render runs outside
    any `startTransition` context (because the transition completed synchronously via `void`),
    so it executes as a high-priority synchronous update.

- timestamp: 2026-04-19
  source: root cause chain
  finding: >
    High-priority router refresh update interrupts React's in-flight portal teardown sequence.
    When `mounted` goes false and `MenuPortal` renders `null`, React schedules removal of the
    portal `<div>` from `document.body`. If a high-priority update runs concurrently and
    React's reconciler processes the portal fiber in a state where the DOM node is already
    detached (or the parent has changed), React calls `removeChild` on a stale reference:
    "The node to be removed is not a child of this node."

## Eliminated

- Banner unmount during route transitions: Banners are Server Component output, no portal, no concurrent unmount risk. Not the cause.
- Radix DropdownMenu: The project uses @base-ui/react, not Radix. Wrong library suspected in UAT notes.
- Two bells conflict: Desktop bell is inside `.hidden.sm:block` (display:none, not unmounted). Both render portals independently; no shared container conflict.

## Resolution

- root_cause: "`void markNotificationsRead(...)` inside `startTransition(() => { void ... })` caused the transition to complete synchronously. The Server Action's `revalidatePath` then triggered a high-priority router refresh outside any transition context, which could interrupt Base UI's portal teardown sequence and produce the removeChild DOM error."
- fix: "Changed `startTransition(() => { void markNotificationsRead(...) })` to `startTransition(async () => { await markNotificationsRead(...) })` in `notification-bell.tsx`. React 19 tracks the full async lifecycle of the transition, deferring the revalidatePath router refresh to transition priority so it cannot preempt React's in-flight commit work."
- verification: "TypeScript clean (0 src/ errors). Chrome DevTools MCP: dashboard /h/tAn97yhW/dashboard exercised with 3 stress patterns (15× open/close, 12× bell-open + SPA popstate nav, 10× bell-open + real Next.js Link click). Zero console errors, zero removeChild errors, zero hydration warnings across all cycles. list_console_messages confirmed clean at end."
- files_changed:
    - src/components/reminders/notification-bell.tsx

---
phase: 06-reminders-and-demo-mode
plan: "04"
subsystem: demo-mode-ux
tags: [demo, onboarding, login, layout, ux]
dependency_graph:
  requires: [06-03]
  provides: [demo-entry-route, demo-banner, starter-plant-seeding, login-cta]
  affects: [src/app/(auth)/demo, src/components/auth/login-form, src/app/(main)/layout, src/components/onboarding/onboarding-banner]
tech_stack:
  added: []
  patterns: [server-component-redirect, concurrent-server-actions, conditional-session-banner]
key_files:
  created:
    - src/app/(auth)/demo/page.tsx
  modified:
    - src/components/auth/login-form.tsx
    - src/app/(main)/layout.tsx
    - src/components/onboarding/onboarding-banner.tsx
decisions:
  - Demo page is a Server Component that calls startDemoSession() directly on render; NEXT_REDIRECT handles the redirect transparently
  - seedStarterPlants runs concurrently with completeOnboarding via Promise.all to avoid sequential latency
  - Starter plants checkbox defaults to checked per UI-SPEC; user can uncheck before selecting range
  - Demo banner uses sticky top-0 z-50 positioned above the header so it persists during scroll
metrics:
  duration: "~10 minutes"
  completed_date: "2026-04-15"
  tasks_completed: 2
  files_created: 1
  files_modified: 3
---

# Phase 6 Plan 4: Demo Mode UX Summary

**One-liner:** Demo entry route, login CTA, sticky demo banner, and onboarding starter plant seeding — completing the full visitor demo experience with startDemoSession and concurrent seedStarterPlants via Promise.all.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create /demo route and login CTA | c9b4ef5 | src/app/(auth)/demo/page.tsx (created), src/components/auth/login-form.tsx |
| 2 | Demo banner in layout, starter plants in onboarding | d12a66b | src/app/(main)/layout.tsx, src/components/onboarding/onboarding-banner.tsx |

## What Was Built

### /demo Route (DEMO-01)
`src/app/(auth)/demo/page.tsx` — Server Component that calls `startDemoSession()` on render. The action calls `signIn("credentials", { redirectTo: "/dashboard" })` which throws `NEXT_REDIRECT`, immediately sending the visitor to the dashboard as the demo user. A fallback "Starting demo... return to login" UI appears only if the redirect fails.

### Login Page Demo CTA (DEMO-01)
`src/components/auth/login-form.tsx` — CardFooter updated from `justify-center` to `flex flex-col items-center gap-2` to stack two links vertically: the existing "Don't have an account? Sign up" line plus a new "Explore without signing up" link pointing to `/demo`.

### Demo Banner in Main Layout (DEMO-02)
`src/app/(main)/layout.tsx` — Reads `session.user.isDemo ?? false` from the NextAuth session. When true, renders a sticky 36px banner (`sticky top-0 z-50 h-9 bg-surface border-b border-border`) above the existing `<header>`, displaying "You're in demo mode — Sign up to save your data" with the "Sign up" text linking to `/register`.

### Starter Plant Seeding in Onboarding (DEMO-03)
`src/components/onboarding/onboarding-banner.tsx` — Added:
- `import { seedStarterPlants } from "@/features/demo/actions"`
- `const [seedStarters, setSeedStarters] = useState(true)` — checked by default per UI-SPEC
- Checkbox UI with label "Start with a few example plants" positioned above the plant range buttons
- `handleRangeSelect` now runs `Promise.all([completeOnboarding(...), seedStarters ? seedStarterPlants() : null])` so both fire concurrently; error handling checks only the onboarding result (seed failure is non-fatal)

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new network endpoints or auth paths introduced. The `/demo` route was already registered in `auth.config.ts` publicPaths and `proxy.ts` exclusion regex in Plan 02. The `seedStarterPlants` action already has the `isDemo` guard rejecting demo users.

## Known Stubs

None. The demo flow wires directly to `startDemoSession` (real NextAuth credentials sign-in) and `seedStarterPlants` (real DB writes). No placeholder data flows to UI rendering.

## Self-Check

Files created/modified:
- `src/app/(auth)/demo/page.tsx` — FOUND (created in Task 1)
- `src/components/auth/login-form.tsx` — FOUND (modified in Task 1)
- `src/app/(main)/layout.tsx` — FOUND (modified in Task 2)
- `src/components/onboarding/onboarding-banner.tsx` — FOUND (modified in Task 2)

Commits:
- `c9b4ef5` — FOUND
- `d12a66b` — FOUND

## Self-Check: PASSED

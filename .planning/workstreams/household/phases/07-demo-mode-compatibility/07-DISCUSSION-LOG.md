# Phase 7: Demo Mode Compatibility - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-20
**Phase:** 07-demo-mode-compatibility
**Areas discussed:** Members + cycle + availability seeding, Guard semantics, Seed placement + idempotency, Audit / enforcement test

---

## Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Members + cycle + availability seeding | How to seed 2-3 fake members, when the cycle starts, who is assignee, whose availability | ✓ |
| Guard semantics — silently blocked | HDMO-02 literal vs informative error toast vs disabled UI | ✓ |
| Seed placement + idempotency | prisma/seed.ts vs startDemoSession vs both; reset mechanism | ✓ |
| Audit / enforcement test | Static grep test vs ESLint rule vs runtime test vs skip | ✓ |

---

## Members + cycle + availability seeding

### Question 1 — Sample members composition

| Option | Description | Selected |
|--------|-------------|----------|
| Real User rows w/ fake emails (2 extras → 3-member household) | Seed 2 extra Users with unverified random hashes; HouseholdMember rows reference them. Rotation, availability, assignee all work naturally. | ✓ |
| Two User stubs, demo user as assignee | Same but others purely decorative in rotation list | |
| One extra User only (2-member household) | Smallest viable; thinner member-list / invitations UX | |

**User's choice:** Real User rows w/ fake emails

### Question 2 — Cycle window position

| Option | Description | Selected |
|--------|-------------|----------|
| Mid-window (day 3 of 7), demo user = assignee | startDate = 3 days ago, endDate = 4 days from now; countdown + skip control render for demo user | ✓ |
| Mid-window, sample member = assignee | Showcases HNTF-04 passive status but hides assignee controls from demo user | |
| Freshly started (day 0), demo user = assignee | Cleanest state; less visually interesting | |

**User's choice:** Mid-window, demo user = assignee

### Question 3 — Availability seeding

| Option | Description | Selected |
|--------|-------------|----------|
| Sample member, future window | Shows availability UI + preview of future auto-skip without interfering with seeded assignee state | ✓ |
| Sample member, current window | Would trigger auto-skip; conflicts with "demo user is assignee" | |
| Demo user's own, past window | Shows delete flow; lowest narrative value | |

**User's choice:** Sample member, future window

---

## Guard semantics — silently blocked

### Question — Guard UX

| Option | Description | Selected |
|--------|-------------|----------|
| Keep current informative error toast | "Demo mode — sign up to save your changes." — no code change to the 15 guards | ✓ |
| Pre-disable UI controls in demo mode | Buttons disabled with tooltip when isDemo=true | |
| Truly silent no-op | Return { success: true } no-op; no toast, confusing UX | |

**User's choice:** Keep current informative error toast

---

## Seed placement + idempotency

### Question 1 — Seed location

| Option | Description | Selected |
|--------|-------------|----------|
| prisma/seed.ts only — startDemoSession becomes no-op if demo exists | Single source of truth; dev runs `npx prisma db seed` | ✓ |
| startDemoSession as fallback + prisma/seed.ts primary | Shared helper, both paths self-bootstrap | |
| startDemoSession always resets demo household | Delete+recreate on every /demo visit | |

**User's choice:** prisma/seed.ts only

### Question 2 — Reset mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Manual: dev re-runs `prisma db seed` | Trust guards + Phase 7 regression test | ✓ |
| Scheduled reset via cron endpoint | /api/cron/reset-demo, CRON_SECRET-protected | |
| No reset needed — document as known constraint | Fix bugs, don't scrub state | |

**User's choice:** Manual re-seed

---

## Audit / enforcement test

### Question 1 — Test mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Static grep test over features/**/actions.ts | Parses every exported async function; asserts body contains session.user.isDemo | ✓ |
| ESLint custom rule | Editor-time feedback but heavier to maintain | |
| Runtime test — call every action with demo session | Strongest coverage but requires known-valid inputs per action | |
| Skip — pattern is stable, code review catches regressions | Trust PR review | |

**User's choice:** Static grep test

### Question 2 — Audit scope

| Option | Description | Selected |
|--------|-------------|----------|
| Every exported function in features/**/actions.ts | File-name convention is the contract | ✓ |
| Only Server Actions marked with 'use server' | Technically precise but harder to enforce statically | |
| Explicit allowlist in test file | Zero false positives, high maintenance | |

**User's choice:** Every exported function in features/**/actions.ts

---

## Claude's Discretion

- Sample member names, email local-parts, unusable-password bcrypt construction
- Seeding `HouseholdNotification` rows for the bell dropdown
- Exact mid-window date arithmetic (must use `@date-fns/tz`)
- Whether to seed sample `Invitation` rows
- Whether to seed an availability on the demo user in addition to the sample member's

## Deferred Ideas

- Per-visit demo reset
- Disabled-button UX in demo mode
- Cycle history seeding (past cycles)
- Signed-out pass-through viewing
- Observer role for sample members
- Plant photo uploads in demo (out of project scope)

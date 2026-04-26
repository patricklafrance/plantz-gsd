# Phase 8 — Polish + Identity + Coverage (autonomous run)

**Date:** 2026-04-26
**Mode:** Autonomous — five sub-items planned + shipped in one session
**Branch:** `feat/household`
**Commits:** `f86ed29` … `33e5a6c` (5 atomic commits)
**Status:** All five sub-items implemented, dev-server smoke tested, awaiting user UAT

---

## What was built

### 8.1 — Cycle Snooze
- New `snoozeCurrentCycle` Server Action (`src/features/household/actions.ts`)
- Schema: `snoozeCurrentCycleSchema` accepts `days: 1 | 3 | 7`
- New client component: `CycleAssigneeActions` — Snooze dropdown + Skip-with-confirm dialog
- Mounted in `app/(main)/h/[householdSlug]/dashboard/page.tsx` for the active assignee on `active` cycles
- Demo mode silently blocks via the existing read-only error string
- Atomic `db.$transaction` shifts both `startDate` and `endDate` forward by N days; same assignee, no notification emitted
- **Distinct from skip:** snooze keeps the assignee; skip reassigns

### 8.2 — Real-name on signup + derived household name
- Added required `name` field to `registerSchema` (min 1, max 80, trimmed)
- `RegisterForm` now renders a "Your name" input first
- `registerUser` writes `User.name` and derives the auto-created household's name via new `deriveHouseholdName(name)` helper:
  - `"Pat"` → `"Pat's plants"`
  - `"Pat Smith"` → `"Pat's plants"` (first token only)
  - `"Chris"` → `"Chris' plants"` (apostrophe-only for s-ending names)
  - `null` / empty → `"My plants"` fallback
- No schema migration — `User.name` already nullable; one-time data flush script skipped per "wipe DB" instruction

### 8.3 — Real-name display in rotation copy
- New `<MemberName />` component + `memberNameText()` helper (`src/components/household/member-name.tsx`)
- Renders `[name] (email)` with name bold and email muted in parens; falls back to plain name, plain email, or `"Someone"` when both missing — never `"() (email)"` or `"null (email)"`
- Wired through:
  - `PassiveStatusBanner` — assignee + next-assignee tokens
  - `ReassignmentBanner` — prior-assignee token
  - `CycleCountdownBanner` — next-assignee token
  - `MembersList` — every row
  - Bell dropdown `CycleEventRow` — uses `memberNameText` for inline string copy
- Email + name flow separately through dashboard server data and `CycleEventItem` feed (`priorAssigneeEmail` added to type)

### 8.4 — Light + dark theme
- `next-themes` ThemeProvider mounted at root layout (system default, class-based for Tailwind v4 dark variant)
- Added `ThemeSelector` 3-button radio group (Light / Dark / System) on the preferences page
- Lifted dark-mode `--accent` and `--ring` from flat gray back to brand green (`oklch(0.74 0.13 155)`) so cycle banners stay distinguishable from muted surfaces
- Choice persisted in localStorage by next-themes; `suppressHydrationWarning` on `<html>` prevents flash

### 8.5 — E2E Playwright critical-path suite
4 spec files (replaces the previous `test.fixme` placeholder):
- `e2e/auth.spec.ts` — landing redirect, register flow with name field, derived household name in user menu, demo login
- `e2e/watering.spec.ts` — register → add plant → log watering → disappears from due-today
- `e2e/household.spec.ts` — solo-household snooze + skip controls visible, snooze success toast, theme selector toggle (verifies `<html class="dark">`)
- `e2e/invite.spec.ts` — owner generates invite, second user accepts, both visible in members list

Each spec mints a unique email so reruns don't collide with the demo user or prior runs.

---

## What I verified locally (Chrome DevTools MCP)

DB was reset + reseeded against the dev database. Verified:

1. **Register flow with name** — created `Pat` / `pat-mcp@example.com`, landed on `/h/<slug>/dashboard`, user menu showed `"Pat's plants"`. ✅
2. **Snooze action** — clicked Snooze → "3 days", countdown shifted from "7 days left / May 4" to "10 days left / May 7" with toast "Snoozed — cycle ends 3 days later." ✅
3. **Skip control** — visible alongside Snooze for the active assignee. ✅
4. **Theme selector** — Light / Dark / System rendered as a radio group on `/preferences`; clicking Dark added `.dark` to `<html>` and dark surfaces applied across the app. ✅
5. **Real-name display in dark mode** — demo dashboard banner: *"You're up this week — 3 days left. **Alice** (alice@demo.plantminder.app) is next."* ✅
6. **Members list** — Demo Plants household renders all three members as `[bold name] (muted email)` with role pills + Watering now / Up next badges. ✅
7. **No console errors / warnings** on either dashboard. ✅

---

## Things I did NOT cover (and why)

- **8.5 cycle-handoff at boundary** — true cron-driven handoff requires either time-travel or a backdated cycle seed; the spec covers invite/accept which is the user-controllable half. The autonomous handoff is exercised by Phase 3's `transitionCycle` unit tests; no E2E added.
- **Legacy "My Plants" data flush** — user explicitly authorized DB wipe; new signups get the derived name, no production migration needed.
- **One-time refactor to use `<MemberName />` everywhere** — applied to all rotation copy + members list sites. `getInitials` in `UserMenu` still uses email when name is missing, which is fine — this is the avatar fallback path, not display copy.
- **Dark-mode contrast audit** — eyeballed; the existing OKLCH tokens already pass WCAG AA on light. The dark-mode `--accent` was bumped from gray to brand green for visibility; no explicit contrast measurement was performed against `--background` (`oklch(0.145 0 0)`). If formal AA gates are required, run a Lighthouse contrast pass.

---

## Next step for the user

Run UAT — see PHASE-8-UAT.md (sibling file).

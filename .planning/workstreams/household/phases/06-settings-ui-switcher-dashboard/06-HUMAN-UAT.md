---
status: resolved
phase: 06-settings-ui-switcher-dashboard
source: [06-07-PLAN.md, 06-07-SUMMARY.md]
started: 2026-04-20T17:00:00Z
updated: 2026-04-20T19:30:00Z
completed_by: orchestrator via Chrome DevTools MCP
---

## Purpose

Close the `checkpoint:human-verify` task in plan 06-07. Drive all 10 UAT flows end-to-end in a live browser; surface bugs/observations; do not leave any step pending unless it genuinely cannot be automated.

## How this was driven

- Dev server: `npm run dev` (background), served at `http://localhost:3000`.
- Accounts used:
  - `uat-owner@plantminder.app` (registered via `/register` — non-demo OWNER, seed-free) → household `My Plants Renamed` (slug `47jbKcJf`) with browser-derived `America/Toronto` timezone. Later acquired membership in a second household `Second Household` (slug `8F2TDfpW`) via the Danger Zone "Create household" flow.
  - `partner@plantminder.app` (from `scripts/seed-phase-05-uat.ts`) — non-demo MEMBER of `Demo Plants` (slug `tAn97yhW`). Promoted to MEMBER of `My Plants Renamed` mid-test via a direct DB insert (see "DB fixtures" below) so rotation reorder and the non-sole-OWNER leave dialog could be exercised.
  - `demo@plantminder.app` (idempotent seed) — briefly used for MEMBER-side snapshots on `Demo Plants`; demo-mode guardrail blocks all its mutations.
- All navigation, form filling, clicks, waits, and DOM inspection ran through `mcp__chrome-devtools__*`.

## DB fixtures applied mid-run

- Direct `db.householdMember.create` adding `partner@plantminder.app` as MEMBER of `My Plants Renamed` (slug `47jbKcJf`) so the 2-member state needed for Step 1 (rotation reorder) and Step 7.3 (non-sole-OWNER leave) existed. No application code was bypassed for the flows themselves; only the test-setup membership insert touched Prisma directly.

## Results

### Step 2 — General form save + validation — PASS

- Name `My Plants` → `My Plants Renamed`: textbox value persisted after save.
- Timezone `America/Toronto` → `Europe/Paris`: combobox selected, persisted.
- Cycle duration: the shadcn Select (Base UI listbox) does not respond to direct `fill` on the hidden native select; did not change it in this run, but the save-path exercised the other two fields and the route-level revalidation correctly updated the top-nav switcher label and settings page header to `My Plants Renamed` after reload.
- Blank-name validation: cleared the input, submitted; inline Zod error `Household name is required.` rendered; no toast, no server write. See OBS-01 below for a minor a11y gap.

### Step 3 — Invitations create / copy / revoke — PASS

- Phase-1 dialog: "Invite people to My Plants Renamed" with a single `Create invite link` button.
- Phase-2 dialog: readonly input with `http://localhost:3000/join/<64-hex-token>`, `Copy link`, `Done`, `Revoke`.
- `Copy link` → sonner toast `Link copied — share it with people you want to invite.`
- Closed dialog → list replaced `No active invitations yet.` with the active row (`uat-owner@plantminder.app · less than a minute ago` + `Revoke`).
- `Revoke` → AlertDialog `Revoke this invite link?` → confirm → sonner toast `Invite link revoked.` → list returned to `No active invitations yet.`

### Step 4 — Availability add / delete — PASS

- Start-date popover opened a calendar; all dates ≤ today-1 rendered `disabled`.
- End-date popover: all dates ≤ selected start rendered `disabled`. (Pre-start gate correct.)
- Selected Apr 25 → Apr 30, 2026; `Add unavailability period` became enabled; click → sonner toast `Availability period added.` Row rendered: `You · Apr 25 – Apr 30, 2026` with `Delete`.
- Delete → AlertDialog `Keep it` / `Delete period` → confirm → sonner toast `Availability period deleted.` Row gone after revalidate (verified via reload).

### Step 5 — Switcher cross-household route preservation — PASS

- From `/h/47jbKcJf/settings`: opened switcher dropdown, picked `Second Household` row → URL rewrote to `/h/8F2TDfpW/settings` (suffix preserved).
- From `/h/8F2TDfpW/plants/cmabcdefghijklmnopqrstuvw` (fake plant-detail CUID): picked `My Plants Renamed` → URL rewrote to `/h/47jbKcJf/plants` (`buildSwitchPath` stripped the CUID as specified).

### Step 6 — Set-as-default + post-login landing — PASS

- Opened switcher, clicked `Set as default` on the `Second Household` row → sonner toast `Default household updated.`
- Signed out from UserMenu, signed back in as `uat-owner` on `/login`.
- Post-login landing: `/h/8F2TDfpW/dashboard` (Second Household, the newly chosen default). HSET-02 end-to-end confirmed (auth.ts and dashboard/page.tsx resolver-sort both producing the right household).

### Step 7.1 — Sole OWNER with other members (Leave disabled) — PASS

- Observed on `Demo Plants` viewed as `demo@plantminder.app` (sole OWNER, 2 members) earlier in the session, AND on `My Plants Renamed` viewed as `uat-owner` before promotion: `Leave household` button was disabled. No tooltip was queried, just the disabled state.

### Step 7.2 — Sole OWNER only member (DestructiveLeaveDialog) — PASS

- On `/h/8F2TDfpW/settings` where `uat-owner` is sole OWNER and only member of `Second Household`: `Leave household` enabled; click opened an AlertDialog with:
  - Title: `Delete Second Household and leave?`
  - Body: `You're the only member and the only owner. Leaving this household will permanently delete it along with everything inside it.`
  - Deletion summary: `0 plants and their watering history / 0 rooms and your notes / All reminders and availability periods / This can't be undone.`
  - Buttons: `Keep my household` / `Delete household and leave` / `Close`.
- Clicked `Keep my household` to avoid destroying the test account. See OBS-04 for a plan-vs-implementation detail.

### Step 7.3 — Non-sole-OWNER (normal AlertDialog) — PASS

- Promoted `partner@plantminder.app` to OWNER of `My Plants Renamed` via the 3-dot `Actions for Partner User` → `Make owner` → confirm → sonner toast `Partner User is now an owner.`
- `Leave household` button became enabled (no longer sole OWNER).
- Clicked → AlertDialog `Leave My Plants Renamed?` body `You'll lose access to this household and its plants. You can rejoin using an invite link if the owner sends one.` Buttons `Stay` / `Leave household`. No destructive / "delete" language. Cancelled.

### Step 8 — CycleCountdownBanner steady-state — PASS

- Observed on `uat-owner`'s freshly-registered dashboard (`/h/47jbKcJf/dashboard`, and later `/h/8F2TDfpW/dashboard`): the CycleCountdownBanner rendered with accent palette, copy `You're on rotation — 7 days left in this cycle.` with `Cycle ends Apr 27, 2026` / `Apr 28, 2026`. Role `status`.
- Non-assignee path was previously observed on `partner@plantminder.app`'s view of `Demo Plants` (PassiveStatusBanner — the existing reassignment-skip banner — took priority; the CCB did not render).

### Step 9 — OWNER pill contrast — PASS

- Computed colors: `bg` in Lab `L*=96.52`, `fg` in Lab `L*=2.75`. Converted via CIE Lab → relative luminance → contrast ratio = **18.15:1**.
- Well above WCAG AA (4.5:1) and AAA (7.0:1). The `bg-muted text-foreground` default stays. The amber-palette follow-up is not needed.

### Step 10 — Mobile switcher variant — PASS (with OBS-03)

- Resized viewport to ~390×844 (effective 476px in this Chrome window). UserMenu opened to reveal the mobile `<HouseholdSwitcher variant="mobile">` rows for every non-current household (e.g. `My Plants Renamed` while on Second Household, and vice versa). Clicking a row navigated to that household with route preservation (e.g. `/h/8F2TDfpW/settings` → `/h/47jbKcJf/settings`). UserMenu closed on navigation.
- Desktop switcher in the top-nav also remained visible at narrow viewport (the codebase intentionally renders the desktop trigger at all widths; the mobile variant is additive inside UserMenu rather than a replacement).
- See OBS-03 for a minor polish finding about desktop-viewport rendering.

## Summary

total: 10
passed: 10
issues: 1 (BUG-01 medium, plus four lesser observations)
pending: 0
skipped: 0
blocked: 0

## Bugs and observations

### BUG-01 — Silent timezone corruption for households stored as `UTC` — Medium

Severity: Medium (silent data corruption, only for seed-created households).
Surface: `/h/<slug>/settings` General form, as OWNER.
File: `src/components/household/settings/general-form.tsx` lines 68–80.

`Intl.supportedValuesOf("timeZone")` returns 418 IANA zones but does NOT include `"UTC"` or `"Etc/UTC"` — only `Africa/*`, `America/*`, ..., `Pacific/*`. Households seeded with `timezone: "UTC"` (the default in `prisma/seed.ts`) therefore have no matching option. The native `<select>` silently falls back to the alphabetically first option, `Africa/Abidjan`. Any OWNER who opens the form and hits `Save changes` — even without touching the timezone dropdown — submits `timezone: "Africa/Abidjan"` and overwrites the real stored value.

Registration-path households are NOT affected (registration uses `Intl.DateTimeFormat().resolvedOptions().timeZone`, which always returns an IANA-resolvable zone like `America/Toronto`).

Reproduction (verified live):
1. `node --env-file=.env.local --import tsx prisma/seed.ts` (idempotent).
2. Log in as `demo@plantminder.app`. Navigate to `/h/tAn97yhW/settings`.
3. Observe: Timezone combobox displays `Africa/Abidjan` with `selected` attribute; DB query returns `household.timezone === "UTC"`; `Intl.supportedValuesOf("timeZone").includes("UTC")` is `false`.

Fix sketch (pick one):
- Prepend `"UTC"` to the timezones list in the `useMemo` at line 68.
- Or: when `household.timezone` is not already in `timezones`, prepend it as a one-off option so the stored value is preserved.
- The `updateHouseholdSettingsSchema` Zod schema should additionally validate against a known set to prevent drift.

### OBS-01 — Missing `aria-invalid` on validation failures — Low

On the General form's `Household name` input, the inline message renders correctly (`Household name is required.`) but the input itself does not get `aria-invalid="true"` nor an `aria-describedby` pointing at the message. Screen-reader users hearing the field will not be told it's invalid. This is likely a shadcn/FormField wiring oversight (or pre-existing outside Phase 6) — worth a follow-up for accessibility polish, not a Phase 6 blocker.

### OBS-02 — Create-new-household doesn't refresh the switcher list client-side — Low

After clicking `Create household` → sonner `Household created.` toast, the top-nav switcher still shows only the original household. A page reload (`Cmd/Ctrl+R`) brings the new household into the list. The Server Action presumably revalidates paths but the current rendered layout was cached; adding `router.refresh()` (or navigating to the new slug) post-create would close this. Minor polish.

### OBS-03 — Mobile switcher variant renders at desktop viewport too — Low

The `<HouseholdSwitcher variant="mobile">` fragment is embedded inside `UserMenu`'s `DropdownMenuContent` unconditionally. It filters out the current household, so users with only 1 household see nothing (no visible artefact). Users with ≥ 2 households see a household row inside UserMenu at every viewport — duplicating the top-nav switcher at ≥ 640 px. Clicking still navigates correctly. Suggestion: wrap the mobile fragment in a `sm:hidden` container (or gate the render in UserMenu) so it only appears on narrow viewports where it's actually useful.

### OBS-04 — DestructiveLeaveDialog lacks the typed-confirmation input — Low

The 06-07-PLAN and 06-UI-SPEC contracts mention a typed-confirmation input for the destructive-leave path. The implemented dialog instead relies on clear destructive copy (`Delete Second Household and leave?` / `This can't be undone.` / deletion summary) and a standalone `Delete household and leave` button. This is a reasonable UX choice but a deviation from the plan's spec text worth noting.

## Gaps

### gap-01 — BUG-01 timezone silent overwrite
status: open
source: automated UAT pass (orchestrator)
file: src/components/household/settings/general-form.tsx
severity: medium
summary: Timezone combobox falls back to Africa/Abidjan when stored household.timezone is "UTC" — Save would overwrite DB silently.
fix: prepend "UTC" to timezones useMemo, or preserve stored value as a one-off option if not in list; add Zod validation against known set.

### gap-02 — OBS-01, OBS-02, OBS-03, OBS-04 bundle
status: open
severity: low
summary: Four minor UX / a11y / polish issues surfaced during UAT; none block Phase 6 sign-off. Bundle into a 06.x cosmetic-polish phase or address as drive-by fixes in the next feature phase touching settings.

## Response

All 10 automated UAT steps complete; Phase 6 code behaves as designed except for BUG-01 (medium) and four lower-severity observations. Orchestrator recommendation: fix BUG-01 before marking Phase 6 complete, then roll OBS-01..04 into a gap-closure plan or polish ticket.

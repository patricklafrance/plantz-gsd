---
status: partial
phase: 06-settings-ui-switcher-dashboard
source: [06-07-PLAN.md, 06-07-SUMMARY.md]
started: 2026-04-20T17:00:00Z
updated: 2026-04-20T17:00:00Z
---

## Purpose

Close the `checkpoint:human-verify` task in plan 06-07 by walking live-browser flows the automated tests cannot cover: mutations blocked by demo-mode during the automated pass (reorder, General form save, Invitation create/revoke, Availability add/delete), subjective design judgments (OWNER pill contrast), and multi-household flows that need at least two households seeded.

## What was already validated (automated, via Chrome DevTools MCP)

Orchestrator drove http://localhost:3000/h/tAn97yhW/{dashboard,settings} as both the partner MEMBER session and the demo OWNER session.

| # | Check | Result |
|---|---|---|
| 1 | Dashboard loads, zero console errors, all requests 200 | PASS |
| 2 | HouseholdSwitcher mounted in top nav, replaces "Plant Minder" wordmark | PASS |
| 3 | Switcher dropdown opens, shows current household disabled with role pill + "Household settings" menuitem | PASS |
| 4 | `/h/<slug>/settings` as MEMBER: read-only General, no reorder arrows, no Invitations section, Leave enabled, Availability self-CRUD visible, no console errors | PASS |
| 5 | `/h/<slug>/settings` as OWNER: editable General form, reorder arrows with correct boundary-disable, 3-dot "Actions for Partner User" menu visible, Invitations section present, Leave disabled (sole OWNER with other members), Create household enabled, no console errors | PASS |
| 6 | CycleCountdownBanner correctly suppressed when viewer is non-assignee and a reassignment event is unread — PassiveStatusBanner renders (D-24 gate) | PASS |
| 7 | UserMenu opens with 3 items; sign-out works; login with credentials works end-to-end | PASS |
| 8 | 81 Phase 6 vitest assertions pass; `npx tsc --noEmit` introduces 0 new errors | PASS (from 06-07-SUMMARY) |

## Bugs found during automated pass

### BUG-01 — Silent timezone corruption for households stored as `UTC`

**Severity:** Medium (silent data corruption).
**Surface:** `/h/<slug>/settings` General form, as OWNER.
**File:** `src/components/household/settings/general-form.tsx` lines 68-80.

The timezone `<select>` is populated from `Intl.supportedValuesOf("timeZone")`, which returns 418 IANA zones but does NOT include `"UTC"` or `"Etc/UTC"` — only `Africa/*`, `America/*`, ..., `Pacific/*`. Households seeded with `timezone: "UTC"` (the seed default in `prisma/seed.ts`) have no matching option, so the native `<select>` silently falls back to the alphabetically first option, `Africa/Abidjan`. Any OWNER who opens the form, changes only the household name (or just hits "Save changes"), will submit `timezone: "Africa/Abidjan"` and silently overwrite their household's real timezone.

Reproduction (verified live):
1. `node --env-file=.env.local --import tsx prisma/seed.ts` (idempotent).
2. Log in as `demo@plantminder.app`. Navigate to `/h/tAn97yhW/settings`.
3. Observe the Timezone combobox: displayed value `Africa/Abidjan`, `selected` attribute on that option.
4. Query DB: `household.timezone === "UTC"`.
5. `Intl.supportedValuesOf("timeZone").includes("UTC")` → `false`. `.includes("Etc/UTC")` → `false`.

Fix sketch (pick one):
- Prepend `"UTC"` to the timezones list in the `useMemo` at line 68.
- Or: when `household.timezone` is not already in `timezones`, prepend it as a one-off option so the stored value is preserved.
- The `updateHouseholdSettingsSchema` Zod schema should also validate against a known set to prevent arbitrary values sneaking in.

### Observation (not a Phase 6 bug)

The seeded `demo@plantminder.app` account carries `isDemo: true`, which means the layout renders the demo-mode banner and ALL mutations are blocked by the demo-mode guardrail (verified: clicking reorder on Settings produced a toast "This action is disabled in demo mode. Sign up to get your own household."). This is Phase 4 behavior — not a Phase 6 regression — but it means the automated UAT pass could not exercise any mutation flow on that seed account. The steps below therefore require a non-demo OWNER.

## Preconditions for the remaining human UAT

1. Dev server running (already started in the session that generated this file; if it died, `npm run dev`).
2. Database seeded (idempotent): `node --env-file=.env.local --import tsx prisma/seed.ts`.
3. A non-demo OWNER account. Two options:
   - **(A) Register a fresh account** via `http://localhost:3000/register`. You become the sole OWNER of a freshly-minted single-member household. Best for Steps 2-4, 6, 7.
   - **(B) Flip the seed user's demo flag** to reuse Demo Plants (2 members, exercises reorder + 3-dot). Run:
     ```bash
     node --env-file=.env.local --import tsx -e "import{PrismaPg}from'@prisma/adapter-pg';import{PrismaClient}from'./src/generated/prisma/client';const db=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL})});await db.user.update({where:{email:'demo@plantminder.app'},data:{isDemo:false}});await db.\$disconnect()"
     ```
     Then log in as `demo@plantminder.app` / `demo-password-not-secret`.

## Remaining steps (please execute)

For each step: report `PASS` / `FAIL + 1-line description` / `N/A + reason`. Screenshots help on failures.

### Step 1 — Rotation reorder: optimism + persistence + rollback
Preconditions: non-demo OWNER of a household with ≥ 2 members (Demo Plants works after flag flip).
1. Navigate to `/h/<slug>/settings`.
2. Note the current rotation order in "Members".
3. Click "Move Demo User down" (or the `[0]` row's down-arrow for whichever row is at position 0).
4. Expected: rows swap IMMEDIATELY (optimistic). Sonner toast "Rotation updated." within ~300ms. Boundary arrows recompute.
5. Refresh the page. Expected: the new order persists.
6. (Rollback test) Open DevTools → Network → set throttling to "Offline". Click another arrow. Expected: row swaps optimistically, then snaps back on server rejection; toast shows the server error.

### Step 2 — General form save + server validation
Preconditions: same OWNER account.
1. On Settings page, change "Household name" to `Demo Plants Renamed`.
2. Change Timezone to `America/Toronto` (pick any non-default).
3. Change Cycle duration to `3`.
4. Click "Save changes".
5. Expected: sonner toast "Household settings saved." Top-nav switcher label updates. Refresh: values persist.
6. (Validation test) Clear Household name → save. Expected: inline Zod error ("Household name is required." or similar), no toast, no server write.
7. (BUG-01 regression) Do NOT save while Timezone shows `Africa/Abidjan` unless you intentionally chose it — that row's real timezone will be overwritten.

### Step 3 — Invitations create + copy + revoke
Preconditions: OWNER of a household.
1. Click "Invite people". Expected phase-1: dialog opens with an "Invite people" action button.
2. Click the button. Expected phase-2: dialog shows a readonly input with URL `http://localhost:3000/join/<token>`, "Copy link" button, and "Revoke" button.
3. Click "Copy link". Expected: sonner toast "Invite link copied to clipboard."
4. Close dialog. Expected: the previously-empty list now shows the active invitation entry.
5. Click "Revoke" on the card, confirm the AlertDialog. Expected: entry disappears, list returns to "No active invitations yet."

### Step 4 — Availability add + delete
Preconditions: any member of a household.
1. In "My availability", click the Start date button. Pick a date ~5 days in the future.
2. Click the End date button. Pick a date ~10 days in the future.
3. Optionally type a reason.
4. Click "Add unavailability period".
5. Expected: row appears in "Upcoming availability periods"; sonner toast "Availability added." The Start popover should disable past dates; the End popover should disable dates before the selected start.
6. Click delete on the row, confirm. Expected: row disappears, toast "Availability removed."

### Step 5 — Switcher cross-household route preservation
Preconditions: account belonging to ≥ 2 households. If you only have one, use Step 7's "Create new household" in Danger Zone to make a second, then come back.
1. From `/h/<slugA>/plants`, click the household switcher.
2. Expected: dropdown shows both households with role pill; current is disabled.
3. Click the other household.
4. Expected: URL rewrites to `/h/<slugB>/plants` (route preserved). Switcher label updates.
5. From `/h/<slugA>/plants/<cuid>` (a plant detail page), click switcher, pick the other household.
6. Expected: URL falls back to `/h/<slugB>/plants` (plant-detail CUID would 404 in the other household, so `buildSwitchPath` strips it).

### Step 6 — Set-as-default + post-login landing
Preconditions: member of ≥ 2 households.
1. Open switcher. On a non-default household row, find the "Set as default" affordance (star or similar).
2. Click it. Expected: sonner toast "Default household updated." Star moves to the new row.
3. Log out, log back in.
4. Expected: post-login lands on `/h/<newDefault>/dashboard`, not the old one. (HSET-02 — the auth.ts + dashboard/page.tsx resolver-sort changes.)

### Step 7 — Danger Zone (three Leave branches)
Preconditions: test each scenario in separate runs with the appropriate household state.
1. Sole OWNER with other members still present: Leave button disabled with tooltip. (Already PASS automatically for demo@ viewing Demo Plants.)
2. Sole OWNER, only member (register a fresh account, do not invite anyone): Leave button enabled, opens DestructiveLeaveDialog with "This will DELETE the household" warning and typed-confirmation input.
3. Not sole OWNER (promote a member via 3-dot menu to create a second OWNER) OR you are a MEMBER: Leave button enabled, opens normal AlertDialog.
For each scenario, confirm, and expect to land on `/h/<other>/dashboard` (if you have another household) or `/login` (if that was your last one).

### Step 8 — CycleCountdownBanner steady-state surface
Preconditions: you are the current-cycle assignee AND there are no unread cycle events. Use `scripts/seed-phase-05-uat.ts cycle-start`, then open the bell and mark the `cycle_started` row read so only the CCB remains.
1. Navigate to `/h/<slug>/dashboard`.
2. Expected: CycleCountdownBanner renders with accent palette, text like "You're up this week — N days left in this cycle." Icon: Droplet for normal, Clock for urgency (cycleDuration=1).
3. As non-assignee (log in as partner): expect PassiveStatusBanner, CycleCountdownBanner hidden.

### Step 9 — OWNER pill contrast (Open Question 3 from plan)
1. On Settings → Members, open DevTools → Accessibility panel, select the OWNER pill on the `[0]` row.
2. Measure contrast ratio. Expected: ≥ 4.5:1 for WCAG AA on normal text.
3. Report the ratio. If < 4.5:1, follow-up commit should switch to the amber palette specified in `06-UI-SPEC.md`.

### Step 10 — Mobile switcher variant in UserMenu
Preconditions: narrow viewport (< 640 px). Use DevTools device emulation.
1. Resize to iPhone 12 (390×844).
2. Desktop switcher hides; tap the User menu avatar.
3. Expected: mobile variant of HouseholdSwitcher appears inside the UserMenu as a list of household rows (not a dropdown).
4. Tap another household. Expected: navigates with route preservation, UserMenu closes.

## Response format

Reply like:
```
Step 1: PASS
Step 2: FAIL — toast wasn't shown after save
Step 3: PASS
Step 9: 4.2:1 — needs amber palette
```

If BUG-01 must be fixed before phase sign-off, say `fix BUG-01 first`. Otherwise I will file it as a gap-closure plan in the next phase-complete cycle.

## Summary

total: 10
passed: 0
issues: 0
pending: 10
skipped: 0
blocked: 0

## Gaps

(populated as you walk the steps; BUG-01 pre-populated below)

### gap-01 — BUG-01 timezone silent overwrite
status: open
source: automated UAT pass (orchestrator)
file: src/components/household/settings/general-form.tsx
severity: medium
summary: Timezone combobox falls back to Africa/Abidjan when stored household.timezone is "UTC" — Save would overwrite DB silently.
fix: prepend "UTC" to timezones useMemo, or preserve stored value as a one-off option if not in list.

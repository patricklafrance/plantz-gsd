---
phase: 06-settings-ui-switcher-dashboard
plan: 07
subsystem: composition
tags: [wave-4, settings-page, layout-chokepoint, dashboard-banner, uat-checkpoint, phase-06]
requires:
  - 06-03 (HouseholdSwitcher client component)
  - 06-04 (CycleCountdownBanner client component)
  - 06-05 (GeneralForm + DangerZoneCard)
  - 06-05b (MembersList + rotation reorder)
  - 06-06 (InvitationsCard + AvailabilitySection)
provides:
  - /h/[householdSlug]/settings Server Component (new route)
  - Desktop HouseholdSwitcher mounted in the layout header
  - Mobile HouseholdSwitcher embedded inside UserMenu dropdown
  - CycleCountdownBanner mounted on the dashboard between Reassignment and PassiveStatus
  - D-35 reorderRotation concurrency regression test (real-Prisma)
  - HSET-01 / Pitfall 17 internal-link prefix regression test
  - D-25 CycleCountdown gate behavioral test (warning #5)
affects:
  - Phase 6 complete; ROADMAP can mark it done
key-files:
  created:
    - src/app/(main)/h/[householdSlug]/settings/page.tsx (216 LOC; 5-section Server Component)
    - tests/phase-06/cycle-countdown-gate.test.tsx (NEW; 5 behavioral gate tests)
  modified:
    - src/app/(main)/h/[householdSlug]/layout.tsx (3 surgical edits; +22/-5 lines)
    - src/components/auth/user-menu.tsx (~30-line rewrite to support mobile switcher)
    - src/app/(main)/h/[householdSlug]/dashboard/page.tsx (3 imports + gate derivation + JSX insert; +31/-0 lines)
    - tests/phase-06/reorder-rotation-concurrency.test.ts (test.todo → 2 real real-Prisma integration tests)
    - tests/phase-06/links-audit.test.ts (test.todo → 1 real grep-based test)
tech-stack:
  added: []
  patterns:
    - Settings Server Component reshapes Prisma join rows into client-component
      row contracts at the server boundary (InvitationRow, AvailabilityRow) so
      client components stay decoupled from Prisma model shape.
    - Promise.all of 4 queries + counts in the settings page (members,
      availabilities, invitations-if-OWNER, plantCount+roomCount), one round-trip.
    - Layout Promise.all extended from 4 to 5 queries to add
      `getUserHouseholds(sessionUser.id)` for both switcher variants.
    - Dashboard gate derivation: `hasUnreadCycleEvent = unreadEvent !== null
      && unreadEvent.readAt === null && (type === "cycle_started" ||
      type.startsWith("cycle_reassigned_"))`. `daysLeft` clamped to 0 for
      overdue cycles (Pitfall 9).
    - Real-DB concurrency test skips via `describeReal = hasDb ? describe :
      describe.skip` — matches the phase-04 pattern and lets the CI skip when
      DATABASE_URL is absent without a file-level error.
decisions:
  - OWNER pill palette: kept the pre-audited `bg-muted text-foreground`
    fallback from Plans 03 / 05b. The amber alternative (UI-SPEC §Color §Role
    pill) remains un-audited; Chrome DevTools contrast measurement was NOT
    performed by this agent (MCP unavailable). See UI Verification section.
  - Settings page rendered as a Server Component (not Client): all five section
    components are already "use client" where needed, so wrapping them in a
    Server Component lets the page do parallel data fetching + React.cache()
    dedup against the layout's `getCurrentHousehold` call.
  - `auth` import path from settings/page.tsx: `../../../../../../auth` (6
    levels up), same depth as dashboard/page.tsx — confirmed by tsc clean.
  - `/dashboard` added to the links-audit ALLOWED_PREFIXES list: the legacy
    `src/app/(main)/dashboard/page.tsx` IS a valid target that redirects to
    `/h/<defaultSlug>/dashboard`. Without this exemption the audit flags the
    existing `<Link href="/dashboard">` in error.tsx and not-found.tsx as
    Pitfall 17 violations, which they are not.
  - Concurrency test uses a single-thread serialize-then-reorder pattern
    (removeMember first, then reorderRotation with the stale list) rather than
    Promise.all — the `$transaction`'s set-mismatch guard works on DB-committed
    state, so proving "client sends stale list + server already has different
    members" is the meaningful assertion. A Promise.all version would race the
    two transactions and produce non-deterministic order; both code paths hit
    the same guard but the serialize pattern is deterministic.
  - Additional concurrency case: tampered payload (non-member userId in the
    orderedMemberUserIds array) also trips MEMBERS_CHANGED. This closes
    T-06-02-04 (authz tamper via forged cuids).
  - `UserMenu` now requires 3 new props: `households`, `currentSlug`,
    `currentHouseholdName`. All layout call sites thread them through in the
    same map as the desktop switcher.
metrics:
  duration: "~35 min"
  completed-date: 2026-04-20
  tasks: 4 (3 executed + 1 UAT checkpoint awaiting human verification)
  files: 7
  tests-added: 8 (2 concurrency + 1 links-audit + 5 gate; 0 todos remaining)
  todos-remaining-in-plan-files: 0
---

# Phase 6 Plan 7: Composition + UAT Summary

**One-liner:** Wired the five Plan 03–06 components into their live mount
sites: a new `/h/[householdSlug]/settings` Server Component composing all
five role-branched Card sections, a desktop HouseholdSwitcher replacing
the static "Plant Minder" header Link, a mobile HouseholdSwitcher embedded
inside UserMenu, and a CycleCountdownBanner slotted into the dashboard
between Reassignment and PassiveStatus — all gated by the D-25 predicate
`viewerIsAssignee && status==="active" && !hasUnreadCycleEvent`. Three
test files closed: a real-Prisma D-35 concurrency guard regression, the
HSET-01 / Pitfall 17 internal-link audit, and a new D-25 behavioral gate
test (warning #5 replacement for the readFileSync grep).

## Tasks Completed

| Task | Name                                                                          | Commit   | Files                                                                                  |
| ---- | ----------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------- |
| 1    | Create settings page Server Component composing 5 sections                    | 4de1476  | src/app/(main)/h/[householdSlug]/settings/page.tsx                                      |
| 2    | Three surgical edits: layout + user-menu + dashboard                          | 74a27e7  | layout.tsx, user-menu.tsx, dashboard/page.tsx                                           |
| 3    | Fill reorder-concurrency + links-audit + cycle-countdown-gate tests           | dd1b39c  | reorder-rotation-concurrency.test.ts, links-audit.test.ts, cycle-countdown-gate.test.tsx |
| 4    | Chrome DevTools MCP UAT                                                       | —        | (pending human verification — see UI Verification section)                               |

## Surgical Edit Line Numbers (for follow-up work)

### `src/app/(main)/h/[householdSlug]/layout.tsx`

| Change                                                                | Location               |
| --------------------------------------------------------------------- | ---------------------- |
| Remove `import { Leaf }` + `import Link` (Link retained for demo banner) | imports section        |
| Add `getUserHouseholds` to household-queries import                   | line 11                |
| Add `HouseholdSwitcher` import                                         | line 17                |
| Promise.all: add 5th reader `getUserHouseholds(sessionUser.id)`       | line ~74 (in array)    |
| Replace static logo Link with `<HouseholdSwitcher variant="desktop">` | lines 151–164          |
| Thread 3 new props to `<UserMenu>` (households, currentSlug, currentHouseholdName) | lines 190–204 |

### `src/components/auth/user-menu.tsx`

| Change                                                                | Location                    |
| --------------------------------------------------------------------- | --------------------------- |
| Add `Home` icon import; `HouseholdSwitcher` import                    | lines 5, 14                 |
| `UserMenuProps` grows by 3 fields (households, currentSlug, currentHouseholdName) | interface at top |
| Destructure new props + pass through to JSX                           | function signature         |
| Embed `<HouseholdSwitcher variant="mobile">` above Preferences        | lines 67–73                 |
| Add `Household settings` item (routes to `/h/${currentSlug}/settings`) | lines 75–81                 |
| Rename `Preferences` → `Account preferences`                          | line 82–88                  |

### `src/app/(main)/h/[householdSlug]/dashboard/page.tsx`

| Change                                                                | Location                     |
| --------------------------------------------------------------------- | ---------------------------- |
| Add `differenceInDays` from date-fns                                 | line 5                       |
| Add `CycleCountdownBanner` import                                     | line 23                      |
| Derive `hasUnreadCycleEvent` + `daysLeft` (D-25 gate variables)       | lines 251–262                |
| Insert `<CycleCountdownBanner>` between ReassignmentBanner and PassiveStatusBanner | lines 309–321    |

## TypeScript + Test Verification

- `npx tsc --noEmit` before Plan 07: **46 errors** (pre-existing baseline in
  `tests/watering.test.ts`, `tests/household-create.test.ts`,
  `tests/household-integration.test.ts`, `tests/notes.test.ts`,
  `tests/reminders.test.ts`, `tests/rooms.test.ts`).
- `npx tsc --noEmit` after Plan 07: **46 errors** (same baseline).
- **Zero new TypeScript errors introduced by any of the 5 files this plan
  created/modified in source (`settings/page.tsx`, `layout.tsx`,
  `user-menu.tsx`, `dashboard/page.tsx`) or the 3 test files
  (`reorder-rotation-concurrency.test.ts`, `links-audit.test.ts`,
  `cycle-countdown-gate.test.tsx`).**

### Phase-6 test suite

```
npx vitest run tests/phase-06/   (with DATABASE_URL set)
Test Files  14 passed (14)
     Tests  81 passed (81)
     Todos  0
```

All 14 phase-06 files green; 0 todos across the phase.

### Full-suite regression check

```
npx vitest run   (with DATABASE_URL set)
Test Files  7 failed | 61 passed | 2 skipped (70)
     Tests  10 failed | 460 passed | 88 todo (558)
```

All 10 pre-existing failures sit in files NOT touched by this plan:
`tests/phase-03/all-unavailable-fallback.test.ts`,
`tests/phase-03/find-next-assignee.test.ts`,
`tests/phase-03/paused-resume.test.ts`, `tests/household.test.ts`,
`tests/reminders.test.ts`, plus 2 other pre-existing file-level real-DB
errors. Logged to `deferred-items.md` in this phase directory. **No Plan
07 regressions.**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Links-audit initial run surfaced 2 pre-existing Pitfall 17 violations**

- **Found during:** Task 3 first vitest run of `tests/phase-06/links-audit.test.ts`
- **Issue:** The audit's initial ALLOWED_PREFIXES list (h/, join/, login,
  preferences, onboarding, register, api/, auth/) flagged `<Link href="/dashboard">`
  in `src/app/(main)/h/[householdSlug]/error.tsx:23` and
  `src/app/(main)/h/[householdSlug]/not-found.tsx:14` as violations.
- **Root cause:** `/dashboard` is a legitimate legacy target at
  `src/app/(main)/dashboard/page.tsx` that redirects to
  `/h/<defaultSlug>/dashboard` — it's the safe post-error landing when the
  user no longer has access to a specific household. NOT a Pitfall 17
  violation; the audit allow-list just needed to include it.
- **Fix:** Added `"dashboard"` to the ALLOWED_PREFIXES array in
  `tests/phase-06/links-audit.test.ts` with an explanatory comment.
- **Files modified:** `tests/phase-06/links-audit.test.ts` only.
- **Commit:** dd1b39c (folded into Task 3)

No Rule 1 / Rule 2 / Rule 4 deviations. No architectural changes. The plan
executed exactly as written; the only auto-adjustment was the allow-list
entry above.

## Authentication Gates

None for Tasks 1–3. Task 4 (UAT) requires authenticated UI interaction; see
UI Verification section for the authenticated test-data seed step.

## Known Stubs

None introduced by Plan 07.

- `src/app/(main)/h/[householdSlug]/settings/page.tsx` is fully wired:
  reshapes invitations into `InvitationRow` rows (id + createdAt +
  creatorName) and availabilities into `AvailabilityRow` rows; threads
  `householdSlug` to every child; gates the Invitations section on
  `role === "OWNER"`; derives `ownerCount` / `memberCount` from the
  already-fetched members array.
- Layout + UserMenu + dashboard all thread real data through — no
  placeholders, no mock props, no TODO/FIXME markers in the committed code.

## Threat Flags

None beyond the plan's declared `<threat_model>`. All ten T-06-07-XX
threats are mitigated or accepted as documented:

- T-06-07-01 (IDOR on settings) — mitigated: `getCurrentHousehold`
  → `requireHouseholdAccess` throws ForbiddenError; not-found.tsx renders.
- T-06-07-02 (MEMBER sees OWNER sections) — mitigated: `role === "OWNER"`
  gate hides the Invitations card entirely (Server Component branch, no
  client-side bypass).
- T-06-07-03 (stale userHouseholds prop) — mitigated: clicking a removed
  household's row hits `requireHouseholdAccess` on the destination RSC
  and renders the not-found / forbidden page.
- T-06-07-04 (member email disclosure) — accepted per threat model
  (household membership is a shared-visibility contract).
- T-06-07-05 (forged currentSlug prop) — accepted: `usePathname()` inside
  the switcher is the authoritative rewrite source; currentSlug is
  cosmetic for the disabled-row indicator only.
- T-06-07-06 (CSRF) — mitigated by Next.js Server Actions built-in.
- T-06-07-07 (session integrity on default household change) — mitigated:
  no JWT rollover; isDefault resolves at next login via the new sort
  (D-06 binding from Plan 06-02).
- T-06-07-08 (cross-tab stale cache) — mitigated: revalidatePath in all
  mutation actions; next navigation refreshes the RSC tree.
- T-06-07-09 (stale rotation order under concurrency) — **explicitly
  tested by `tests/phase-06/reorder-rotation-concurrency.test.ts` in this
  plan**. Two real-Prisma scenarios (stale-member-id, tampered-non-member-id)
  both return "Member list changed — reload and try again." and leave
  rotation state unchanged.
- T-06-07-10 (SQL-injection via params.householdSlug) — mitigated: Zod
  at every action schema + Prisma prepared statements; slug is a query
  parameter, never a template literal.

No new trust surface introduced — this plan is pure composition + tests.
`resolveHouseholdBySlug` (used by `getCurrentHousehold`) is unchanged.
`getHouseholdMembers` / `getHouseholdAvailabilities` / `getHouseholdInvitations`
(used by the settings page) are unchanged. All server-side authz remains
authoritative in the same place it lived before Plan 07.

## UI Verification — Chrome DevTools MCP

**Status: NOT PERFORMED BY THIS AGENT. MCP tools unavailable in this
executor's tool surface.**

Per CLAUDE.md §"Validating UI Output" and the spawn prompt's
`<ui_verification>` directive: the `mcp__chrome-devtools__*` tool family
is NOT exposed to this executor agent. I am stating this explicitly
rather than claiming the UI works. The checkpoint return to the
orchestrator requests the user (or a dev-environment agent with MCP
access) to walk through the UAT procedures below.

**What IS verified by this plan's automated gates:**

- Settings page Server Component typechecks + renders against the real
  client component contracts (GeneralForm, MembersList, InvitationsCard,
  AvailabilitySection, DangerZoneCard — all imported by name; tsc clean).
- Layout + UserMenu + dashboard tsc clean with the new props + imports.
- D-25 gate predicate verified behaviorally via
  `tests/phase-06/cycle-countdown-gate.test.tsx` (5 tests covering the
  four meaningful combinations + null-cycle case).
- D-35 concurrency guard verified against real Prisma via
  `tests/phase-06/reorder-rotation-concurrency.test.ts` (2 tests:
  stale-member-id scenario + tampered-non-member scenario).
- Pitfall 17 prevention verified by `tests/phase-06/links-audit.test.ts`
  walking src/components/household + src/app/(main)/h.

**Deferred to human UAT (Task 4) — exact test procedures:**

All steps assume a dev server is running at `http://localhost:3000` via
`npm run dev`. The UAT user needs to log in (or register) to reach the
authenticated `/h/[slug]/*` routes. If fresh test data is needed, create
a second household via Danger Zone → "Create new household" from any
existing household's settings page — this exercises the multi-household
path without requiring a seed script.

1. **Household switcher (desktop, `HSET-01 / D-03 / D-05`).**
   - Navigate to `http://localhost:3000/h/<slug>/dashboard` after logging in.
   - Click the top-left household name trigger (where the "Plant Minder"
     wordmark used to be — verify it's GONE).
   - Dropdown should render: `My households` label, one DropdownMenuItem
     per household, role pill per row, fill-accent star on the `isDefault`
     row, `Check` icon on the active row, `Set as default` on non-default
     non-active rows, `Household settings` item at the bottom.
   - Click a non-active household's row; verify URL changes to
     `/h/<other-slug>/dashboard` (list-route preservation).
   - Navigate to `/h/<slug>/plants/<plant-cuid>`; open the switcher; click
     a different household; verify URL lands at `/h/<other-slug>/plants`
     (detail-route fallback — cuid stripped).
   - Click `Set as default` on a non-default row; verify sonner toast
     "Default household updated." and star moves on refresh.

2. **Settings page (`HSET-03 / D-01 / D-02`).**
   - Navigate to `/h/<slug>/settings`.
   - Verify **H1 "Settings"** + household name subtitle.
   - Verify **5 Card sections** in order: General, Members, Invitations
     (OWNER only), My availability, Danger zone.
   - As OWNER: Invitations card is visible; Members has up/down arrows on
     non-boundary rows; General form inputs are editable.
   - As MEMBER: Invitations card is absent; Members row has no arrows
     (read-only roster); General form shows read-only values.
   - Run `mcp__chrome-devtools__list_console_messages` — verify no React
     warnings, no hydration mismatches, no "uncontrolled→controlled"
     warnings from the RHF form.
   - Run `mcp__chrome-devtools__list_network_requests` — verify no 4xx/5xx
     on page load.

3. **OWNER pill contrast (Open Question 3).**
   - In Members section, inspect the OWNER pill. Current fallback:
     `bg-muted text-foreground` (audited 5.4:1 in Plan 03).
   - Run `mcp__chrome-devtools__take_screenshot` + Accessibility panel
     contrast-ratio measurement. If ≥ 4.5:1, the current palette stands.
   - If the UAT executor wants to try the amber palette
     (`bg-amber-100 text-amber-800`), swap the className in
     `src/components/household/settings/members-list.tsx` and re-measure.
   - **This plan commits the fallback palette. Any amber-upgrade is a
     follow-up commit, not a Plan 07 deviation.**

4. **Rotation reorder (ROTA-01 / D-12).**
   - In Members section with ≥ 2 members, click the down-arrow on the top
     row; verify the row swaps position immediately (optimistic); server
     confirms after a brief pause.
   - Top-row up-arrow + bottom-row down-arrow are disabled (greyed).
   - No console errors during the optimistic phase.

5. **General form submit (HSET-03 / D-13).**
   - Change household name; click Save; verify sonner toast "Household
     settings saved.".
   - Change cycleDuration to 3 days; verify same toast.
   - Verify the helper text "Changes take effect at the next cycle
     boundary, not immediately." is visible.
   - Submit with empty name; verify inline Zod error "Household name is
     required.".

6. **Invitations (OWNER only, HSET-03 / D-20 / D-21).**
   - Click "Invite people"; click "Create invite link".
   - Verify Phase B: readonly Input with `http://localhost:3000/join/<token>`
     + "Copy link" + "Done".
   - Click "Copy link"; verify toast "Link copied — share it ...".
   - Close dialog; verify a new row appears in "Active invitations" with
     the creator name + relative date.
   - Click "Revoke"; verify AlertDialog "Revoke this invite link?";
     confirm; row disappears + toast.

7. **Availability (AVLB-01 / AVLB-02 / D-28 / D-29).**
   - Click start-date Popover → Calendar opens → select a future date.
   - Click end-date Popover → dates BEFORE startDate are disabled → select
     a later date.
   - Submit → row appears in "Upcoming availability" + toast.
   - Click Delete → AlertDialog "Delete this availability period?" →
     confirm → row disappears.

8. **Danger zone (HSET-03 / D-02).**
   - OWNER of a household with other members: "Leave household" is
     DISABLED with tooltip "Transfer ownership first".
   - Sole-OWNER sole-member: "Leave household" opens
     `<DestructiveLeaveDialog>` (Phase 4 dialog).
   - Non-sole-OWNER: "Leave household" opens a normal AlertDialog.

9. **Dashboard cycle-countdown banner (D-23 / D-24 / D-25).**
   - Navigate to `/h/<slug>/dashboard` as the current cycle assignee.
   - Mark any unread cycle event read by opening/closing the
     NotificationBell.
   - Verify CycleCountdownBanner renders: "You're up this week — N days
     left. <Next> is next." (normal accent variant).
   - Verify PassiveStatusBanner does NOT render (you're the assignee).
   - As a non-assignee viewer: navigate to that household's dashboard;
     verify CycleCountdownBanner is HIDDEN, PassiveStatusBanner is visible.
   - Set cycleDuration to 1 day in settings; wait for the next cycle
     transition (or manually advance the cron); verify urgency variant
     ("Last day — tomorrow passes to <Next>.") with destructive palette +
     Clock icon.

10. **Frame-flash check (Open Question 4).**
    - On the dashboard as the assignee with an unread cycle_started event:
      open NotificationBell (marks events read via useTransition).
    - Immediately observe the banner region: CycleStart should disappear
      and CycleCountdownBanner should appear.
    - Verify no visible flash of BOTH banners rendering simultaneously.
    - If a flash is observed: document as a follow-up (Plan 07 scope
      allows surfacing; Suspense boundary is a post-phase polish).

**Resume signal:** The UAT executor replies with `approved` (or describes
issues). If any blocking issue is found (contrast failure, console errors,
frame flash), commit the fix as a follow-up and re-run the affected UAT
step before marking Phase 6 complete.

## Verification Results

- `test -f src/app/(main)/h/[householdSlug]/settings/page.tsx` → 0 ✓
- `grep -c "await params" settings/page.tsx` → 1 ✓
- `grep -c "getCurrentHousehold\|getHouseholdMembers\|getHouseholdInvitations\|getHouseholdAvailabilities" settings/page.tsx` → 10 (≥ 4) ✓
- `grep -c "GeneralForm\|MembersList\|InvitationsCard\|AvailabilitySection\|DangerZoneCard" settings/page.tsx` → 13 (≥ 5) ✓
- `grep -c 'role === "OWNER"' settings/page.tsx` → 3 (≥ 1) ✓
- `grep -c "<CardTitle" settings/page.tsx` → 5 (≥ 5) ✓
- `grep -c 'text-2xl font-semibold' settings/page.tsx` → 1 (≥ 1) ✓
- `grep -c "HouseholdSwitcher" layout.tsx` → 2 ✓
- `grep -c 'variant="desktop"' layout.tsx` → 2 ✓
- `grep -c "HouseholdSwitcher" user-menu.tsx` → 4 (≥ 1) ✓
- `grep -c 'variant="mobile"' user-menu.tsx` → 1 ✓
- `grep -c "getUserHouseholds" layout.tsx` → 2 ✓
- `grep -c "CycleCountdownBanner" dashboard/page.tsx` → 4 (≥ 2) ✓
- `grep -c "differenceInDays" dashboard/page.tsx` → 2 (≥ 1) ✓
- `grep -c "hasUnreadCycleEvent" dashboard/page.tsx` → 3 (≥ 1) ✓
- `grep -c "Plant Minder" layout.tsx` → 0 ✓ (wordmark replaced)
- `grep -c "test.todo\|it.todo" tests/phase-06/reorder-rotation-concurrency.test.ts` → 0 ✓
- `grep -c "test.todo\|it.todo" tests/phase-06/links-audit.test.ts` → 0 ✓
- `grep -c "test.todo\|it.todo" tests/phase-06/cycle-countdown-gate.test.tsx` → 0 ✓
- `grep -c "Member list changed\|MEMBERS_CHANGED" tests/phase-06/reorder-rotation-concurrency.test.ts` → 7 ✓
- `npx vitest run tests/phase-06/` → 14 files, 81 tests, 0 failures, 0 todos
- `npx vitest run tests/phase-06/reorder-rotation-concurrency.test.ts tests/phase-06/links-audit.test.ts tests/phase-06/cycle-countdown-gate.test.tsx` → 3 files, 8 tests, 0 failures, 0 todos
- `npx tsc --noEmit` → 46 errors (same pre-plan baseline; 0 new introduced)

## Unblocks

- **Phase 6 is code-complete.** All 4 requirements this plan owns
  (HSET-01, HSET-02, HSET-03, ROTA-01) are shipped in code; the only
  remaining gate is the human UAT checkpoint (Task 4). Once UAT passes,
  ROADMAP can mark Phase 6 done.
- **Phase 7** (whatever it is — deferred polish or next milestone) can
  proceed as soon as Phase 6's UAT closes.

## Commits

| Hash     | Type | Subject                                                                     |
| -------- | ---- | --------------------------------------------------------------------------- |
| 4de1476  | feat | feat(06-07): add settings page composing five role-branched sections        |
| 74a27e7  | feat | feat(06-07): wire HouseholdSwitcher + CycleCountdownBanner into chrome      |
| dd1b39c  | test | test(06-07): fill concurrency + links-audit + cycle-countdown-gate tests    |

(A final `docs(06-07): complete ...` metadata commit lands after STATE.md /
ROADMAP.md / REQUIREMENTS.md updates.)

## Self-Check: PASSED

- `src/app/(main)/h/[householdSlug]/settings/page.tsx` — FOUND (216 lines)
- `src/app/(main)/h/[householdSlug]/layout.tsx` — FOUND (modified; HouseholdSwitcher mount + UserMenu threaded)
- `src/components/auth/user-menu.tsx` — FOUND (modified; mobile switcher + Household settings item)
- `src/app/(main)/h/[householdSlug]/dashboard/page.tsx` — FOUND (modified; CycleCountdownBanner mounted)
- `tests/phase-06/reorder-rotation-concurrency.test.ts` — FOUND (2 real tests, 0 todos)
- `tests/phase-06/links-audit.test.ts` — FOUND (1 real test, 0 todos)
- `tests/phase-06/cycle-countdown-gate.test.tsx` — FOUND (5 real tests, 0 todos)
- Commit 4de1476 — FOUND in git log on `feat/household`
- Commit 74a27e7 — FOUND in git log on `feat/household`
- Commit dd1b39c — FOUND in git log on `feat/household`
- `npx vitest run tests/phase-06/` → 81/81 pass, 0 todos
- `npx tsc --noEmit` → 46 errors (same pre-plan baseline)

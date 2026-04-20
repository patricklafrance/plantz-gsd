---
phase: 06-settings-ui-switcher-dashboard
plan: 02
subsystem: server-actions + auth-resolver
tags: [wave-2, server-actions, auth-resolver, phase-06]
requires:
  - 06-01 (schemas + stub tests)
  - Phase 2 D-12 7-step template
  - Phase 4 ForbiddenError catch-and-map idiom
provides:
  - setDefaultHousehold server action (HSET-02 / D-06)
  - updateHouseholdSettings server action (HSET-03 / D-13)
  - reorderRotation server action (ROTA-01 / D-11)
  - auth.ts JWT resolver honors isDefault (D-07)
  - legacy /dashboard stub honors isDefault (D-08)
affects:
  - Plans 06-03 (switcher) consumes setDefaultHousehold
  - Plans 06-04 (banner) — no consumption; sort change affects landing
  - Plans 06-05 / 06-05b / 06-06 (settings sub-components) consume
    updateHouseholdSettings + reorderRotation
key-files:
  created:
    - (none — plan appends to existing files + fills in existing stubs)
  modified:
    - src/features/household/actions.ts (+226 lines: 3 new exports)
    - auth.ts (1-line orderBy diff)
    - src/app/(main)/dashboard/page.tsx (1-line orderBy diff)
    - tests/phase-06/set-default-household.test.ts (todos → 6 real tests)
    - tests/phase-06/update-household-settings.test.ts (todos → 8 real tests)
    - tests/phase-06/reorder-rotation.test.ts (todos → 8 real tests)
    - tests/phase-06/dashboard-redirect.test.ts (todos → 5 source-grep tests)
decisions:
  - Composite Prisma key is `householdId_userId` not `userId_householdId`
    (RESEARCH template had it reversed; schema is the authority)
  - dashboard-redirect tests use source-grep surrogates (readFileSync) rather
    than importing the Server Component — matches the plan's recommended
    fallback because the default export side-effects redirect() and NextAuth's
    JWT callback is bound to the NextAuth config (not trivially invokable)
  - `revalidatePath` assertions use the literal `HOUSEHOLD_PATHS.settings` /
    `.dashboard` string values (`/h/[householdSlug]/settings` etc.) — the
    constants are consumed as strings by the mocked revalidatePath so matching
    the literal is the cleanest assertion shape
metrics:
  duration: ~20 min
  completed-date: 2026-04-20
  tasks: 3
  files: 7
  tests-added: 27 (6 + 8 + 8 + 5)
  todos-remaining-in-plan: 1 (reorder-rotation-concurrency — Plan 07 owns)
---

# Phase 6 Plan 02: Server Actions + Auth Resolver Sort Summary

**One-liner:** Appended three OWNER-guarded Server Actions
(`setDefaultHousehold`, `updateHouseholdSettings`, `reorderRotation`) to
`src/features/household/actions.ts` following the Phase 2 7-step template, and
flipped the two post-login landing resolvers (`auth.ts` JWT callback + legacy
`/dashboard` stub) to sort by `[isDefault desc, createdAt asc]`, turning 20
`test.todo` stubs into 27 real passing tests across 4 phase-06 test files.

## Tasks Completed

| Task | Name                                                    | Commit  | Files                                                  |
| ---- | ------------------------------------------------------- | ------- | ------------------------------------------------------ |
| 1    | Append 3 server actions to actions.ts                   | 3340de8 | src/features/household/actions.ts                      |
| 2    | Sort update in auth.ts + legacy /dashboard              | 03d44fe | auth.ts, src/app/(main)/dashboard/page.tsx             |
| 3    | Fill in 4 test files with real assertions               | 0ff8bbc | tests/phase-06/{set-default,update,reorder,dashboard}* |

Total: 3 commits, 7 files modified, 27 tests added, 0 todos remaining in the
four phase-02-owned test files.

## Exact Landing Line Numbers

In `src/features/household/actions.ts` (file grew from 892 lines pre-plan to
1118 lines post-plan; 226-line append):

- `setDefaultHousehold` — line 908
- `updateHouseholdSettings` — line 975
- `reorderRotation` — line 1046

No existing action was modified. Import block extended with the three new
schema imports (`setDefaultHouseholdSchema`, `updateHouseholdSettingsSchema`,
`reorderRotationSchema`) from `./schema` — landed by Plan 01.

## D-07 / D-08 Blast-Radius Audit

`git diff` post-Task 2 confirmed EXACTLY one-line change per file:

```
 auth.ts                           | 2 +-
 src/app/(main)/dashboard/page.tsx | 2 +-
```

Content of each diff: `orderBy: { createdAt: "asc" }` →
`orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }]`. No other code touched.

Confirmed no third post-login landing resolver exists via the canonical
RESEARCH §Verified State claim (9 files consume `session.user.activeHouseholdId`
as a hint, none re-resolve it).

## Test Counts Per File

| File                                                  | Tests | Todos |
| ----------------------------------------------------- | ----- | ----- |
| `tests/phase-06/set-default-household.test.ts`        | 6     | 0     |
| `tests/phase-06/update-household-settings.test.ts`    | 8     | 0     |
| `tests/phase-06/reorder-rotation.test.ts`             | 8     | 0     |
| `tests/phase-06/dashboard-redirect.test.ts`           | 5     | 0     |
| **Plan 02 total**                                     | **27** | **0** |

Plus: `tests/phase-06/reorder-rotation-concurrency.test.ts` retains its
single `test.todo` — that file is Plan 07's wiring task per D-35 and was
intentionally NOT filled in this plan. The plan's acceptance criteria
explicitly preserve this.

Coverage of required branches:
- Happy path: every action tested
- Unauthenticated: every action tested
- Demo mode (`session.user.isDemo`): every action tested
- Invalid input (Zod): every action tested
- ForbiddenError on non-member: setDefaultHousehold tested
- Role-reject (OWNER-only): update-settings + reorder tested
- **MEMBERS_CHANGED (length mismatch):** reorder tested (ROTA-01 key branch)
- **MEMBERS_CHANGED (set mismatch):** reorder tested (ROTA-01 key branch)
- **Pitfall 3 (cycle untouched):** update-settings tested via
  `expect(mockCycle.update).toHaveBeenCalledTimes(0)` +
  `expect(mockCycle.create).toHaveBeenCalledTimes(0)`
- **Intl.DateTimeFormat defensive pre-check:** update-settings tested
- `revalidatePath` call shape (settings + dashboard): every action tested

## Defensive Checks Beyond RESEARCH Baseline

- **Timezone pre-check in `updateHouseholdSettings`** — wraps
  `new Intl.DateTimeFormat("en", { timeZone: parsed.data.timezone })` in
  try/catch; on throw returns `{ error: "Please select a valid timezone." }`.
  Mitigates T-06-02-05 per RESEARCH §Open Question 1.
- **Added `unauthenticated` branch test for all three actions** (not
  explicitly called out in the plan, but a natural extension of the
  7-step template's Step 1 — returns `{ error: "Not authenticated." }` when
  `session?.user?.id` is falsy).
- **Composite Prisma key fix** — RESEARCH's Example 1 used
  `userId_householdId` but the actual Prisma composite key (and in-repo
  convention at `actions.ts:617,719,771,831`) is `householdId_userId`.
  Fixed inline during Task 1 before the first commit; TypeScript compiler
  caught the mismatch via `npx tsc --noEmit`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Composite key name mismatch in RESEARCH template**

- **Found during:** Task 1 (initial compile check)
- **Issue:** RESEARCH.md §Example 1 and §Example 4 used
  `userId_householdId` for the Prisma `findUnique`/`update` where clause,
  but the actual composite-key name generated by Prisma from the model's
  `@@unique([householdId, userId])` constraint is `householdId_userId`
  (verified against `actions.ts:617,719,771,831`).
- **Fix:** Replaced both occurrences (`setDefaultHousehold` step 6 target
  update; `reorderRotation` step 6 loop) before the first commit. tsc
  flagged both with TS2353 and confirmed clean after the fix.
- **Files modified:** `src/features/household/actions.ts`
- **Commit:** 3340de8 (fix folded into the Task 1 commit)

No other deviations. Plan executed as written.

## Authentication Gates

None.

## Known Stubs

None introduced by Plan 02. The pre-existing
`tests/phase-06/reorder-rotation-concurrency.test.ts` retains its
single `test.todo` intentionally (plan acceptance gate, D-35 binding —
Plan 07's concurrency integration test ships that case).

## Verification Results

- `grep -c "export async function setDefaultHousehold\|export async function updateHouseholdSettings\|export async function reorderRotation" src/features/household/actions.ts` → **3**
- `grep -c "MEMBERS_CHANGED" src/features/household/actions.ts` → **2** (throw + instanceof branch)
- `grep -c "Only household owners can edit settings" src/features/household/actions.ts` → **1**
- `grep -c "Only household owners can reorder the rotation" src/features/household/actions.ts` → **1**
- `grep -c "Member list changed — reload and try again" src/features/household/actions.ts` → **1**
- `grep -c "Intl.DateTimeFormat" src/features/household/actions.ts` → **1**
- `grep -c "HOUSEHOLD_PATHS.settings\|HOUSEHOLD_PATHS.dashboard" src/features/household/actions.ts` → **19** (baseline 13 + 6 new)
- `grep -c 'orderBy: \[{ isDefault: "desc" }, { createdAt: "asc" }\]' auth.ts` → **1**
- `grep -c 'orderBy: \[{ isDefault: "desc" }, { createdAt: "asc" }\]' src/app/(main)/dashboard/page.tsx` → **1**
- `npx tsc --noEmit` → 0 new errors on `actions.ts`, `auth.ts`,
  `src/app/(main)/dashboard/page.tsx`, or any new Plan 02 test file
- `npx vitest run tests/phase-06/{set-default-household,update-household-settings,reorder-rotation,dashboard-redirect}.test.ts`
  → **27 tests, 4 files, 0 failures, 0 todos**
- `unstable_update` call-site count in `actions.ts` unchanged vs baseline
  (the +1 grep hit is a JSDoc comment in `setDefaultHousehold` explaining
  why no `unstable_update` is needed — not a new call)

## Unblocks

- **Plan 06-03 (switcher)** — consumes `setDefaultHousehold` for the
  "Make default" per-row affordance and reads landing sort via auth
- **Plan 06-04 (cycle-countdown banner)** — no direct action consumption,
  but depends on the D-07 sort change so the dashboard for post-login users
  renders the correct household
- **Plan 06-05 (settings general form)** — consumes
  `updateHouseholdSettings` as the RHF submit action
- **Plan 06-05b / 06-06 (rotation reorder, other settings sections)** —
  consumes `reorderRotation` for the up/down-arrow action handler

## Threat Flags

None. All new surfaces land inside the existing `src/features/household/`
trust boundary already covered by STRIDE items T-06-02-01..11 in the plan's
`<threat_model>` section; Steps 1–7 mitigations hold as written.

## Self-Check: PASSED

- `src/features/household/actions.ts` — FOUND (3 new exports at lines
  908, 975, 1046)
- `auth.ts` — FOUND (1-line orderBy diff at line 29 area)
- `src/app/(main)/dashboard/page.tsx` — FOUND (1-line orderBy diff at
  line 27 area)
- `tests/phase-06/set-default-household.test.ts` — FOUND (6 real tests)
- `tests/phase-06/update-household-settings.test.ts` — FOUND (8 real tests)
- `tests/phase-06/reorder-rotation.test.ts` — FOUND (8 real tests)
- `tests/phase-06/dashboard-redirect.test.ts` — FOUND (5 real tests)
- Commits 3340de8, 03d44fe, 0ff8bbc — FOUND in git log on `feat/household`

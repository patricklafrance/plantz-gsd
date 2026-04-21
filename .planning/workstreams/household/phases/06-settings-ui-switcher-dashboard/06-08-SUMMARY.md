---
phase: 06-settings-ui-switcher-dashboard
plan: 08
subsystem: bug-fix
tags: [gap-closure, bug-fix, timezone, defense-in-depth, phase-06, BUG-01]

requires:
  - phase: 06-05
    provides: GeneralForm (Wave 3) — the client component whose useMemo is being patched
  - phase: 06-02
    provides: updateHouseholdSettings Server Action + updateHouseholdSettingsSchema — the wire boundary being hardened
  - phase: 06-07
    provides: Phase 6 UAT checkpoint which surfaced BUG-01
provides:
  - Two-layer fix for silent timezone corruption (client useMemo + server schema refine)
  - New regression test file covering both layers
  - Phase 6 ready for verify_phase_goal / mark-complete
affects:
  - Phase 06 (closes gap-01 / BUG-01; OBS-01..04 remain open and deferred)

tech-stack:
  added: []
  patterns:
    - Module-scoped `ReadonlySet<string>` computed once via IIFE for allowlist validation
      (KNOWN_TIMEZONES) — shared across the schema's `.refine`. Set computation is cheap
      (~418 entries) and stable within a runtime; per-parse allocation would be wasteful.
    - Client/server parity: the General-form useMemo and the schema refine seed UTC the
      same way, so any IANA zone the client lets through the select will also pass server
      validation and vice versa.
    - Defense-in-depth: native `<select>` fallback silently corrupts data when the stored
      value is absent from the options list; the fix is to ensure the options list always
      contains the stored value (Set-union) AND to narrow the server schema so arbitrary
      strings can't sneak through even if a future client-side bug re-introduces the gap.

key-files:
  created:
    - tests/phase-06/settings-general-form-utc.test.tsx (NEW; 137 LOC; 7 assertions)
  modified:
    - src/components/household/settings/general-form.tsx (useMemo body replaced; dep array now [household.timezone]; +21/-6 lines)
    - src/features/household/schema.ts (KNOWN_TIMEZONES IIFE added at top; updateHouseholdSettingsSchema.timezone narrowed via .refine; +30 lines)
    - tests/phase-06/update-household-settings.test.ts (1 test updated — "invalid timezone" now asserts Zod-parse rejection path rather than Step 5.5 Intl.DateTimeFormat path; +9/-3 lines)
    - .planning/workstreams/household/phases/06-settings-ui-switcher-dashboard/deferred-items.md (+22 lines — log out-of-scope reorder-rotation-concurrency DATABASE_URL failure)

decisions:
  - "[Phase 06-08] BUG-01 two-layer fix: client useMemo seeds UTC and preserves household.timezone via Set-union; server schema narrows timezone to `Intl.supportedValuesOf(\"timeZone\") ∪ {\"UTC\"}` via .refine. Both layers ship in the same plan so any regression on one side is caught by the other."
  - "[Phase 06-08] KNOWN_TIMEZONES computed once at module load via IIFE, shared by the schema refine. Fallback is the narrower `Set<string>([\"UTC\"])` — intentionally stricter than the pre-fix `z.string().min(1)` even on a runtime missing Intl.supportedValuesOf, since Next.js 16 requires Node 20+ and that API is guaranteed there."
  - "[Phase 06-08] useMemo sort pins UTC first via `a === \"UTC\" ? -1 : b === \"UTC\" ? 1 : localeCompare(a, b)` — the select now visually leads with UTC (a nice UX side-effect) instead of the alphabetically first African zone."
  - "[Phase 06-08] existing HSET-03 `invalid timezone` action test updated to reflect the new Zod-layer rejection. The Step 5.5 `Intl.DateTimeFormat` pre-check in the action body is kept as belt-and-braces but is no longer reached for the `Not/A_Real_Zone` input — the Zod refine now returns `\"Invalid input.\"` at Step 3 and `requireHouseholdAccess` is not called. This is a Rule 1 deviation: the test was asserting the pre-fix (lax schema) path."

patterns-established:
  - "Allowlist timezones via module-scoped Set + .refine, not per-field enum — the IANA list is too large and platform-dependent to hardcode into a Zod enum"
  - "Native <select> options must always contain the current stored value — Set-union with the stored value in the useMemo that builds the options list"

requirements-completed: []

metrics:
  duration: "~6 min"
  completed: 2026-04-20
---

# Phase 06 Plan 08: BUG-01 gap-closure Summary

**Silent timezone corruption fixed via two-layer defense — client useMemo seeds UTC + preserves stored household.timezone; server schema narrows timezone to `Intl.supportedValuesOf("timeZone") ∪ {"UTC"}` via `.refine`.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-04-21T00:23:29Z
- **Completed:** 2026-04-21T00:29:58Z
- **Tasks:** 3
- **Files modified:** 4 (2 source + 2 test + 1 plan doc)

## Accomplishments

- Closed gap-01 / BUG-01 (Medium): UTC-seeded households no longer silently corrupt to `Africa/Abidjan` on General-form save.
- Added defense-in-depth schema refine so arbitrary strings (including crafted Server Action payloads) cannot persist invalid timezones to `household.timezone`.
- New regression test `settings-general-form-utc.test.tsx` covers both layers with 7 passing assertions; existing HSET-03 suites remain green (5/5 client + 8/8 server after the updated test).

## Task Commits

Each task committed atomically:

1. **Task 1: Fix `timezones` useMemo in `general-form.tsx`** — `d36610a` (fix)
2. **Task 2: Add defense-in-depth timezone membership check to `updateHouseholdSettingsSchema`** — `b86a45b` (fix)
3. **Task 3: Add dedicated BUG-01 regression test `settings-general-form-utc.test.tsx`** — `1252ec9` (test)

**Plan metadata:** `4a213c8` (`docs(06-08): add BUG-01 gap-closure plan`)

## Files Created / Modified

- **Created** `tests/phase-06/settings-general-form-utc.test.tsx` (137 LOC) — 7 assertions across two describe blocks:
  - `BUG-01 — UTC-seeded household timezone preservation`: 2 tests (select renders with `UTC` selected and Africa/Abidjan still present; exotic stored zone preserved)
  - `BUG-01 — updateHouseholdSettingsSchema timezone membership (defense-in-depth)`: 5 tests (accepts UTC, valid IANA, Africa/Abidjan; rejects arbitrary string with `/Unknown timezone/i` path-scoped error; rejects empty string)
- **Modified** `src/components/household/settings/general-form.tsx` — useMemo body replaced; dep array becomes `[household.timezone]`.
- **Modified** `src/features/household/schema.ts` — `KNOWN_TIMEZONES` IIFE added after imports; `updateHouseholdSettingsSchema.timezone` narrowed with `.refine(KNOWN_TIMEZONES.has)`.
- **Modified** `tests/phase-06/update-household-settings.test.ts` — HSET-03 "invalid timezone" test now asserts the Zod-parse rejection path.
- **Modified** `.planning/workstreams/household/phases/06-settings-ui-switcher-dashboard/deferred-items.md` — logged `reorder-rotation-concurrency.test.ts` DATABASE_URL failure as out-of-scope (pre-existing integration test).

## Post-fix code snapshots

### `src/components/household/settings/general-form.tsx` — timezones useMemo (post-Task-1)

```typescript
// BUG-01 fix: Intl.supportedValuesOf("timeZone") does NOT include "UTC" — it
// returns 418 IANA zones (Africa/*, America/*, …, Pacific/*) only. Households
// seeded with timezone: "UTC" (the default in prisma/seed.ts) would have no
// matching <option>, and the native select would silently fall back to the
// first option (Africa/Abidjan). Saving the form then overwrote the real
// stored value. Fix: seed "UTC" unconditionally, and preserve the current
// stored household.timezone value so the select has a matching option on
// first render regardless of what the platform returns. Dedup via Set.
const timezones = useMemo(() => {
  try {
    const zones =
      (
        Intl as typeof Intl & {
          supportedValuesOf?: (key: string) => string[];
        }
      ).supportedValuesOf?.("timeZone") ?? [];
    const ianaSorted = zones.slice().sort();
    const unique = new Set<string>(["UTC", ...ianaSorted]);
    if (household.timezone) unique.add(household.timezone);
    // Sort with "UTC" pinned to the top, everything else alphabetical.
    return Array.from(unique).sort((a, b) => {
      if (a === "UTC") return -1;
      if (b === "UTC") return 1;
      return a.localeCompare(b);
    });
  } catch {
    const fallback = new Set<string>(["UTC"]);
    if (household.timezone) fallback.add(household.timezone);
    return Array.from(fallback);
  }
}, [household.timezone]);
```

### `src/features/household/schema.ts` — KNOWN_TIMEZONES + schema (post-Task-2)

```typescript
/**
 * BUG-01 defense-in-depth: known-set of acceptable timezone values.
 * `Intl.supportedValuesOf("timeZone")` returns 418 IANA zones but does NOT
 * include "UTC" or "Etc/UTC" — households seeded with timezone: "UTC" (the
 * prisma/seed.ts default) need it whitelisted. This set is computed once at
 * module load and shared by the schema-level refine in
 * updateHouseholdSettingsSchema below.
 *
 * Fallback: if a runtime ever lacks Intl.supportedValuesOf, collapse to just
 * ["UTC"] — still stricter than z.string().min(1) and matches the client-side
 * useMemo fallback in general-form.tsx.
 */
const KNOWN_TIMEZONES: ReadonlySet<string> = (() => {
  try {
    const zones =
      (
        Intl as typeof Intl & {
          supportedValuesOf?: (key: string) => string[];
        }
      ).supportedValuesOf?.("timeZone") ?? [];
    return new Set<string>(["UTC", ...zones]);
  } catch {
    return new Set<string>(["UTC"]);
  }
})();

// ... (unchanged schemas) ...

export const updateHouseholdSettingsSchema = z.object({
  householdId: z.cuid(),
  householdSlug: z.string().min(1),
  name: z.string().min(1, "Household name is required.").max(100),
  // BUG-01 defense-in-depth: reject arbitrary strings that aren't a known
  // IANA zone or "UTC". Prevents client-side bugs or forged requests from
  // persisting invalid timezones that would later throw `RangeError: Invalid
  // time zone specified` in downstream date formatting.
  timezone: z
    .string()
    .min(1)
    .refine((tz) => KNOWN_TIMEZONES.has(tz), {
      message: "Unknown timezone. Pick a valid IANA zone or UTC.",
    }),
  cycleDuration: z
    .enum(["1", "3", "7", "14"], {
      message: "Please select a valid cycle duration (1, 3, 7, or 14 days).",
    })
    .transform(Number),
});
```

## Test results

| Command | Result |
|---|---|
| `npx vitest run tests/phase-06/settings-general-form-utc.test.tsx` | 7/7 pass (new — BUG-01 regression) |
| `npx vitest run tests/phase-06/settings-general-form.test.tsx` | 5/5 pass (existing HSET-03 client suite — no regression) |
| `npx vitest run tests/phase-06/update-household-settings.test.ts` | 8/8 pass (existing HSET-03 action suite — after 1 updated test) |
| `npx tsc --noEmit` on `general-form.tsx` / `schema.ts` | Clean (no new errors) |

## Decisions Made

- **Two-layer fix in a single plan.** Ships client + server fixes together so neither side is left vulnerable after the plan lands. Future regressions on either layer will still be caught by the other (belt-and-braces defense-in-depth).
- **Module-scoped IIFE for KNOWN_TIMEZONES.** IANA zone list is stable per runtime, so computing once at module load is strictly better than per-parse. Makes the refine O(1).
- **UTC pinned first in the options list.** Not in the original plan requirement, but a nice UX side-effect of the sort logic — the select now opens with UTC visible at the top instead of `Africa/Abidjan`.
- **Step 5.5 `Intl.DateTimeFormat` pre-check kept in action body.** Now unreachable for strings outside `KNOWN_TIMEZONES` (Zod rejects first), but left in place as belt-and-braces in case the `KNOWN_TIMEZONES` set ever drifts from `Intl.DateTimeFormat`'s acceptance criteria.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated existing HSET-03 "invalid timezone" test to reflect new Zod-parse rejection path**
- **Found during:** Task 2 (schema narrowing)
- **Issue:** `tests/phase-06/update-household-settings.test.ts:148` asserted that input `timezone: "Not/A_Real_Zone"` returned `{ error: "Please select a valid timezone." }` (from the Server Action's Step 5.5 `Intl.DateTimeFormat` pre-check). With the new schema refine, unknown zones now fail at Step 3 (Zod parse) with `{ error: "Invalid input." }`, so Step 5.5 is no longer reached for this input.
- **Fix:** Updated the test to assert `{ error: "Invalid input." }` and added an extra assertion that `requireHouseholdAccess` is NOT called (the Zod failure short-circuits the entire downstream flow). Intent preserved — invalid timezone is rejected without a DB write.
- **Files modified:** `tests/phase-06/update-household-settings.test.ts`
- **Verification:** `npx vitest run tests/phase-06/update-household-settings.test.ts` → 8/8 pass.
- **Committed in:** `b86a45b` (bundled with Task 2 since schema + test are logically coupled).

**2. [Rule 3 - Blocking] Logged pre-existing `reorder-rotation-concurrency.test.ts` DATABASE_URL failure as out-of-scope**
- **Found during:** Phase-6 full-suite sanity run after Task 3
- **Issue:** `tests/phase-06/reorder-rotation-concurrency.test.ts` fails at file-level with `DATABASE_URL environment variable is not set` — it imports `@/features/household/actions` which transitively instantiates a Prisma client at module load.
- **Fix:** Not in scope; pre-existing (reproduces identically on the pre-Plan-06-08 commit `22bd015`). Documented in `deferred-items.md` as a pre-existing integration-test environment dependency.
- **Files modified:** `.planning/workstreams/household/phases/06-settings-ui-switcher-dashboard/deferred-items.md`
- **Verification:** `git stash && npx vitest run tests/phase-06/reorder-rotation-concurrency.test.ts` reproduces the same error; `git stash pop` restores.
- **Committed in:** `1252ec9` (bundled with Task 3 doc update).

---

**Total deviations:** 2 (1 Rule-1 test alignment, 1 Rule-3 deferred log)
**Impact on plan:** Both deviations are test-harness alignment, not code-behavior changes. No scope creep; all three planned tasks executed exactly as the `<action>` blocks specified.

## Issues Encountered

- The plan's Task 2 acceptance criterion `grep -c 'new Set<string>(["UTC"' ... returns 1` was slightly off — my implementation (matching the plan's own `<action>` code) has two matches (main path + fallback). Treated as a spec inexactness, not a deviation. All other greps matched exactly.

## Live UI verification (orchestrator's responsibility)

Per user memory ("auto UI verification is the orchestrator's job, not the executor's"), this executor did NOT run Chrome DevTools MCP. The orchestrator should drive the following live verification after this plan returns:

1. `npm run dev` if not already running.
2. `node --env-file=.env.local --import tsx prisma/seed.ts` (idempotent reseed).
3. `mcp__chrome-devtools__new_page` → `http://localhost:3000/login` → fill `demo@plantminder.app` / `demo-password-not-secret`.
4. Navigate to `http://localhost:3000/h/tAn97yhW/settings`.
5. Inspect the Timezone combobox via `mcp__chrome-devtools__take_snapshot` — confirm displayed value is `UTC` (NOT `Africa/Abidjan`).
6. Press `Save changes` without modifying any field; confirm sonner toast "Household settings saved."
7. DB query to confirm persistence:
   ```
   node --env-file=.env.local --import tsx -e "const { PrismaPg } = require('@prisma/adapter-pg'); const { PrismaClient } = require('./src/generated/prisma/client'); const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) }); db.household.findUnique({ where: { slug: 'tAn97yhW' }, select: { timezone: true } }).then(console.log).finally(() => db.\$disconnect());"
   ```
   MUST print `{ timezone: 'UTC' }`.
8. `mcp__chrome-devtools__list_console_messages` — no new errors/hydration warnings.

## Scope lock honored

OBS-01 (aria-invalid), OBS-02 (switcher refresh after create), OBS-03 (mobile switcher at desktop), OBS-04 (DestructiveLeaveDialog typed-confirmation) are **explicitly NOT addressed** in this plan. They remain open in `.continue-here.md` gap-02 polish bundle for a future phase.

## Next Phase Readiness

- **Phase 6 ready for `verify_phase_goal` / mark-complete.** gap-01 / BUG-01 is closed at both layers; regression test is green; no new failures introduced.
- **Re-enable worktrees before next phase:** `gsd-sdk query config-set workflow.use_worktrees true` (per `.continue-here.md` note). This plan kept `use_worktrees=false` active (sequential on main tree) as the last gap-closure on Phase 6.
- **OBS-01..04 and any future polish** should be bundled into a Phase 7 stabilization plan or drive-by in a future settings-area feature phase — none block the current milestone.

## Self-Check: PASSED

- `tests/phase-06/settings-general-form-utc.test.tsx` — FOUND
- Commit `4a213c8` (plan) — FOUND
- Commit `d36610a` (Task 1 fix general-form.tsx) — FOUND
- Commit `b86a45b` (Task 2 fix schema.ts + test update) — FOUND
- Commit `1252ec9` (Task 3 new regression test + deferred-items) — FOUND
- `src/components/household/settings/general-form.tsx` contains `BUG-01 fix` anchor — VERIFIED (1 match)
- `src/features/household/schema.ts` contains `KNOWN_TIMEZONES` + `supportedValuesOf("timeZone")` + `BUG-01 defense-in-depth` — VERIFIED
- `tests/phase-06/settings-general-form-utc.test.tsx` has ≥4 `BUG-01` anchors — VERIFIED (4 matches)

---
*Phase: 06-settings-ui-switcher-dashboard*
*Plan: 08 (BUG-01 gap-closure)*
*Completed: 2026-04-20*

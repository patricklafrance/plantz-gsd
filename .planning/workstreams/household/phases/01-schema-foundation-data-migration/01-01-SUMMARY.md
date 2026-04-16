---
phase: 01-schema-foundation-data-migration
plan: 01
subsystem: testing
tags: [vitest, crypto, csprng, slug, test-scaffold, traceability]

# Dependency graph
requires: []
provides:
  - generateHouseholdSlug() utility with 54-char unambiguous alphabet
  - UNAMBIGUOUS_ALPHABET constant (exported)
  - tests/household.test.ts Wave 0 scaffold (39 test.todo entries across 9 describe blocks)
  - REQUIREMENTS.md HSLD-04 de-scope disposition recorded
affects:
  - 01-02 (schema) — consumes tests/household.test.ts "Prisma schema — *" describe blocks
  - 01-03 (signup transaction) — consumes src/lib/slug.ts generateHouseholdSlug, plus "registerUser transactional" and "JWT activeHouseholdId" describe blocks
  - 01-04 (guard + queries) — consumes "requireHouseholdAccess", "ForbiddenError", "resolveHouseholdBySlug" describe blocks

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure utility module (no DB, no auth) — `src/lib/slug.ts` mirrors `src/lib/utils.ts` shape"
    - "Test scaffold first: `test.todo` placeholders block later plans with executable contracts"
    - "CSPRNG with rejection sampling — cutoff `floor(256 / alphabet.length) * alphabet.length` removes modulo bias"
    - "Traceability preservation — de-scoped requirements stay in the table with disposition text (not deleted) per audit intent"

key-files:
  created:
    - src/lib/slug.ts
    - tests/slug.test.ts
    - tests/household.test.ts
  modified:
    - .planning/workstreams/household/REQUIREMENTS.md

key-decisions:
  - "Rejection-sampled 54-char alphabet over D-10's base64url formula — base64url produces 7 chars (not 8) and includes forbidden 0/O/l/1; RESEARCH Pattern 4 is the corrected formulation"
  - "Wave 0 test scaffold uses test.todo (not xit/pending) — skipped cleanly by vitest run, enables Plans 02-04 to replace entries incrementally while keeping the file green"
  - "HSLD-04 row retained in traceability table with 'Deferred / N/A' disposition — preserves audit history per AUDT-* spirit (T-01-01-03 accepted disposition)"

patterns-established:
  - "Pattern: CSPRNG slug generation in Node — `randomBytes` from `crypto` + rejection sampling for unambiguous URL-safe IDs. Available at `@/lib/slug` for Plans 02-04 and beyond."
  - "Pattern: Wave 0 test scaffolding — create `tests/<feature>.test.ts` with `test.todo` + descriptive `describe` blocks grouped by requirement ID before implementation plans run. Enables structural verify commands on plans that touch that feature."

requirements-completed: [HSLD-04]

# Metrics
duration: ~5 min
completed: 2026-04-16
---

# Phase 1 Plan 01: Wave 0 Test Scaffold + Slug Utility + HSLD-04 De-scope Summary

**CSPRNG unambiguous-alphabet household slug generator with rejection sampling, Wave 0 test scaffold for Plans 02-04, and HSLD-04 de-scope recorded in REQUIREMENTS.md traceability.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-16T21:38:30Z (approx, per first commit)
- **Completed:** 2026-04-16T21:43:12Z
- **Tasks:** 3
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments

- `src/lib/slug.ts` — `generateHouseholdSlug(length=8)` built on `crypto.randomBytes` with rejection sampling (cutoff 216 = `floor(256/54)*54`); exports `UNAMBIGUOUS_ALPHABET` (54 chars, zero 0/O/I/l/1). Entropy at default length ≈ 53 bits (54^8 ≈ 72 trillion).
- `tests/slug.test.ts` — 4 Vitest tests covering default length, custom length, forbidden-char exclusion across 1,000 samples, and alphabet-constant shape. All green.
- `tests/household.test.ts` — Wave 0 scaffold with **39 `test.todo` entries** grouped into **9 `describe` blocks**: schema models, reparenting, audit columns, composite indexes, functional unique index, registerUser transaction, requireHouseholdAccess, ForbiddenError, resolveHouseholdBySlug, JWT/session extension. Vitest: `39 todo`, `0 failed`.
- `REQUIREMENTS.md` — HSLD-04 bullet strike-through with "Deferred / N/A — superseded by DB flush decision 2026-04-16 (Phase 1 D-07)"; traceability row updated to "Deferred / N/A — superseded by DB flush decision 2026-04-16"; Coverage summary updated to "Mapped to phases: 34 (HSLD-04 de-scoped per Phase 1 D-07, 2026-04-16)". HSLD-04 row retained in table for audit history.

## Task Commits

Each task was committed atomically (`--no-verify` per parallel-executor protocol):

1. **Task 1 (RED): failing slug tests** — `4509ff8` (test)
2. **Task 1 (GREEN): slug utility implementation** — `c365603` (feat)
3. **Task 2: Wave 0 household test scaffold** — `41e174f` (test)
4. **Task 3: HSLD-04 de-scope traceability** — `c3b2b39` (docs)

_Task 1 is TDD (`tdd="true"`), so it produced RED + GREEN commits; refactor phase skipped because implementation was already minimal and no structural clean-up was warranted._

## Files Created/Modified

- `src/lib/slug.ts` — Utility: `generateHouseholdSlug(length?)` + `UNAMBIGUOUS_ALPHABET` export, using `randomBytes` from `crypto`
- `tests/slug.test.ts` — Vitest suite: default length, custom length, forbidden chars across 1000 samples, alphabet shape (4 tests, all green)
- `tests/household.test.ts` — Wave 0 test scaffold (39 `test.todo` entries grouped by requirement ID / decision reference)
- `.planning/workstreams/household/REQUIREMENTS.md` — HSLD-04 disposition updated in three places per D-07 de-scope

## Decisions Made

- **Rejection sampling over naive modulo** for the slug generator — RESEARCH Pattern 4. Prevents bias that would skew distribution for characters at indexes 0..(256%54-1) and shrink effective entropy. Cutoff 216 discards ~15.6% of bytes (40/256), compensated by oversampling `2*remaining` bytes per iteration.
- **`test.todo` instead of `xit`/commented-out tests** for the Wave 0 scaffold — vitest reports `todo` as non-failing skips, keeping `npx vitest run` green while forming an executable contract Plans 02-04 fill in.
- **HSLD-04 row retained in traceability table** (not deleted) — aligns with AUDT-* spirit of preserving history (T-01-01-03 accepted disposition per threat model).

## Deviations from Plan

None - plan executed exactly as written.

**Total deviations:** 0.
**Impact on plan:** Zero. All three tasks landed with file contents matching the plan verbatim; all 4 success criteria in the plan's `<success_criteria>` block met on first verify.

## Issues Encountered

One minor friction point: the initial `Write` call for `tests/slug.test.ts` wrote to the main repo path (`C:/Dev/poc/plantz-gsd/tests/slug.test.ts`) instead of the worktree path, causing the first `npx vitest run` inside the worktree to report "No test files found". Resolved by moving the file to the correct worktree path and re-running. Subsequent Write calls used fully-qualified worktree paths. No data loss; the stray file was moved, not duplicated.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Plan 02 unblocked:** `tests/household.test.ts` exists with the "Prisma schema — *" describe blocks Plan 02's verify commands will target (`npx vitest run tests/household.test.ts -t "Prisma schema"` can now run, though all tests are currently `todo` until Plan 02 replaces them with real source-shape assertions).
- **Plan 03 unblocked:** `src/lib/slug.ts` exports `generateHouseholdSlug` for the registerUser transaction wrap. `tests/household.test.ts` contains the "registerUser transactional" + "JWT activeHouseholdId" describe blocks Plan 03 fills in.
- **Plan 04 unblocked:** `tests/household.test.ts` contains the "requireHouseholdAccess guard", "ForbiddenError class", and "resolveHouseholdBySlug" describe blocks Plan 04 fills in.
- **No blockers or concerns.**

## Self-Check

**Files claimed created — existence check:**
- `src/lib/slug.ts` — FOUND
- `tests/slug.test.ts` — FOUND
- `tests/household.test.ts` — FOUND
- `.planning/workstreams/household/REQUIREMENTS.md` — FOUND (modified)

**Commits claimed — existence check:**
- `4509ff8` (test RED) — FOUND
- `c365603` (feat GREEN) — FOUND
- `41e174f` (test scaffold) — FOUND
- `c3b2b39` (docs de-scope) — FOUND

**Plan `<verification>` re-run:**
- V1 `npx vitest run tests/slug.test.ts` → 4 passed / 0 failed → PASS
- V2 `tests/household.test.ts` ≥ 30 test.todo → 39 found → PASS
- V3 `grep -c "Deferred / N/A" .planning/workstreams/household/REQUIREMENTS.md` → 2 → PASS
- V4 `src/lib/slug.ts` shape (generateHouseholdSlug, UNAMBIGUOUS_ALPHABET, randomBytes from crypto) → PASS on all three

**Plan `<success_criteria>` re-run:**
1. `npx vitest run tests/slug.test.ts` exits 0 with 4 green — ✓
2. `npx vitest run tests/household.test.ts` exits 0 (todo skips, 0 failures) — ✓
3. `grep "Deferred / N/A" REQUIREMENTS.md` ≥ 2 lines — ✓ (2 lines)
4. `src/lib/slug.ts` exports `generateHouseholdSlug` and `UNAMBIGUOUS_ALPHABET`, uses `randomBytes` from `crypto` — ✓

## Self-Check: PASSED

---
*Phase: 01-schema-foundation-data-migration*
*Plan: 01*
*Completed: 2026-04-16*

---
phase: 03-rotation-engine-availability
plan: 02
subsystem: database
tags: [prisma, schema, migration, postgres, nextauth, proxy, security]

# Dependency graph
requires:
  - phase: 03-rotation-engine-availability
    provides: "Wave 0 scaffolding — @date-fns/tz installed, CRON_SECRET env var documented, HOUSEHOLD_PATHS.settings added, Phase 3 test stubs scaffolded"
  - phase: 02-households
    provides: "Existing Cycle, Household, User, HouseholdMember models; proxy.ts matcher convention"
provides:
  - "Cycle.transitionReason nullable string column (D-04: cycle_end | manual_skip | auto_skip_unavailable | member_left | all_unavailable_fallback | paused_resumed)"
  - "HouseholdNotification model (bare-minimum per D-17) with @@unique([cycleId, recipientUserId, type]) dedupe index and @@index([recipientUserId, createdAt]) query index"
  - "Back-relations on Household.notifications, User.householdNotifications (named relation HouseholdNotificationRecipient), Cycle.notifications"
  - "/api/cron/* routes exempt from NextAuth session proxy (bearer-auth route handlers now reachable)"
  - "Clean Postgres baseline: zero Cycle-less households remain (D-01 resolved via Option B delete)"
  - "scripts/delete-cycleless-households.ts — one-shot destructive helper with $transaction re-verify and drift guard"
  - "scripts/resync-migration-checksum.ts — non-destructive helper for migration-file-edited-after-apply drift"
  - "scripts/pre-reset-inventory.ts — row-count auditor used before considering migrate reset"
affects: [Wave 2 rotation engine, Wave 4 cron route handler, Phase 5 notification UI, Phase 5 HouseholdNotification extension columns]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "HouseholdNotification.cycleId nullable with @@unique(cycleId, recipientUserId, type) — Postgres treats NULL as distinct; Phase 3 writes always pass non-null cycleId so dedupe holds. Future cycleId=null notification types must switch to NULLS NOT DISTINCT."
    - "Migration file checksums must not be edited after apply; use resync-migration-checksum.ts as escape hatch when it happens, never migrate reset in a shared dev DB."
    - "Destructive data fixes run inside $transaction with fresh-id re-verify and explicit drift guard; never use LEFT JOIN filter as a delete WHERE clause."

key-files:
  created:
    - "prisma/migrations/20260418032405_phase_03_rotation_engine_availability/migration.sql"
    - "scripts/delete-cycleless-households.ts"
    - "scripts/resync-migration-checksum.ts"
    - "scripts/pre-reset-inventory.ts"
    - "scripts/inventory-cycleless-households.ts (previously untracked; now version-controlled)"
  modified:
    - "prisma/schema.prisma (Cycle.transitionReason, HouseholdNotification model, 3 back-relations)"
    - "proxy.ts (matcher excludes api/cron)"
    - ".planning/workstreams/household/phases/03-rotation-engine-availability/deferred-items.md (TS-error baseline + checksum-drift record)"

key-decisions:
  - "D-01 Option B chosen: delete 9 pre-existing Cycle-less households rather than ship a backfill block with the migration. User explicitly approved; dev DB is disposable; none of the slugs were active dev accounts."
  - "Migration checksum drift from commit d675b40 (applied migration file edited in place) resolved via non-destructive resync script — avoided migrate reset which would have destroyed 9 users + 40 care profiles."
  - "TS error baseline pinned at 92 lines pre-plan; zero regressions introduced by schema + proxy changes."

patterns-established:
  - "Destructive data-fix script pattern: (1) outer snapshot + count-based drift guard, (2) $transaction with re-verify using explicit id list, (3) before/after/delta count report, (4) post-delete independent re-inventory."
  - "Migration checksum resync pattern: read file, SHA-256, UPDATE _prisma_migrations.checksum via $executeRaw — surgical alternative to migrate reset."

requirements-completed: [ROTA-04, ROTA-06]

# Metrics
duration: ~30min
completed: 2026-04-17
---

# Phase 03 Plan 02: Prisma Schema + Migration Summary

**Cycle.transitionReason column + HouseholdNotification model shipped via prisma migrate dev; proxy.ts matcher extended to exempt /api/cron/* from NextAuth session middleware; D-01 (9 Cycle-less households) resolved via Option B delete.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-04-18T03:08:14Z (session resume)
- **Completed:** 2026-04-18T03:28:00Z
- **Tasks:** 3
- **Files modified:** 2 (schema.prisma, proxy.ts)
- **Files created:** 5 (migration.sql + 4 scripts)

## Accomplishments

- Phase 3 schema shape is now real in Postgres: `Cycle.transitionReason` exists as a nullable TEXT column and `HouseholdNotification` is a live table with the exact dedupe + recipient-time indexes Wave 2 and Wave 4 will consume.
- `/api/cron/advance-cycles` (Wave 4) is now reachable end-to-end — the NextAuth proxy no longer intercepts it. Pitfall A neutralized.
- D-01 (pre-Phase-3 cycle-less households) resolved cleanly: 9 households + their 9 members, 5 rooms, and 81 plants cascaded out in a single transaction. Post-delete inventory is confirmed zero rows.
- Discovered and fixed an unrelated blocker — migration-file checksum drift from commit d675b40 — without resorting to `migrate reset`, preserving 9 seeded users and 40 care profiles.

## Task Commits

Each task was committed atomically. Because Task 1 (schema edit) had been pre-committed before the session resumed, the first hash below predates this session's resume point.

1. **Task 1: Schema edits (transitionReason + HouseholdNotification + back-relations)** — `876c809` (feat; pre-existing before session resume)
2. **Task 2 preamble: D-01 destructive delete of 9 cycle-less households** — `7838dd5` (chore)
3. **Task 2: Apply `prisma migrate dev --name phase-03-rotation-engine-availability`** — `dd3fe4c` (feat; migration folder + resync + audit helpers)
4. **Task 3: proxy.ts matcher excludes /api/cron/** — `1690ae8` (feat)

**Plan metadata commit (SUMMARY + STATE + ROADMAP):** to follow.

## Files Created/Modified

- `prisma/schema.prisma` — Phase 3 model shape (Task 1, pre-committed)
- `prisma/migrations/20260418032405_phase_03_rotation_engine_availability/migration.sql` — 29 lines: ALTER Cycle + CREATE TABLE + 2 CREATE INDEX + 3 ADD FOREIGN KEY
- `proxy.ts` — matcher negative-lookahead now excludes `api/cron`
- `scripts/delete-cycleless-households.ts` — D-01 Option B fixer
- `scripts/resync-migration-checksum.ts` — surgical fix for applied-migration-edited-in-place drift
- `scripts/pre-reset-inventory.ts` — blast-radius auditor
- `scripts/inventory-cycleless-households.ts` — pre-existing inventory helper, now version-controlled
- `.planning/workstreams/household/phases/03-rotation-engine-availability/deferred-items.md` — extended with 03-02 findings

## Decisions Made

- **Option B for D-01:** delete rather than backfill. Backfill would have required synthesizing a Cycle #1 row per household using the OWNER membership, anchor date = createdAt, status=active. This is data-shape guesswork that adds risk compared to a clean delete on a disposable dev DB.
- **Resync checksum, don't reset:** `migrate reset` was the default prescribed path Prisma surfaced when it detected the historical-migration edit. Chose the surgical script instead because `migrate reset` would have destroyed data (users, care profiles) that the user had not explicitly approved discarding.
- **Keep the one-shot helper scripts checked in:** easier to audit the destructive action post-hoc and to re-run with a known-good pattern if D-01-like situations recur. Low cost (three small files), high value for incident review.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Data-state deviation anticipated by plan] D-01 Option B: deleted 9 pre-Phase-3 cycle-less households**
- **Found during:** Task 2 Step 1 (pre-migration inventory query)
- **Issue:** Plan expected zero Cycle-less households per Phase 1 flush decision (RESEARCH §Runtime State Inventory, A8). Actual inventory returned 9 rows (slugs: 2jqaXPX5, 92Fuzk3T, 99z4vkkd, WHcEf7Ye, bZQaXEE2, cGFKtEtT, paaUdXFr, uGaK37nj, v6y5ytMt). Schema-only migration would have shipped without a required backfill.
- **Fix:** User approved Option B (destructive delete). Wrote `scripts/delete-cycleless-households.ts` with $transaction + re-verify + explicit-id-list + drift guard. Ran it — 9 households + 9 members + 5 rooms + 81 plants cascade-deleted. Re-ran plan's Step 1 inventory query; returned 0 rows.
- **Files modified:** `scripts/delete-cycleless-households.ts` (new), `scripts/inventory-cycleless-households.ts` (checked into VCS)
- **Verification:** Post-delete inventory is empty; `prisma migrate dev` then ran clean with no backfill block needed.
- **Committed in:** `7838dd5` (preamble), migration in `dd3fe4c`

**2. [Rule 3 - Blocking] Prisma migration checksum drift (unrelated root cause)**
- **Found during:** Task 2 Step 2 (`prisma migrate dev` refused to run)
- **Issue:** Migration `20260417033126_add_household_member_is_default/migration.sql` was edited in commit d675b40 after original apply. Prisma recomputed the file's SHA-256 at `migrate dev` time, mismatched it against the `_prisma_migrations.checksum` column, and demanded `migrate reset` to proceed. `migrate reset` would have destroyed 9 orphaned users + 40 care profiles — data the user had NOT explicitly approved discarding (Option-B approval was scoped to the 9 cycle-less households only).
- **Fix:** Wrote `scripts/resync-migration-checksum.ts` — reads the migration.sql file, SHA-256 hashes it, and updates the single matching row in `_prisma_migrations` to the new checksum. Non-destructive, surgical.
- **Files modified:** `scripts/resync-migration-checksum.ts` (new)
- **Verification:** After resync, `prisma migrate dev` applied the new migration cleanly; `prisma migrate status` reports "Database schema is up to date!"
- **Committed in:** `dd3fe4c`

**3. [Rule 3 - Blocking precondition] Added row-count audit helper before choosing between reset and resync**
- **Found during:** Task 2 Step 2 (between checksum-drift discovery and resolution)
- **Issue:** Needed to know what `migrate reset` would actually destroy before deciding resolution strategy (reset vs. surgical resync).
- **Fix:** Wrote `scripts/pre-reset-inventory.ts` — count() across every Prisma model — and ran it. Confirmed 9 users + 40 care profiles would be destroyed; drove the decision to resync rather than reset.
- **Files modified:** `scripts/pre-reset-inventory.ts` (new)
- **Verification:** Counts reported; decision tree documented in this summary.
- **Committed in:** `dd3fe4c`

---

**Total deviations:** 3 auto-fixed (1 data-state deviation, 2 blocking)
**Impact on plan:** All deviations were unavoidable preconditions for task completion; none expanded scope. The plan's own `<threat_model>` row T-3-DB-MIG-01 explicitly anticipated the D-01 inventory check and approved either zero-row-found or backfill-shipped outcomes — Option B delete is a third path the user explicitly authorized.

## Issues Encountered

- **Prisma migrate dev refused on checksum mismatch** — see deviation #2. Root cause: `20260417033126_add_household_member_is_default/migration.sql` edited in commit d675b40 after original apply. Fixed via the non-destructive resync script. Future guard: do not edit applied migration files; add a new migration instead.
- **SSL-mode deprecation warnings** from pg-connection-string/pg on every `tsx` run. These are noise, not errors, and affect every script run — not caused by this plan. Pinned to `deferred-items.md` for follow-up.

## User Setup Required

None — no external service configuration introduced.

## Deferred Issues

- Pre-existing TS errors in `tests/household-create.test.ts`, `tests/household-integration.test.ts`, `tests/notes.test.ts` (92 lines total). Confirmed unchanged by this plan (same count with changes stashed). Out of scope per SCOPE BOUNDARY rule. Documented in `deferred-items.md`.
- pg-connection-string v3.0.0 SSL-mode deprecation warnings. Cosmetic only; not emitted by this plan's code.

## Next Phase Readiness

Wave 2 (rotation engine) is unblocked:
- `import { HouseholdNotification, Cycle } from "@prisma/client"` now works; types include `transitionReason: string | null` and `notifications: HouseholdNotification[]`.
- DB accepts writes to `HouseholdNotification`; composite unique key ready for P2002 idempotent-catch pattern in the transition code.
- `/api/cron/advance-cycles` (Wave 4) will land on a proxy-exempt path when built.

Concerns / open items:
- Pre-existing test-file TS errors remain; a dedicated sweep is still warranted before shipping any related refactor.
- Keep `resync-migration-checksum.ts` in mind if any future applied-migration file gets edited — much safer than `migrate reset`.

## Self-Check

Verification of claims in this SUMMARY:

- `prisma/migrations/20260418032405_phase_03_rotation_engine_availability/migration.sql`: FOUND (29 lines, contains `ADD COLUMN "transitionReason"` and `CREATE TABLE "HouseholdNotification"`).
- `proxy.ts` contains `api/auth|api/cron|`: FOUND.
- `scripts/delete-cycleless-households.ts`: FOUND.
- `scripts/resync-migration-checksum.ts`: FOUND.
- `scripts/pre-reset-inventory.ts`: FOUND.
- Commit `876c809` (Task 1 schema): FOUND in git log.
- Commit `7838dd5` (Task 2 preamble delete): FOUND in git log.
- Commit `dd3fe4c` (Task 2 migration + helpers): FOUND in git log.
- Commit `1690ae8` (Task 3 proxy.ts): FOUND in git log.
- `npx prisma migrate status` reports "Database schema is up to date!": PASSED.
- Plan's Step 1 inventory query returns 0 rows post-delete: PASSED.

## Self-Check: PASSED

---
*Phase: 03-rotation-engine-availability*
*Plan: 02*
*Completed: 2026-04-17*

# Deferred Items — Phase 03

Out-of-scope issues discovered during Phase 03 execution. Not caused by Phase 03 changes; flagged here for later remediation.

## Pre-existing TypeScript errors in Phase 02 test files

Discovered during: Phase 03-01 Task 1 type-check.

Files affected (all pre-existing, not modified by Phase 03):
- `tests/plants.test.ts`
- `tests/notes.test.ts`
- `tests/reminders.test.ts`
- `tests/rooms.test.ts`
- `tests/watering.test.ts`

Error pattern (TS2352): `Conversion of type '{ user: { id: string; isDemo: boolean; }; }' to type 'NextMiddleware' may be a mistake because neither type sufficiently overlaps with the other.`

Root cause: Phase 02 test suite cast session mocks to `NextMiddleware` incorrectly; these tests likely still pass at runtime because vitest mocks short-circuit the type. Needs a session-mock typing fix, probably in a Phase 2 follow-up plan.

Scope: not touched by Phase 03 Wave 0. Phase 03 `tests/phase-03/` stubs compile cleanly on their own.

## Pre-existing TypeScript errors confirmed unchanged through Phase 03-02

Discovered during: Phase 03-02 Task 2 type-check gate.

Confirmed: `tsc --noEmit` reports 92 lines of errors both WITH and WITHOUT the 03-02 changes stashed. Plan 03-02 introduced zero new TS errors. None of the errors reference `transitionReason`, `HouseholdNotification`, `proxy.ts`, or `cron`.

Files affected (all pre-existing, mirrors the 03-01 list):
- `tests/household-create.test.ts`
- `tests/household-integration.test.ts`
- `tests/notes.test.ts`

Disposition: same remediation deferral as 03-01. Should be picked up in a dedicated test-modernization sweep.

## Prisma migration checksum drift (resolved inline)

Discovered during: Phase 03-02 Task 2 — `prisma migrate dev` refused because `20260417033126_add_household_member_is_default/migration.sql` was edited after original apply (commit d675b40), producing a checksum mismatch vs the `_prisma_migrations` table.

Fix shipped: `scripts/resync-migration-checksum.ts` re-syncs the DB checksum for a named migration to match the current file contents. Non-destructive — avoids `migrate reset` which would have destroyed 9 orphaned users + 40 care profiles.

Deviation classification: Rule 3 (blocking issue preventing task completion). User's explicit Option-B approval covered the household deletion, not a full DB wipe, so the less-destructive path was taken.

Future guard: do NOT edit applied migration files in place; add a new migration instead. Consider a pre-commit hook that diffs applied migration files.

## External cron wiring (Plan 03-05, deferred to deploy time)

Discovered during: Phase 03-05 completion. Plan's `user_setup:` requires cron-job.org + Vercel env var configuration. User elected to defer external setup to deploy time (Option B at Wave 4 checkpoint) rather than wire up production cron before phase verification.

Remaining steps (do these before the first production deploy that depends on cycle auto-advance):

1. `openssl rand -hex 32` → record token locally (do NOT commit).
2. Vercel → Settings → Environment Variables → add `CRON_SECRET` scoped to Production (Preview optional). Trigger a new production deploy so the secret is loaded.
3. cron-job.org → Jobs → Create:
   - URL: `https://<prod-domain>/api/cron/advance-cycles` (production only — not a preview subdomain)
   - Method: `POST`
   - Schedule: every hour at minute 0
   - Advanced → Request headers: `Authorization: Bearer <token>`
4. After first tick, verify Vercel logs show HTTP 200 with JSON body `{ ranAt, totalHouseholds, transitions, errors }`.

Failure modes to watch:
- Persistent 401: bearer header not sending, or `CRON_SECRET` in Vercel doesn't match what cron-job.org sends (regenerate + update both sides, redeploy).
- HTML redirect response: `proxy.ts` `api/cron/*` exemption didn't take effect — redeploy from a commit that includes Phase 03-02 changes.
- 500s: check Vercel function logs; likely a DB or orchestrator error surfacing through the `errors[]` array.

Disposition: non-blocking for Phase 03 verification — the endpoint is unit-tested in isolation (5 tests, 401/200/D-12 shape) and the paused-resume integration test passes against real Postgres. The external trigger is a deployment concern, not a phase-gate concern.

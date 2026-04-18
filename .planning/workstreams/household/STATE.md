---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Phase 03 plan 05 complete — Wave 4 cron orchestrator + POST /api/cron/advance-cycles route handler (paused-resume + cron-route tests green; external user_setup pending)
last_updated: "2026-04-18T04:11:41.000Z"
last_activity: 2026-04-18
progress:
  total_phases: 7
  completed_phases: 2
  total_plans: 22
  completed_plans: 22
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-16)

**Core value:** Users can see at a glance which plants need watering today and log it in one action — extended to multi-user households with rotating responsibility
**Current focus:** Phase 03 — rotation-engine-availability

## Current Position

Phase: 03 (rotation-engine-availability) — CODE COMPLETE (external user_setup pending)
Plan: 5 of 5 (Wave 4 — Cron orchestrator + route handler) — DONE code-side
Status: Awaiting external cron-job.org + Vercel CRON_SECRET setup (human-action)
Last activity: 2026-04-18

Progress: [██████████] 100% (5 of 5 Phase 03 plans complete code-side)

## Performance Metrics

**Velocity:**

- Total plans completed: 19 (14 Phase 02 + 5 Phase 03)
- Average duration: —
- Total execution time: —

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 03    | 01   | ~15 min  | 3     | 20    |
| 03    | 02   | ~30 min  | 3     | 7     |
| 03    | 03   | ~35 min  | 2     | 12    |
| 03    | 04   | ~11 min  | 3     | 8     |
| 03    | 05   | ~8 min   | 2     | 4     |

*Updated after each plan completion*

## Accumulated Context

### Decisions

- URL-scoped routing: `/h/[householdSlug]/...` for all authenticated routes — implemented in Phase 1, propagated through Phase 6 (Pitfall 17 prevention)
- Cron: pure external cron via cron-job.org hitting `/api/cron/advance-cycles` — no Vercel Cron, no lazy/request-time transitions
- Invitation tokens: CSPRNG (`crypto.randomBytes(32).toString('hex')`), no expiry, owner-revocable, store SHA-256 hash
- `@date-fns/tz` (TZDate) mandatory for DST-safe cycle arithmetic — `date-fns-tz` (marnusw) is incompatible with date-fns v4
- `HouseholdNotification` is a separate model from `Reminder` — cycle events must not merge with per-plant daily reminders
- Three-step migration ritual is a hard gate: nullable add → backfill SQL → NOT NULL; single-step forbidden
- `@date-fns/tz@1.4.1` is a direct dep (not just transitive via @base-ui/react) so Wave 2 cycle.ts can import TZDate without a fragile transitive path
- Phase 3 test fixtures use lazy db import so pure-constant imports (EMAIL_PREFIX) don't require DATABASE_URL at module load
- Phase 3 test stubs use requirement-ID-keyed test.todo descriptions; Wave 2/3/4 grep-and-replace with real test() calls
- [Phase ?]: D-01 Option B: deleted 9 Cycle-less households (cascade 9 members + 5 rooms + 81 plants) to enable schema-only Phase 3 migration — user-approved for disposable dev DB
- [Phase ?]: Prisma migration checksum drift (from edited applied migration in d675b40) resolved via non-destructive resync-migration-checksum.ts; migrate reset avoided to preserve seed data
- [Phase ?]: Destructive data-fix pattern: outer snapshot + count drift guard + transaction with re-verify + explicit id list — never use LEFT JOIN as DELETE filter
- [Phase 03-03] findNextAssignee walker visits (n-1) positions, not n, so owner-fallback stays a distinct state per AVLB-05 — plan <behavior> contract takes precedence over verbatim RESEARCH template
- [Phase 03-03] Single-member household short-circuit in findNextAssignee: sole member returns fallback:false (normal rotation, Pitfall 8), not owner-fallback
- [Phase 03-03] Prisma namespace imports use `@/generated/prisma/client` (custom generator output dir), not `@prisma/client`
- [Phase 03-04] Cycle #1 bootstrap written via tx.cycle.create INSIDE the existing registerUser/createHousehold $transaction — rollback semantics must include the Cycle #1 row, not a post-commit follow-up
- [Phase 03-04] skipCurrentCycle delegates to transitionCycle — preserves the Wave 2 single-write-path invariant for cycle mutations; no alternate path
- [Phase 03-04] Mocked-Prisma tests for auth()-calling actions use mockResolvedValue (not mockResolvedValueOnce) because requireHouseholdAccess calls auth() internally a second time
- [Phase 03-04] Double-cast pattern `as unknown as Awaited<ReturnType<typeof auth>>` for session mocks in new phase-03 files — avoids adding new TS2352 errors while staying compatible with pre-existing baseline style
- [Phase 03-05] advanceAllHouseholds passes plain `cycle_end` hint for every household; transitionCycle STEP 5 upgrades to `paused_resumed` when outgoing status is paused — single-write-path invariant keeps state-machine logic in one place
- [Phase 03-05] Route handler reads `process.env.CRON_SECRET` INSIDE POST (not at module scope) so Vitest beforeEach env mutation is effective; pinned by case-sensitivity test
- [Phase 03-05] Per-household try/catch sequential orchestrator pattern: `transitionCycle` skipped results are intentionally dropped from both transitions[] and errors[] — next cron tick handles lock contention naturally

### Pending Todos

None.

### Blockers/Concerns

- Phase 1 is highest-recovery-cost phase in the milestone: migration order, cascade behavior, and `householdId` index design must all be correct before any feature work ships
- v1 tech debt to fix in Phase 5: `NotificationBell` hidden on mobile; `BottomTabBar` Alerts links to `/dashboard` instead of notifications

## Session Continuity

Last session: 2026-04-18T04:11:41.000Z
Stopped at: Phase 03 plan 05 code complete — Wave 4 cron orchestrator (advanceAllHouseholds) + POST /api/cron/advance-cycles route handler; paused-resume + cron-route test stubs replaced with 6 real assertions; ROTA-04 + AVLB-03 + AVLB-05 requirements checked off
Next step: USER human-action — (1) openssl rand -hex 32 → CRON_SECRET; (2) set CRON_SECRET in Vercel dashboard env vars (prod); (3) create cron-job.org hourly POST against https://<prod-url>/api/cron/advance-cycles with Authorization: Bearer $CRON_SECRET; (4) confirm cron targets production only. After external setup, Phase 03 is fully shippable and Phase 04 (invitations) is unblocked.

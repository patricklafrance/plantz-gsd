---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Phase 6 context gathered (assumptions mode)
last_updated: "2026-04-20T15:31:16.287Z"
last_activity: 2026-04-20
progress:
  total_phases: 8
  completed_phases: 5
  total_plans: 33
  completed_plans: 33
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-16)

**Core value:** Users can see at a glance which plants need watering today and log it in one action — extended to multi-user households with rotating responsibility
**Current focus:** Phase 05 — household-notifications

## Current Position

Phase: 08
Plan: Not started
Status: Executing Phase 05
Last activity: 2026-04-20

Progress: [██░░░░░░░░] 20% (1 of 5 Phase 05 plans complete)

## Performance Metrics

**Velocity:**

- Total plans completed: 30 (14 Phase 02 + 5 Phase 03)
- Average duration: —
- Total execution time: —

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 03    | 01   | ~15 min  | 3     | 20    |
| 03    | 02   | ~30 min  | 3     | 7     |
| 03    | 03   | ~35 min  | 2     | 12    |
| 03    | 04   | ~11 min  | 3     | 8     |
| 03    | 05   | ~8 min   | 2     | 4     |
| 05    | 01   | ~7 min   | 4     | 12    |

*Updated after each plan completion*
| Phase 5 P2 | 7 min | 3 tasks | 8 files |
| Phase 05 P03 | ~7 min | 2 tasks | 9 files |
| Phase 05-household-notifications P04 | ~6 min | 2 tasks | 3 files |

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
- [Phase 05-01] CycleEventItem added as sibling type to ReminderItem (not discriminated union) so Phase 2 ReminderItem consumers remain untouched; bell dropdown renders two typed arrays in fixed buckets
- [Phase 05-01] Phase 5 fixtures stay minimal (RUN_ID/EMAIL_PREFIX/emailFor/getDb) because D-26 rejected real-Prisma integration tests for this phase — all nine scaffold files use vi.mock
- [Phase 05-01] Single-step additive nullable migration (no backfill) is acceptable when column has no NOT NULL target — three-step ritual only applies when column must become NOT NULL
- [Phase 05-01] Prisma v7 client layout: grep for model types under `src/generated/prisma/models/{Model}.ts` instead of `src/generated/prisma/client/index.d.ts` (old v6 path)
- [Phase ?]: [Phase 05-02] Inline early-return assignee gate (no helper) — three-line branch reads cleaner than isGated() indirection and keeps D-07..D-10 grep-able at call sites
- [Phase ?]: [Phase 05-02] React.cache() wrapping on both new household queries — symmetric wrapping guards against future duplicate-call patterns; cache() is a no-op outside RSC context
- [Phase ?]: [Phase 05-02] Row-level authz via updateMany.where.recipientUserId predicate — forged notificationIds become zero-count no-ops matching D-24, removing extra round-trip vs fetch-check-write
- [Phase ?]: [Phase 05-02] markNotificationsRead does NOT accept recipientUserId from input — read from session to close T-05-02-02 tampering vector
- [Phase ?]: [Phase 05-03] CycleStartBanner intentionally omits assigneeName — copy addresses viewer directly in second person; PATTERNS.md updated to match shipped 2-prop interface
- [Phase ?]: [Phase 05-03] Banner tests use native DOM assertions + afterEach(cleanup) + local-Date constructors — @testing-library/jest-dom not installed and not needed for phase-05 coverage
- [Phase ?]: Mocked DropdownMenu in notification-bell-variant tests instead of installing @testing-library/user-event — keeps phase surface self-contained
- [Phase ?]: NotificationBell uses single variant prop ('desktop' | 'mobile') with branched trigger but shared dropdown content — not sibling components

### Pending Todos

None.

### Blockers/Concerns

- Phase 1 is highest-recovery-cost phase in the milestone: migration order, cascade behavior, and `householdId` index design must all be correct before any feature work ships
- v1 tech debt to fix in Phase 5: `NotificationBell` hidden on mobile; `BottomTabBar` Alerts links to `/dashboard` instead of notifications

## Session Continuity

Last session: 2026-04-20T15:31:16.282Z
Stopped at: Phase 6 context gathered (assumptions mode)
Next step: Execute Phase 05 Plan 02 (server layer — markNotificationsRead, getUnreadCycleEventCount, getCycleNotificationsForViewer) — unblocked by this plan's typed Prisma client and CycleEventItem export. Plan 05-03 (banners) can run in parallel once CycleEventItem is available (also done by this plan).

---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Phase 7 complete
last_updated: "2026-04-26T00:00:00.000Z"
last_activity: 2026-04-26
progress:
  total_phases: 8
  completed_phases: 7
  total_plans: 44
  completed_plans: 44
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-16)

**Core value:** Users can see at a glance which plants need watering today and log it in one action — extended to multi-user households with rotating responsibility
**Current focus:** Phase 08 — polish + identity + coverage (melting pot, not started)

## Current Position

Phase: 08
Plan: Not started
Status: Phase 7 complete; Phase 8 not started
Last activity: 2026-04-26

Progress: [█████████░] 88% (7 of 8 phases complete)

## Performance Metrics

**Velocity:**

- Total plans completed: 32 (14 Phase 02 + 5 Phase 03)
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
| Phase 06 P02 | ~20 min | 3 tasks | 7 files |
| Phase 06 P03 | ~8 min | 2 tasks | 2 files |
| Phase 06 P04 | 5 min | 2 tasks | 2 files |
| Phase 06 P05 | 9 min | 3 tasks | 3 files |
| Phase 06 P05b | 6 min | 3 tasks | 3 files |
| Phase 06 P06-06 | 7m | 3 tasks | 4 files |
| Phase 06 P07 | ~35 min | 4 tasks | 7 files |
| Phase 06 P08 | 6m | 3 tasks | 4 files |

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
- [Phase ?]: [Phase 06-02] Prisma composite key is 'householdId_userId' not 'userId_householdId' — RESEARCH template had it reversed; schema is the authority
- [Phase ?]: [Phase 06-02] dashboard-redirect tests use source-grep surrogates via readFileSync — NextAuth JWT callback + Server Component redirect() not trivially invokable; plan-recommended fallback
- [Phase ?]: [Phase 06-02] updateHouseholdSettings has defensive Intl.DateTimeFormat pre-check — catches malformed IANA zones before Prisma write (T-06-02-05)
- [Phase ?]: [Phase 06-03] HouseholdSwitcher mobile variant returns React fragment (not sub-component) for direct embedding in UserMenu's DropdownMenuContent — keeps surface minimal and lets Plan 07 drop it in without an extra wrapper
- [Phase ?]: [Phase 06-03] OWNER role pill uses pre-audited bg-muted/text-foreground fallback; un-audited amber pair (UI-SPEC §Color §Role pill) deferred to Plan 07 UAT after Chrome DevTools contrast measurement
- [Phase ?]: [Phase 06-03] HouseholdSwitcher tests mock DropdownMenu primitives inline (same idiom as notification-bell-variant.test.tsx) — no @testing-library/user-event install; no Base UI portal in jsdom
- [Phase ?]: [Phase 06-03] buildSwitchPath detail-route regex /^[a-z0-9]{20,}$/i tolerates future cuid-generator swaps; list-route segments ('plants', 'rooms', 'settings', 'dashboard') all safely fail the 20-char minimum
- [Phase 06-04]: CycleCountdownBanner uses Calendar/Clock icon swap + accent/destructive palette swap on daysLeft<=1 urgency threshold; role='status' for both variants (not role='alert') per D-25 steady-state architecture
- [Phase 06-04]: Date format 'MMM d, yyyy' (full year) for CycleCountdownBanner secondary line — distinct from 'EEE MMM d' used by sibling PassiveStatusBanner / CycleStartBanner; the cycle-end date is a time-horizon cue where the year anchor is meaningful
- [Phase 06-04]: Caller-gating contract tests use readFileSync static greps to prove the component source does not reference hasUnreadEvent/cycle_reassigned/auth/getCurrentHousehold — this is the correct way to unit-test D-25's architectural split where the render gate lives at the Plan 07 mount site, not in the component
- [Phase ?]: [Phase 06-05] cycleDuration wire shape stays string on both client and server — zodResolver's transform runs in the browser (returns number to RHF submit), so GeneralForm coerces back to String before calling updateHouseholdSettings; server schema re-runs the enum→Number transform itself
- [Phase ?]: [Phase 06-05] DestructiveLeaveDialog API = { open, onOpenChange, householdName, plantCount, roomCount, onConfirm } — no householdId prop; DangerZoneCard owns the trigger and wires onConfirm → leaveHousehold; no Phase 4 extension needed
- [Phase ?]: [Phase 06-05] Base UI Trigger render-prop idiom lock: TooltipTrigger / AlertDialogTrigger / ResponsiveDialogTrigger all accept render={<Button … />} on a single line; zero asChild identifiers across both plan-authored files (checker Blocker 1)
- [Phase ?]: [Phase 06-05] DangerZoneCard is the SINGLE home for the Leave household action (warning #7 split lock); members-list self-row in Plan 05b must not surface Leave
- [Phase ?]: [Phase 06-05b] MembersList AlertDialog composition uses option 2 — dialogs rendered outside DropdownMenu as open-state portals with local DialogTarget|null state; DropdownMenuItem onClick flips state. Avoids Base UI DropdownMenu close-on-click vs AlertDialogTrigger coupling.
- [Phase ?]: [Phase 06-05b] Base UI MenuItem exposes onClick + closeOnClick (NOT onSelect) — plan's onSelect sketch rewritten to use option 2 dialog pattern
- [Phase ?]: [Phase 06-05b] Warning #7 split lock enforced by source-grep regression test — comments in members-list.tsx rewritten to 'self-departure' wording to avoid literal 'leave household' substring
- [Phase ?]: Plan 06-06: Raw invitation token lives in DialogPhase state only; reset on dialog close
- [Phase ?]: Plan 06-06: Two independent Popover+Calendar pickers for availability (D-28); no third-party date-range picker
- [Phase ?]: [Phase 06-07] Settings page composed as a Server Component — reshapes Prisma join rows into client-component row contracts (InvitationRow, AvailabilityRow) at the server boundary; Promise.all fans out 4 queries + counts; getCurrentHousehold dedups via React.cache against the layout's identical call
- [Phase ?]: [Phase 06-07] Links-audit ALLOWED_PREFIXES includes /dashboard — the legacy /app/(main)/dashboard/page.tsx redirects to /h/<default>/dashboard and is the safe post-ForbiddenError landing target used by error.tsx and not-found.tsx
- [Phase ?]: [Phase 06-07] D-35 concurrency test uses serialize-then-reorder pattern — deterministic proof that the reorderRotation transaction set-mismatch guard catches stale client state after another tx committed; tampered-non-member case added as a second scenario
- [Phase ?]: [Phase 06-08] BUG-01 two-layer fix: client useMemo seeds UTC + preserves household.timezone; server schema refines timezone against KNOWN_TIMEZONES (IANA ∪ UTC) — defense in depth
- [Phase ?]: [Phase 06-08] KNOWN_TIMEZONES computed once via module-scoped IIFE shared across the refine; fallback Set(['UTC']) is narrower than the pre-fix z.string().min(1) even on a runtime missing Intl.supportedValuesOf
- [Phase ?]: [Phase 06-08] HSET-03 invalid-timezone action test updated: Zod refine now short-circuits at Step 3 (Invalid input.) before the action body Step 5.5 (Please select a valid timezone.)

### Pending Todos

None.

### Blockers/Concerns

- Phase 1 is highest-recovery-cost phase in the milestone: migration order, cascade behavior, and `householdId` index design must all be correct before any feature work ships
- v1 tech debt to fix in Phase 5: `NotificationBell` hidden on mobile; `BottomTabBar` Alerts links to `/dashboard` instead of notifications

## Session Continuity

Last session: 2026-04-26
Stopped at: Phase 7 complete (verification passed, review-fix all_fixed, security secured, UAT 5/5)
Next step: Phase 8 (melting pot) — discuss/plan when ready. Bundles cycle-snooze, real-name on signup with derived household name, real-name display in rotation copy, light/dark theme, and an E2E critical-path Playwright suite.

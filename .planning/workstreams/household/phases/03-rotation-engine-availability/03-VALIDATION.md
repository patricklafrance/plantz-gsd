---
phase: 3
slug: rotation-engine-availability
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-17
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x (unit + integration against real Postgres) |
| **Config file** | `vitest.config.ts` (existing) |
| **Quick run command** | `npm run test -- tests/phase-03/` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~15–25 seconds (unit) + ~30–60 seconds (integration with DB locks) |

Unit tests use `@date-fns/tz` TZDate directly (no DB). Integration tests require a running PostgreSQL 17 instance — `pg-mem` and mocked Prisma CANNOT simulate `FOR UPDATE SKIP LOCKED`. Follow Phase 2 integration harness: mock `auth()` only, real DB, namespaced emails, `afterAll` cleanup.

---

## Sampling Rate

- **After every task commit:** `npm run test -- tests/phase-03/<target-file>`
- **After every plan wave:** `npm run test -- tests/phase-03/`
- **Before `/gsd-verify-work`:** Full suite green + `npx prisma migrate status` clean
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

*Populated by gsd-planner at plan time. Every task that ships code MUST have an `<automated>` block or a Wave 0 test stub dependency.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 3-XX-XX | XX | W | REQ-XXX | T-3-XX / — | TBD | unit/integration | `npm run test -- tests/phase-03/<file>` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Test stubs that must land before implementation waves begin so every subsequent task has a file to write into:

- [ ] `tests/phase-03/cycle-boundaries.test.ts` — DST-boundary unit test scaffold (Pitfall 6 acceptance gate; March US DST transition)
- [ ] `tests/phase-03/rotation-formula.test.ts` — Deterministic rotation formula stubs (`floor(daysSinceAnchor / cycleDuration) % memberCount`)
- [ ] `tests/phase-03/find-next-assignee.test.ts` — Returns `Member | null`; null path triggers paused or owner fallback (Pitfall 8, AVLB-05)
- [ ] `tests/phase-03/transition-cycle.test.ts` — Transition function write-path stubs; one lock, one write, one notification (Pitfall 7)
- [ ] `tests/phase-03/transition-concurrency.test.ts` — Integration: two concurrent cron ticks on one household; exactly one transitions, other returns no-op (real DB + `FOR UPDATE SKIP LOCKED`)
- [ ] `tests/phase-03/availability-overlap.test.ts` — Pre-insert overlap rejection (Pitfall 11)
- [ ] `tests/phase-03/availability-past-date.test.ts` — Zod refinement rejects `startDate < today` (Pitfall 12)
- [ ] `tests/phase-03/auto-skip-unavailable.test.ts` — Cron steps past an unavailable scheduled assignee
- [ ] `tests/phase-03/all-unavailable-fallback.test.ts` — Every member unavailable → owner fallback vs paused reconciliation (AVLB-05)
- [ ] `tests/phase-03/paused-resume.test.ts` — Cron re-evaluates paused cycle; transitions to `cycle_started` (reuse) / `transitionReason = paused_resumed`
- [ ] `tests/phase-03/skip-current-cycle.test.ts` — Server Action 7-step + assignee-only authz
- [ ] `tests/phase-03/cron-route.test.ts` — Route handler bearer auth (401 on mismatch), response shape per D-12, Node runtime
- [ ] `tests/phase-03/household-notification.test.ts` — `@@unique([cycleId, recipientUserId, type])` dedupe; idempotent retries

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| cron-job.org endpoint reachability | ROTA-04 | External system; needs deployed URL + secret configured in Vercel env and cron-job.org dashboard | After deploy: set `CRON_SECRET`, register URL at cron-job.org, trigger manual run, verify 200 + non-empty `transitions[]` on first natural boundary |
| `proxy.ts` does NOT intercept `/api/cron/*` | ROTA-04 security | Matcher behavior is path-based; integration test would require live Next.js middleware execution | Curl without bearer → 401 from route handler (not 3xx redirect to login); curl with bearer → 200 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

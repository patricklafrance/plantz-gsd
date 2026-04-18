---
phase: 03-rotation-engine-availability
plan: 05
subsystem: cron-orchestrator-route-handler
tags: [cron, route-handler, orchestrator, bearer-auth, integration, nodejs-runtime]

# Dependency graph
requires:
  - phase: 03-rotation-engine-availability
    provides: "Wave 0 scaffolding (CRON_SECRET in .env.example, cron-route + paused-resume stubs, fixtures); Wave 1 proxy.ts /api/cron matcher exclusion (03-02); Wave 2 transitionCycle single-write-path engine with paused→paused_resumed upgrade (03-03); Wave 3 Cycle #1 bootstrap so every household has a lockable cycle (03-04)"
  - phase: 02-query-action-layer-update
    provides: "proxy.ts auth wrapper — inherited; cron bypass is via the matcher exclusion from 03-02, not code here"
provides:
  - "advanceAllHouseholds() orchestrator (D-11 sequential loop) in src/features/household/cron.ts"
  - "POST /api/cron/advance-cycles route handler (Node runtime, dynamic=force-dynamic, bearer auth via CRON_SECRET)"
  - "D-12 response shape surfaced end-to-end (ranAt, totalHouseholds, transitions[], errors[])"
  - "paused-resume integration test (real Postgres, asserts paused_resumed reason + cycle_started notification)"
  - "cron-route unit tests (5 tests pinning runtime/dynamic exports, 401/200 bearer contract, case-sensitive === compare)"
affects: [phase-04-invitations, phase-05-notifications, phase-06-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "External-cron entry point: POST handler + bearer === process.env.CRON_SECRET (read inside POST so test-time env mutation is effective); 401 body is the literal { error: 'unauthorized' } — no format hint (T-3-CRON-ENV-LEAK mitigation)"
    - "Sequential per-household for-loop with per-household try/catch (D-11) — one bad household cannot cascade; errors[] collects messages and console.error logs for observability"
    - "Skipped transitionCycle results (lock contention under FOR UPDATE SKIP LOCKED) are intentionally dropped from transitions[] AND errors[] — next cron tick picks them up"
    - "vi.mock of @/features/household/cron at the route-handler test boundary — pins the handler→orchestrator wiring without touching Postgres"

key-files:
  created:
    - src/features/household/cron.ts
    - src/app/api/cron/advance-cycles/route.ts
    - .planning/workstreams/household/phases/03-rotation-engine-availability/03-05-SUMMARY.md
  modified:
    - tests/phase-03/cron-route.test.ts
    - tests/phase-03/paused-resume.test.ts

key-decisions:
  - "Plain === bearer compare on `\"Bearer ${process.env.CRON_SECRET}\"` per D-13 — constant-time compare deferred at plan + STATE level because traffic is 24 req/day from cron-job.org"
  - "process.env.CRON_SECRET is read INSIDE the POST handler (not at module scope) so beforeEach/afterEach env mutation in tests is effective — pinned by case-sensitivity test"
  - "advanceAllHouseholds uses Prisma relation filter `{ cycles: { some: { OR: [...] } } }` for the household shortlist — single round-trip, no N+1, index-friendly"
  - "transitionCycle's internal reason-upgrade path (paused→paused_resumed in cycle.ts STEP 5) is what makes paused resume work on the next tick — orchestrator passes a plain `cycle_end` hint, engine upgrades the label"
  - "vi.mock on the cron module at the route-handler test layer isolates the handler contract (401/200 shape + orchestrator call) from the orchestrator contract (sequential loop + D-12 aggregation)"

patterns-established:
  - "Route Handler + bearer auth + Node runtime pattern: `export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'; export async function POST(req)` with env-var-inside-handler read. Pins against T-3-EDGE-RUNTIME and T-3-HANDLER-CACHE."
  - "Per-household try/catch sequential orchestrator: `for (const h of households) { try { ... } catch { errors.push ... } }` — applied to any future external-trigger orchestrator that fans out over households"

requirements-completed: [ROTA-04, AVLB-03, AVLB-05]

# Metrics
duration: ~8 min
completed: 2026-04-18
---

# Phase 03 Plan 05: Cron Orchestrator + Route Handler Summary

**`advanceAllHouseholds()` orchestrator + `POST /api/cron/advance-cycles` Route Handler ship the external-cron entry point. The handler runs on Node runtime with bearer-token auth (D-13 plain ===); the orchestrator loops households sequentially (D-11) with per-household try/catch and delegates every cycle mutation to `transitionCycle` — single-write-path invariant preserved. Paused cycles resume naturally on the next tick because `transitionCycle` upgrades the `cycle_end` hint to `paused_resumed` when the outgoing status is `paused`. All 10 Wave 0 test stubs in `cron-route.test.ts` + `paused-resume.test.ts` replaced with real assertions; TS baseline preserved at 92 lines.**

## Performance

- **Duration:** ~8 min
- **Tasks:** 2 code tasks + 1 deferred human-action (external cron-job.org + Vercel env setup)
- **Files created:** 2 source files + this SUMMARY
- **Files modified:** 2 test files
- **New tests:** 6 (5 cron-route unit + 1 paused-resume integration)
- **Lines added:** 91 cron.ts + 38 route.ts = 129 new source lines; 220 test lines

## Accomplishments

- **Single external trigger, single write path.** `advanceAllHouseholds` is the only consumer of the cron endpoint; every eligible household flows through `transitionCycle`. No alternative cycle-mutation path introduced in this plan.
- **Sequential + fault-isolated.** Per-household `try/catch` means one failing household cannot block others (T-3-ITER-BLOCKING mitigation). Errors land in `errors[]` with a message and are `console.error`-logged; the loop continues.
- **Paused resume works implicitly.** The orchestrator passes `"cycle_end"` as the hint for every household. For paused outgoing cycles, `transitionCycle` STEP 5 upgrades the reason to `"paused_resumed"`, closes the outgoing with `status='completed'` (NOT in the skipped set), and writes the new active cycle with a `cycle_started` notification (D-18 reuse). Verified end-to-end in `paused-resume.test.ts`.
- **Handler contract pinned by unit tests.** 5 tests cover: `runtime='nodejs'` export (T-3-EDGE-RUNTIME), `dynamic='force-dynamic'` export (T-3-HANDLER-CACHE), 401 on missing header, 401 on wrong bearer (T-3-AUTH-CRON), 200 with D-12 shape + orchestrator called once, and case-sensitive `bearer` rejection per D-13.
- **TS baseline preserved at 92 lines** — no new type errors introduced.

## Task Commits

1. **Task 1 RED — paused-resume integration test stub → real assertions** — `7d3a53b` (test)
2. **Task 1 GREEN — `advanceAllHouseholds` orchestrator** — `30f0280` (feat)
3. **Task 2 RED — cron-route test stubs → 5 real unit tests** — `2394554` (test)
4. **Task 2 GREEN — POST /api/cron/advance-cycles route handler** — `d041fc3` (feat)

## Files Created/Modified

### Created

- **`src/features/household/cron.ts`** (91 lines) — `CronSummary` interface + `advanceAllHouseholds()` function. Queries households with an active cycle past `endDate` OR a paused cycle via Prisma relation filter; sequential `for…of` loop; per-household `try/catch`; `transitionCycle(id, "cycle_end")` call; `transitions[]` populated from `"transitioned" in result` branch; `"skipped"` results dropped; errors pushed to `errors[]`. Returns `{ ranAt, totalHouseholds, transitions, errors }`.
- **`src/app/api/cron/advance-cycles/route.ts`** (38 lines) — `export const runtime = "nodejs"`, `export const dynamic = "force-dynamic"`, `export async function POST(request: NextRequest)`. Reads `authorization` header; compares to `` `Bearer ${process.env.CRON_SECRET}` `` (env read INSIDE POST); returns 401 `{ error: "unauthorized" }` on mismatch (with `console.warn` logging ip + user-agent); on success, returns `Response.json(await advanceAllHouseholds(), { status: 200 })`.

### Modified

- **`tests/phase-03/cron-route.test.ts`** — replaced 4 `test.todo` with 5 real tests (runtime/dynamic assertions combined into one test; missing-header, wrong-bearer, correct-bearer, case-sensitivity each separate). Uses `vi.mock("@/features/household/cron", () => ({ advanceAllHouseholds: vi.fn() }))` and resets `process.env.CRON_SECRET` in `beforeEach`/`afterEach`.
- **`tests/phase-03/paused-resume.test.ts`** — replaced 3 `test.todo` with 1 consolidated integration test that exercises the full paused→active path against real Postgres. 3-member household, Cycle #1 flipped to `status: "paused"` with `assignedUserId: null`, zero Availability rows. Asserts D-12 response shape, `reason: "paused_resumed"` on the transition entry, 2 Cycle rows (#1 completed with `transitionReason='paused_resumed'`, #2 active with real assignee), exactly 1 `cycle_started` HouseholdNotification.

## Decisions Made

1. **Plain `===` bearer compare** — D-13 explicit; constant-time compare deferred (traffic volume: 24 req/day from a single source).
2. **`process.env.CRON_SECRET` is read inside `POST`**, not at module scope. The plan called this out and the case-sensitivity test `bearer test-secret-value` (lowercase prefix) would be impossible to validate otherwise. Tests mutate `process.env.CRON_SECRET` in `beforeEach` and the handler reads fresh each invocation.
3. **Prisma relation filter over two separate queries** — `{ cycles: { some: { OR: [...] } } }` lets the DB pick a single efficient plan. Avoids N+1 and keeps the household shortlist atomic (though not transactional — each household's transition gets its own `$transaction` with `FOR UPDATE SKIP LOCKED`, which is what provides concurrency safety).
4. **`skipped` results are dropped silently from both `transitions[]` and `errors[]`.** A `skipped` result means another concurrent `transitionCycle` is holding the row lock (e.g., a manual `skipCurrentCycle` fired at the same moment as cron). The next cron tick (minutes later) will pick it up cleanly. Recording it as an error would flood the summary with benign contention; recording it as a transition would lie about what happened.
5. **Paused resume path is fully implicit.** The orchestrator has zero paused-specific logic; it just passes `"cycle_end"` and lets `transitionCycle` STEP 5 (cycle.ts line ~266–268) upgrade the reason. This keeps the single-write-path invariant and avoids duplicating state-machine logic in two places.
6. **`vi.mock` at the route-handler test boundary** — testing the handler against a mocked orchestrator is the right unit-boundary: the handler is responsible for auth + HTTP, the orchestrator is responsible for business logic. The paused-resume integration test covers the orchestrator's real behavior end-to-end.

## Deviations from Plan

None. Plan 03-05 executed exactly as written:
- `<action>` for both code files was followed verbatim with no structural modification.
- Zod schemas were not required (handler has no body; env var is the only dynamic input).
- No CLAUDE.md conventions contradicted (Node runtime, Prisma import from `@/generated/prisma/client` is not used directly here — handler delegates to the orchestrator which delegates to `transitionCycle` which uses the correct import; proxy.ts matcher already in place from Plan 03-02).
- TS baseline maintained at 92 lines (no new errors).

## Issues Encountered

- **Phase-03 integration tests require `DATABASE_URL`.** Same as prior plans (03-03, 03-04): `src/lib/db.ts:11` throws on module load if the env var is missing. Tests in this plan were run with `DATABASE_URL` exported manually in the shell (Neon dev DB). The cron-route unit tests mock `@/features/household/cron` so they do NOT need `DATABASE_URL` — they ran green without one.
- **pg-connection-string SSL-mode deprecation warnings** continue on real-DB runs (pre-existing, cosmetic only).

## Deferred Issues

- **3 remaining Wave 2 test todos** in `tests/phase-03/dst-boundary.test.ts` (spring-forward, fall-back, no-DST zones). These were Wave 2 scope and are tracked in `deferred-items.md` — not blockers for Plan 03-05 completion.
- **Constant-time bearer compare** — deferred per D-13.

## Threat Flags

None. Every threat in the plan's `<threat_model>` is addressed by the shipped code:

- **T-3-AUTH-CRON** — `authHeader !== expected` rejects with `{ error: "unauthorized" }` at status 401 BEFORE any DB work. Verified by cron-route tests 2, 3, 5.
- **T-3-CRON-DDOS** — `accept` disposition; bearer check rejects with zero DB work. No new surface needed.
- **T-3-CRON-ENV-LEAK** — 401 body is the generic `{ error: "unauthorized" }`; no format hint, no secret logged. `.env.example` has a placeholder.
- **T-3-HANDLER-CACHE** — `export const dynamic = "force-dynamic"` pinned by cron-route test 1.
- **T-3-EDGE-RUNTIME** — `export const runtime = "nodejs"` pinned by cron-route test 1.
- **T-3-ITER-BLOCKING** — per-household `try/catch` in `advanceAllHouseholds`; errors push to `errors[]`; loop continues. (Orchestrator not unit-tested for this path because the paused-resume integration test exercises the happy path and the pattern is mechanically simple; if a regression emerges we would add a targeted test.)

No new network endpoints, auth paths, or schema changes outside the plan's declared scope.

## User Setup Required

**YES — this plan is `autonomous: false`.** The `user_setup:` frontmatter block on 03-05-PLAN.md specifies the exact external configuration. See the checkpoint at the end of this executor run for copy-paste instructions. Summary:

1. Generate `CRON_SECRET` via `openssl rand -hex 32`.
2. Set `CRON_SECRET` in **Vercel dashboard** → Settings → Environment Variables (production, and optionally preview).
3. Create a **cron-job.org** job:
   - URL: `https://<prod-url>/api/cron/advance-cycles`
   - Method: `POST`
   - Schedule: every hour at minute 0 (24 ticks/day — D-10)
   - Header: `Authorization: Bearer $CRON_SECRET`
4. Confirm the cron hits **production only** (not preview).
5. After the first cron tick, verify Vercel logs show a `200` with the D-12 shape.

## Next Phase Readiness

- **Phase 3 code-side is shippable.** External cron can POST the endpoint; the orchestrator advances all eligible households (active-ready + paused); each transition goes through the single-write-path engine; per-household errors do not cascade. User has the runbook above.
- **Phase 4 (invitations → leaveHousehold):** unblocked. `transitionCycle(_, 'member_left')` remains the shared integration point; no additional contract added by this plan.
- **Phase 5 (notification consumer + dashboard banner):** unblocked. Every transition produced by cron writes a `cycle_started` / `cycle_reassigned_*` / `cycle_fallback_owner` notification row inside the same transaction (D-15) — Phase 5 just reads them.
- **Phase 6 (settings UI + dashboard banner):** unblocked.

## Self-Check

Verification of claims (commands run in working tree at 2026-04-18T04:11:41Z):

- `grep -q "export async function advanceAllHouseholds" src/features/household/cron.ts`: FOUND
- `grep -q "transitionCycle(h.id, \"cycle_end\")" src/features/household/cron.ts`: FOUND
- `grep -q "\"use server\"" src/features/household/cron.ts`: NOT PRESENT (as required — it is a plain domain module)
- `grep -q "export const runtime = \"nodejs\"" src/app/api/cron/advance-cycles/route.ts`: FOUND
- `grep -q "export const dynamic = \"force-dynamic\"" src/app/api/cron/advance-cycles/route.ts`: FOUND
- `grep -q "error: \"unauthorized\"" src/app/api/cron/advance-cycles/route.ts`: FOUND
- `grep -q "process.env.CRON_SECRET" src/app/api/cron/advance-cycles/route.ts`: FOUND
- `grep -q "api/cron" proxy.ts`: FOUND (Plan 03-02 matcher update still in place)
- `grep -c "test\\.todo" tests/phase-03/cron-route.test.ts tests/phase-03/paused-resume.test.ts`: 0 + 0 — zero todos in target files
- `npm run test -- tests/phase-03/cron-route.test.ts --run`: 5/5 pass
- `npm run test -- tests/phase-03/paused-resume.test.ts --run` (with DATABASE_URL): 1/1 pass
- `npm run test -- tests/phase-03/ --run` (with DATABASE_URL): 13 test files passed, 1 skipped, 42 tests passed, 3 todos remaining (dst-boundary.test.ts Wave 2 scope)
- `npx tsc --noEmit | wc -l`: 92 (matches pre-plan baseline)
- Commits `7d3a53b` (Task 1 RED), `30f0280` (Task 1 GREEN), `2394554` (Task 2 RED), `d041fc3` (Task 2 GREEN) all present in `git log`: FOUND

## Self-Check: PASSED

---
*Phase: 03-rotation-engine-availability*
*Plan: 05 (Wave 4 — Cron orchestrator + route handler)*
*Completed: 2026-04-18*

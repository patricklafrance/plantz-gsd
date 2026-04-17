---
phase: 2
slug: query-action-layer-update
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-16
revised: 2026-04-16
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
>
> **Revision 1 (2026-04-16):** populated per-task map after checker feedback; plans split (02-03 → 03a/03b/03c; 02-05 → 05a/05b); integration plan 02-07 added for D-18.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x |
| **Config file** | `vitest.config.ts` (existing) |
| **Quick run command** | `npx vitest run <pattern>` |
| **Full suite command** | `npx vitest run` |
| **Integration run** | `npx vitest run tests/household-integration.test.ts` (real Prisma against `DATABASE_URL`) |
| **Estimated runtime (unit)** | ~30 seconds |
| **Estimated runtime (integration)** | ~3-5 seconds (Prisma connection + 5 tests) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <targeted test file>` (≤ 5s)
- **After every plan wave:** Run `npx vitest run` (full unit suite)
- **After Plan 02-07 (integration):** Run `npx vitest run tests/household-integration.test.ts` (real DB)
- **Before `/gsd-verify-work`:** Full suite + integration suite must be green; `npm run build` must exit 0
- **Max feedback latency:** 30 seconds for unit tests, +5 seconds if integration suite included

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-T1 | 02-01 | 1 | HSLD-02, HSLD-03 | T-02-01-02, T-02-01-04 | HouseholdMember.isDefault column added via safe `--create-only` migration; backfill is idempotent | source-shape + schema | `npx vitest run tests/household.test.ts` | `prisma/schema.prisma`, `prisma/migrations/*_add_household_member_is_default/migration.sql` | ⬜ pending |
| 01-T2 | 02-01 | 1 | HSLD-02, HSLD-03 | T-02-01-01, T-02-01-03 | getCurrentHousehold cached helper composes resolveHouseholdBySlug + requireHouseholdAccess; auth.ts narrows activeHouseholdId | compile-gate | `npx tsc --noEmit` (scoped grep) | `src/features/household/context.ts`, `auth.ts` | ⬜ pending |
| 01-T3 | 02-01 | 1 | HSLD-02, HSLD-03 | T-02-01-05 | Wave 0 test scaffolds exist; ≥ 28 new test.todo entries across 7 files | test-scaffold | `npx vitest run` (pending todos allowed) | `tests/household-create.test.ts`, `tests/household-list.test.ts`, `tests/{plants,rooms,watering,notes,reminders}.test.ts` | ⬜ pending |
| 02-T1 | 02-02 | 2 | HSLD-02, HSLD-03 | T-02-02-02, T-02-02-06 | RED phase: failing tests for createHousehold (5) + getUserHouseholds (3) mock-verify $transaction + demo gate + slug loop + isDefault=false | unit (mocked Prisma) | `npx vitest run tests/household-create.test.ts tests/household-list.test.ts` (RED: exits non-zero) | `tests/household-create.test.ts`, `tests/household-list.test.ts` | ⬜ pending |
| 02-T2 | 02-02 | 2 | HSLD-02, HSLD-03 | T-02-02-01, T-02-02-03, T-02-02-04, T-02-02-05 | GREEN phase: createHousehold + getUserHouseholds shipped; registerUser updates isDefault: true; all 8+ tests green | unit (mocked Prisma) | `npx vitest run tests/household-create.test.ts tests/household-list.test.ts` (GREEN: exits 0) | `src/features/household/actions.ts`, `src/features/household/queries.ts`, `src/features/household/schema.ts`, `src/features/auth/actions.ts` | ⬜ pending |
| 04-T1 | 02-04 | 2 | HSLD-02, HSLD-03 | T-02-04-01, T-02-04-02, T-02-04-06 | plants queries honor householdId in where clause; schemas extend with householdId: z.cuid() | unit (mocked Prisma) | `npx vitest run tests/plants.test.ts` | `src/features/plants/queries.ts`, `src/features/plants/schemas.ts`, `tests/plants.test.ts` | ⬜ pending |
| 04-T2 | 02-04 | 2 | HSLD-02, HSLD-03 | T-02-04-01, T-02-04-05 | rooms/watering/notes queries use direct householdId or nested plant: { householdId }; schemas updated | unit (mocked Prisma) | `npx vitest run tests/rooms.test.ts tests/watering.test.ts tests/notes.test.ts` | `src/features/{rooms,watering,notes}/queries.ts + schemas.ts`, their test files | ⬜ pending |
| 04-T3 | 02-04 | 2 | HSLD-02, HSLD-03 | T-02-04-01, T-02-04-03 | reminders queries migrated with D-14 stable signatures + D-15 no-assignee-gate | unit (mocked Prisma) | `npx vitest run tests/reminders.test.ts` | `src/features/reminders/queries.ts`, `src/features/reminders/schemas.ts`, `tests/reminders.test.ts` | ⬜ pending |
| 05a-T1 | 02-05a | 3 | HSLD-02, HSLD-03 | T-02-05a-01, T-02-05a-02, T-02-05a-03, T-02-05a-04, T-02-05a-05, T-02-05a-06 | plants actions migrated to D-12; archive/unarchive/delete switch to data blob; client components thread householdId | compile-gate | `npx tsc --noEmit` (scoped grep on plants actions + components) | `src/features/plants/actions.ts + schemas.ts`, `src/components/plants/{add-plant-dialog,edit-plant-dialog,plant-actions}.tsx` | ⬜ pending |
| 05a-T2 | 02-05a | 3 | HSLD-02, HSLD-03 | T-02-05a-01, T-02-05a-03 | rooms actions migrated; deleteRoom switches to data blob; room-card + quick-create-presets + create-room-dialog receive householdId | compile-gate | `npx tsc --noEmit` (scoped grep) | `src/features/rooms/actions.ts + schemas.ts`, `src/components/rooms/{create-room-dialog,quick-create-presets,room-card}.tsx` | ⬜ pending |
| 05b-T1 | 02-05b | 3 | HSLD-02, HSLD-03 | T-02-05b-01, T-02-05b-02, T-02-05b-03, T-02-05b-08 | watering + notes actions migrated with nested plant.householdId + audit columns; 7 client components thread householdId; updateNote + deleteWateringLog + loadMoreWateringHistory + loadMoreTimeline signatures handled | compile-gate | `npx tsc --noEmit` (scoped grep on 11 files) | `src/features/{watering,notes}/actions.ts + schemas.ts`, 7 component files | ⬜ pending |
| 05b-T2 | 02-05b | 3 | HSLD-02, HSLD-03 | T-02-05b-04, T-02-05b-05, T-02-05b-06, T-02-05b-07 | reminders actions migrated; D-13 compound key preserved; demo bootstrap $transaction creates Household + HouseholdMember; toggleGlobalReminders unchanged; snooze-pills + plant-reminder-toggle thread householdId | compile-gate + build | `npx tsc --noEmit` + `npm run build` | `src/features/{reminders,demo}/actions.ts`, `src/components/reminders/{snooze-pills,plant-reminder-toggle}.tsx` | ⬜ pending |
| 07-T1 | 02-07 | 3 | HSLD-02, HSLD-03 | T-02-07-01, T-02-07-04 | Real-Prisma integration tests for createHousehold + getUserHouseholds; namespaced cleanup prevents data leak; D-18 honored | integration (real Prisma) | `npx vitest run tests/household-integration.test.ts` | `tests/household-integration.test.ts` | ⬜ pending |
| 03a-T1 | 02-03a | 4 | HSLD-02, HSLD-03 | T-02-03a-01, T-02-03a-02 | /h/[householdSlug]/layout.tsx + error.tsx + not-found.tsx exist; layout calls getCurrentHousehold | compile-gate | `npx tsc --noEmit` (scoped grep) | 3 new files under `src/app/(main)/h/[householdSlug]/` | ⬜ pending |
| 03a-T2 | 02-03a | 4 | HSLD-02, HSLD-03 | T-02-03a-03, T-02-03a-04 | Pages moved under `/h/[householdSlug]/`; queries use household.id; rooms/[id]/page.tsx userId fix applied; dialogs receive householdId | compile-gate | `npx tsc --noEmit` (scoped grep) | 8 new files (5 page + 3 loading) | ⬜ pending |
| 03b-T1 | 02-03b | 5 | HSLD-02, HSLD-03 | T-02-03b-01, T-02-03b-03 | 5 legacy stubs replace pre-move pages; auth.config.ts:22 unchanged; full build passes | full-build | `npm run build` | 5 legacy stub files | ⬜ pending |
| 03c-T1 | 02-03c | 6 | HSLD-02, HSLD-03 | T-02-03c-03 | Outer (main)/layout.tsx slimmed — session gate + a11y + main wrapper only | compile-gate | `npx tsc --noEmit` (scoped grep) | `src/app/(main)/layout.tsx` | ⬜ pending |
| 03c-T2 | 02-03c | 6 | HSLD-02, HSLD-03 | T-02-03c-01, T-02-03c-02 | Inner layout gains chrome; BottomTabBar + NotificationBell accept householdSlug; reminder count uses household.id | full-build + manual smoke | `npm run build` + dev-server smoke (record in SUMMARY) | inner layout, `bottom-tab-bar.tsx`, `notification-bell.tsx` | ⬜ pending |
| 06-T1 | 02-06 | 7 | HSLD-02, HSLD-03 | T-02-06-01, T-02-06-02, T-02-06-04, T-02-06-05 | D-17 ForbiddenError coverage for 17 mutating actions; vi.importActual keeps ForbiddenError real; payload shapes match schemas; full build clean | unit (partial mock Prisma) + full build | `npx vitest run` + `npm run build` | 5 test files (`tests/{plants,rooms,watering,notes,reminders}.test.ts`) | ⬜ pending |

*Status legend: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Sampling continuity check:** No 3 consecutive tasks without an automated verify. Every task above has a concrete `<automated>` command mapped. Plans 05a-T1, 05a-T2, 05b-T1, 03a-T1, 03a-T2, 03c-T1 rely on `npx tsc --noEmit` (compile-gate) — which IS an automated test for this purpose. Plan 05b-T2 + 03b-T1 add `npm run build`. Plan 06-T1 provides the overall authz test coverage.

---

## Wave Structure

| Wave | Plans | Description |
|------|-------|-------------|
| 1 | 02-01 | Wave 0: test scaffolds + schema migration + getCurrentHousehold + WR-01 fix |
| 2 | 02-02, 02-04 | HSLD-02/03 data layer + 5-feature query migration |
| 3 | 02-05a, 02-05b, 02-07 | Action-layer migration (plants/rooms, then watering/notes/reminders/demo) + real-Prisma integration tests |
| 4 | 02-03a | Route tree moves under /h/[householdSlug]/ |
| 5 | 02-03b | Legacy redirect stubs |
| 6 | 02-03c | Chrome relocation |
| 7 | 02-06 | D-17 ForbiddenError coverage + final build gate |

**File-ownership check:** No two same-wave plans modify the same file. 02-05a touches `src/features/plants/*` + `src/features/rooms/*` + plants/rooms components. 02-05b touches `src/features/watering/*` + `src/features/notes/*` + `src/features/reminders/*` + `src/features/demo/*` + their components. 02-07 touches only `tests/household-integration.test.ts`. No overlap.

Wave 4, 5, 6 are sequential (all touch `src/app/(main)/...` or related chrome files — 03a creates new files, 03b replaces originals, 03c modifies inner layout + chrome components). Running them as parallel waves would create file conflicts; sequential is required.

---

## Wave 0 Requirements (gated by Plan 02-01)

- [ ] `prisma/schema.prisma` — HouseholdMember.isDefault column + migration file (Plan 02-01 Task 1)
- [ ] `tests/household-create.test.ts` — scaffolded skeleton (Plan 02-01 Task 3)
- [ ] `tests/household-list.test.ts` — scaffolded skeleton (Plan 02-01 Task 3)
- [ ] Cross-feature Phase-2 describe blocks added to `tests/{plants,rooms,watering,notes,reminders}.test.ts` (Plan 02-01 Task 3)
- [ ] `src/features/household/context.ts` — getCurrentHousehold export (Plan 02-01 Task 2)
- [ ] `auth.ts` — activeHouseholdId narrowing (Plan 02-01 Task 2)

*Existing Vitest infrastructure covers all unit-test phase requirements. Integration tests (Plan 02-07) introduce real-Prisma usage with namespaced cleanup — minor new infra, no separate config file.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Legacy path `/dashboard` redirects to `/h/<slug>/dashboard` for a signed-in user | HSLD-02 (indirect) | Requires live session cookie + DB round-trip | 1. Log in as seeded user 2. Visit `/dashboard` 3. Confirm 307 redirect to `/h/<slug>/dashboard` |
| Legacy path `/plants` and `/rooms` redirect similarly | HSLD-02 (indirect) | Same | Visit each, confirm forward |
| Dynamic legacy path `/plants/[id]` preserves id through redirect | HSLD-02 | Same | Visit `/plants/<known-id>` → confirm lands on `/h/<slug>/plants/<known-id>` |
| `/h/<unknown-slug>/dashboard` renders not-found.tsx (404) | HSLD-02 | Requires visual inspection of rendered page | Visit a made-up slug; confirm "Household not found" UI |
| `/h/<other-user-slug>/dashboard` renders error.tsx (403) | HSLD-02 | Requires a second account + cross-household attempt | Log in as User A; visit User B's slug → confirm ForbiddenError branch of error.tsx |
| Chrome (NotificationBell, BottomTabBar, header) renders inside household layout | HSLD-02 (indirect) | Visual — touch-target WCAG compliance + slug-aware hrefs | 1. Log in 2. Visit `/h/<slug>/dashboard`, `/h/<slug>/plants`, `/h/<slug>/rooms` 3. Confirm chrome on each; click Plants tab → URL has slug prefix; click reminder item → navigates with slug |
| Demo bootstrap creates working demo user + household | Phase 7 dependency | Exercises startDemoSession full path; failure = broken demo mode | Log out; click "Try demo" entry point (if present); confirm demo user lands on a working household dashboard |

All manual verifications are recorded in SUMMARY.md files when the executor runs them.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (Per-Task Map above enumerates each)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (compile-gate + test runs intermixed across waves)
- [x] Wave 0 covers all MISSING references (6 Wave 0 scaffold items listed)
- [x] No watch-mode flags (every command uses `run` not `watch`)
- [x] Feedback latency < 30s (unit suite ~30s; integration +5s)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved — ready for execution. Wave 0 begins with Plan 02-01.
</content>
</invoke>
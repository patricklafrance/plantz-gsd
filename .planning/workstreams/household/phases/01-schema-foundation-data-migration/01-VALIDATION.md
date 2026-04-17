---
phase: 1
slug: schema-foundation-data-migration
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-16
updated: 2026-04-16
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.4 (unit + file-source assertions) |
| **Config file** | vitest.config.mts (environment: "jsdom") |
| **Quick run command** | `npx vitest run --changed` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds (mocked DB; no live Postgres needed for unit suite) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --changed` (vitest 4 detects changed files via git)
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green AND `npx prisma migrate status` must be clean
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-T1 | 01 | 1 | HSLD-04 (D-10 dep) | T-01-01-01, T-01-01-02 | Slug uses CSPRNG with rejection-sampled unambiguous alphabet | unit | `npx vitest run tests/slug.test.ts` | ❌ Wave 0 — created in this task | ⬜ pending |
| 01-01-T2 | 01 | 1 | HSLD-01, HSLD-05, HSLD-06, AUDT-01, AUDT-02 (test scaffold) | — (scaffold) | Wave 0 placeholder; describes/test.todo for all Phase 1 behaviors | unit | `npx vitest run tests/household.test.ts` | ❌ Wave 0 — created in this task | ⬜ pending |
| 01-01-T3 | 01 | 1 | HSLD-04 | T-01-01-03 | Documentation traceability matches D-07 de-scope | docs grep | `grep -c "Deferred / N/A — superseded by DB flush" .planning/workstreams/household/REQUIREMENTS.md` | ✅ exists | ⬜ pending |
| 01-02-T1 | 02 | 2 | HSLD-05, HSLD-06, AUDT-01, AUDT-02 | T-01-02-01, T-01-02-02, T-01-02-04 | 5 new models, audit columns SetNull, household ownership Cascade, indexes | schema-shape (file-source) | `npx prisma validate && npx vitest run tests/household.test.ts -t "Prisma schema"` | depends on 01-01-T2 | ⬜ pending |
| 01-02-T2 | 02 | 2 | HSLD-06 (data integrity) | T-01-02-03 | WateringLog functional unique on (plantId, date_trunc('day', wateredAt)) | migration-sql grep | `npx vitest run tests/household.test.ts -t "WateringLog functional unique index"` | depends on 01-01-T2 | ⬜ pending |
| 01-02-T3 | 02 | 2 | HSLD-05, HSLD-06, AUDT-01, AUDT-02 | T-01-02-* (apply phase) | Migration applied, Prisma client regenerated, types available | migration-status + smoke | `npx prisma migrate status && npx vitest run tests/household.test.ts` | live DB required | ⬜ pending |
| 01-03-T1 | 03 | 3 | HSLD-01 (JWT plumbing) | T-01-03-02 | JWT/session carry activeHouseholdId; queried at sign-in only (Pitfall 4) | source-shape | `npx vitest run tests/household.test.ts -t "JWT activeHouseholdId extension"` | depends on 01-01-T2 | ⬜ pending |
| 01-03-T2 | 03 | 3 | HSLD-05 (timezone wiring) | T-01-03-03, T-01-03-04 | registerSchema accepts optional timezone; form passes Intl.DateTimeFormat | regression + grep | `npx vitest run tests/auth.test.ts tests/register-form.test.tsx` | ✅ exists | ⬜ pending |
| 01-03-T3 | 03 | 3 | HSLD-01, HSLD-05 | T-01-03-01, T-01-03-05 | registerUser is atomic transaction; defaults match D-08/D-09/D-10/D-12 | source-shape (mocked DB) | `npx vitest run tests/household.test.ts -t "registerUser transactional household creation"` | depends on 01-01-T2 | ⬜ pending |
| 01-04-T1 | 04 | 3 | HSLD-06 | T-01-04-01, T-01-04-02, T-01-04-04 | Guard live-checks membership; ForbiddenError cross-boundary safe | unit (mocked auth + db) | `npx vitest run tests/household.test.ts -t "ForbiddenError class" && npx vitest run tests/household.test.ts -t "requireHouseholdAccess guard"` | depends on 01-01-T2 | ⬜ pending |
| 01-04-T2 | 04 | 3 | HSLD-06 (slug resolution) | T-01-04-03, T-01-04-05 | Resolver returns minimal projection; enums available for Phases 2-7 | unit (mocked db) + grep | `npx vitest run tests/household.test.ts -t "resolveHouseholdBySlug" && npx vitest run tests/household.test.ts -t "household schema enums"` | depends on 01-01-T2 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

The following infrastructure is created within Plan 01 (Wave 1) — all subsequent waves depend on it:

- [ ] `tests/household.test.ts` — Wave 0 test scaffold with describe blocks and `test.todo` placeholders for HSLD-01, HSLD-05, HSLD-06, AUDT-01, AUDT-02, D-10, and JWT/session shape (created by Plan 01 Task 2)
- [ ] `src/lib/slug.ts` — Required by Plan 03 Task 3 (registerUser) and indirectly by all consumers (created by Plan 01 Task 1)
- [ ] `tests/slug.test.ts` — Per-task feedback signal for Plan 01 Task 1 (created by Plan 01 Task 1)
- [ ] REQUIREMENTS.md HSLD-04 traceability disposition (Plan 01 Task 3)

No new test framework install needed — Vitest 4.1.4 already installed and operational.
No live Postgres required for unit suite — `vi.mock("@/lib/db", ...)` covers all transaction/guard/resolver tests. Live Postgres IS required for Plan 02 Task 3 (the [BLOCKING] schema push) — verified separately via `npx prisma migrate status`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Production DB flush (D-06) | HSLD-04 (de-scoped) | Destructive one-time operation; not a regression test | Executed once before schema deploy; verified by `SELECT COUNT(*) FROM "User"` returning 0. Local dev DB is reset via `npx prisma migrate reset --force` in Plan 02 Task 3. |
| End-to-end signup → household visible in DB | HSLD-01 (full integration) | Requires live Postgres + browser session; not part of unit suite | After Phase 1 deploy: register a new account, then `psql $DATABASE_URL -c "SELECT u.email, h.name, h.slug, hm.role FROM \"User\" u JOIN \"HouseholdMember\" hm ON hm.\"userId\"=u.id JOIN \"Household\" h ON h.id=hm.\"householdId\" WHERE u.email='<email>'"` should return one row with name='My Plants', role='OWNER'. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (every task in 01-01..01-04 has an automated verify)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (every task has one)
- [x] Wave 0 covers all MISSING references (slug.ts + household.test.ts created in Plan 01 Wave 1)
- [x] No watch-mode flags (all commands use `npx vitest run`, not `vitest`)
- [x] Feedback latency < 60s (mocked DB unit suite is ~5s; full suite well under 60s)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready

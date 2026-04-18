---
phase: 03
slug: rotation-engine-availability
status: verified
threats_open: 0
asvs_level: 1
created: 2026-04-18
---

# Phase 03 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| External cron → Route Handler | cron-job.org POSTs to `/api/cron/advance-cycles` over public internet; bearer token is the only auth. `proxy.ts` matcher exempts `/api/cron/*` from NextAuth. | `Authorization: Bearer <CRON_SECRET>` header; empty body; JSON summary response (household IDs + cycle numbers + reasons) |
| Browser session → Server Actions | Household members POST to `skipCurrentCycle` / `createAvailability` / `deleteAvailability` via React form actions; authenticated via NextAuth session cookie. | Form payload (cuid householdId, dates, reason strings); session user id used for ownership checks |
| Server Action → DB ($transaction) | Single-write-path `transitionCycle` holds a Postgres row lock (`FOR UPDATE SKIP LOCKED`) and emits Cycle/HouseholdNotification writes in one atomic block. | Cycle/HouseholdNotification rows; snapshot reads of HouseholdMember + Availability |
| npm registry → build | `@date-fns/tz@^1.4.1` direct dep; lockfile-pinned. TZDate is the DST-safe arithmetic primitive for Cycle boundaries. | Bundled JS shipped to Node runtime only |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-3-01-SECRET-LEAK | Information Disclosure | `.env.example` | mitigate | `.env.example` documents `CRON_SECRET` with `generate-with-openssl-rand-hex-32` placeholder; real secret stays in gitignored `.env.local`. Verified: `.env.example:5` | closed |
| T-3-01-SUPPLY-CHAIN | Tampering | `package.json` dep | mitigate | `@date-fns/tz` pinned to `^1.4.1`; present as direct dependency and in `package-lock.json`. Verified: `package.json:18` | closed |
| T-3-01-TEST-ISOLATION | Tampering | shared dev Postgres | accept | Integration tests write to shared dev DB with `EMAIL_PREFIX` + `RUN_ID` namespacing + per-test `afterAll` cleanup. See Accepted Risks Log. | closed |
| T-3-01-PATH-INJECT | Tampering | `HOUSEHOLD_PATHS.settings` | mitigate | Compile-time constant: `settings: "/h/[householdSlug]/settings"` in `as const` object. No dynamic string building from user input at revalidate sites. Verified: `src/features/household/paths.ts:21` | closed |
| T-3-AUTH-CRON | Spoofing | `/api/cron/advance-cycles` | mitigate | Bearer compare inside POST handler; `proxy.ts` matcher excludes `api/cron` so NextAuth does not intercept; unauth returns generic 401 before any DB call. Verified: `src/app/api/cron/advance-cycles/route.ts:35-44`, `proxy.ts:7` | closed |
| T-3-DB-MIG-01 | Tampering | Prisma migration | mitigate | `prisma migrate dev` produced committed `prisma/migrations/20260418032405_phase_03_rotation_engine_availability/migration.sql`; drift-resync helper (`scripts/resync-migration-checksum.ts`) in place for future incidents. Verified: migration folder present, `prisma migrate status` clean. | closed |
| T-3-DB-DEDUPE-01 | Integrity | `HouseholdNotification` | mitigate | `@@unique([cycleId, recipientUserId, type])` on model in `prisma/schema.prisma:245`; all Phase 3 writes pass non-null `cycleId`. | closed |
| T-3-IDEMPOTENCY | Integrity | `transitionCycle` | mitigate | `tx.$queryRaw ... FOR UPDATE SKIP LOCKED` is the first statement inside the `db.$transaction` callback; lock-loss returns `{ skipped: true }` with zero side effects. Verified: `src/features/household/cycle.ts:217-244` | closed |
| T-3-NOTIF-DEDUPE | Integrity | `tx.householdNotification.create` | mitigate | P2002 unique violation swallowed via `isUniqueViolation(err)`; unique key is `@@unique([cycleId, recipientUserId, type])`. Verified: `src/features/household/cycle.ts:330-343`, `src/features/household/cycle.ts:193-197` | closed |
| T-3-NOTIF-INJECT | Elevation of Privilege | `transitionCycle` | mitigate | `transitionCycle(householdId, hintReason)` signature accepts no `recipientUserId` or `type`; recipient is derived from `findNextAssignee` result; type is derived from `mapReasonToNotificationType(finalReason)`. Verified: `src/features/household/cycle.ts:213-216,330-339` | closed |
| T-3-DST-SKEW | Tampering | `computeNextCycleBoundaries` | mitigate | `new TZDate(outgoingEndDate.getTime(), timezone)` + `addDays` preserves wall-clock across DST transitions. Verified: `src/features/household/cycle.ts:82-93` (also `computeInitialCycleBoundaries` at :63-76) | closed |
| T-3-LOCK-ESCAPE | Tampering | cycle engine | mitigate | `tx.$queryRaw` with `FOR UPDATE SKIP LOCKED` only inside `db.$transaction` callback; grep `db.$queryRaw` in `src/` returns no matches (only `tx.$queryRaw` in `cycle.ts:219`). Verified: `src/features/household/cycle.ts:219`. | closed |
| T-3-AUTHZ-SKIP | Elevation of Privilege | `skipCurrentCycle` | mitigate | After `requireHouseholdAccess`, explicit `currentCycle.assignedUserId !== session.user.id` check returns error. Verified: `src/features/household/actions.ts:160-162` | closed |
| T-3-AUTHZ-DELETE-AVAIL | Elevation of Privilege | `deleteAvailability` | mitigate | Dual-auth: `row.userId !== session.user.id && role !== "OWNER"` throws `ForbiddenError`. Verified: `src/features/household/actions.ts:271-275` | closed |
| T-3-DEMO-BYPASS | Tampering | all three new actions | mitigate | Verbatim `"Demo mode — sign up to save your changes."` string guards `skipCurrentCycle`, `createAvailability`, `deleteAvailability`, `createHousehold`. Verified: `src/features/household/actions.ts:39,133,184,252` | closed |
| T-3-PAST-AVAIL | Tampering | `createAvailabilitySchema` | mitigate | Zod refine `d.startDate >= startOfDay(new Date())` with message "Availability cannot start in the past." Verified: `src/features/household/schema.ts:64-67` | closed |
| T-3-OVERLAP | Integrity | `createAvailability` | mitigate | `findOverlappingPeriod` precheck with closed-interval semantics (`lte` / `gte`); overlap returns user-facing rejection with existing period's dates. Verified: `src/features/household/actions.ts:213-225`, `src/features/household/availability.ts:18-26` | closed |
| T-3-CYCLE-BOOTSTRAP | Availability | `registerUser` / `createHousehold` | mitigate | `tx.cycle.create` executed inside the existing `$transaction` after HouseholdMember insert, in both paths. Transaction rollback guarantees no orphan Household without Cycle #1. Verified: `src/features/auth/actions.ts:98-116`, `src/features/household/actions.ts:94-112` | closed |
| T-3-CRON-DDOS | Availability | `/api/cron/advance-cycles` | accept | Vercel platform rate-limiting; bearer compare rejects before any DB call. See Accepted Risks Log. | closed |
| T-3-CRON-ENV-LEAK | Information Disclosure | cron route 401 body | mitigate | 401 body is literal `{ error: "unauthorized" }` with no format hint; secret never logged; `console.warn` captures only IP + user-agent. CR-01 fail-closed when `CRON_SECRET` unset. Verified: `src/app/api/cron/advance-cycles/route.ts:29-44` | closed |
| T-3-HANDLER-CACHE | Tampering | cron route | mitigate | `export const dynamic = "force-dynamic"` at module scope. Verified: `src/app/api/cron/advance-cycles/route.ts:19` | closed |
| T-3-EDGE-RUNTIME | Availability | cron route | mitigate | `export const runtime = "nodejs"` at module scope. Verified: `src/app/api/cron/advance-cycles/route.ts:18` | closed |
| T-3-ITER-BLOCKING | Availability | `advanceAllHouseholds` | mitigate | Sequential `for...of` loop with per-household `try/catch`; errors push to `errors[]` and the loop continues; `console.error` logs for observability. Verified: `src/features/household/cron.ts:68-88` | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-3-01 | T-3-01-TEST-ISOLATION | Phase-03 integration tests write to shared dev Postgres, not an isolated test DB. Mitigated by `EMAIL_PREFIX` + `RUN_ID` prefix namespacing on all created rows and per-suite `afterAll` cleanup keyed on the prefix. A compromised developer workstation still taints prod. Not a production-path risk (tests do not run in prod). | Plan 03-01 threat model (author: executor, reviewed in plan drafting) | 2026-04-18 |
| AR-3-02 | T-3-CRON-DDOS | External cron hits `/api/cron/advance-cycles` at 24 req/day from a single source (cron-job.org). Unauthenticated flood is bounded by Vercel platform rate-limiting plus pre-DB bearer rejection (401 without DB touch). No application-layer rate-limiter added. Traffic volume + cost profile does not justify the complexity in v1. | Plan 03-05 threat model (author: executor, reviewed in plan drafting) | 2026-04-18 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-04-18 | 23 | 23 | 0 | gsd-security-auditor (State B, ASVS L1) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-04-18

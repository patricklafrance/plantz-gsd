---
phase: 07-demo-mode-compatibility
audited: 2026-04-26
status: SECURED
asvs_level: 1
threats_total: 8
threats_closed: 8
threats_open: 0
---

# Phase 07 Security Audit

**Phase:** 07 — Demo Mode Compatibility
**ASVS Level:** 1
**Result:** SECURED — 8/8 threats closed

Auditor verified each threat declared in the PLAN.md `<threat_model>` blocks (07-01 + 07-02) by its declared disposition. No implementation files were modified.

## Threat Verification

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-07-01 | Spoofing (ASVS V2/V6) | mitigate | CLOSED | `prisma/seed.ts:59-62` — `bcryptjs.hash(crypto.randomBytes(32).toString("hex"), 12)` constructs the unusable hash; CSPRNG source is created inline and never persisted. Hash assigned to `passwordHash` for both Alice (`prisma/seed.ts:90`) and Bob (`prisma/seed.ts:99`). `bcryptjs.compare` against any known input cannot succeed. |
| T-07-02 | Elevation of Privilege (ASVS V1.4) | mitigate | CLOSED | `src/features/demo/seed-data.ts:1` — `DEMO_EMAIL = "demo@plantminder.app"`. Sample emails on `@demo.plantminder.app` subdomain (lines 19, 24): `alice@demo.plantminder.app`, `bob@demo.plantminder.app`. `auth.ts:21` uses strict equality: `token.isDemo = dbUser?.email === DEMO_EMAIL` — no `startsWith`/`endsWith`/`includes`. Subdomain emails cannot satisfy literal `===` against the apex demo email. |
| T-07-03 | Tampering (ASVS V4.3) | accept | CLOSED | Documented as accepted risk below. Seed transaction in `prisma/seed.ts:71-200` is scoped to `householdId = household.id`; outer `if (!existingDemo)` gate (line 53) prevents double-seeding. `requireHouseholdAccess` (Phase 1) handles per-request authorization at runtime. |
| T-07-04 | Tampering (ASVS V4/V5.1) | mitigate | CLOSED | `tests/phase-07/demo-guard-audit.test.ts` exists and is the regression gate. Walks `src/features/**/actions.ts` (8 files), extracts every `export async function` body via paren+brace depth tracking (lines 66-116), and asserts each non-skipped body contains literal `session.user.isDemo`. SKIP_FUNCTIONS Set has exactly 4 entries (lines 28-33): `startDemoSession`, `registerUser`, `loadMoreWateringHistory`, `loadMoreTimeline`. On violation, throws an Error listing every offending `(file, functionName)` pair. Per VERIFICATION.md, runs green: 1/1 pass with 0 offenders. |
| T-07-05 | Tampering (ASVS V10.1) | accept | CLOSED | Documented as accepted risk below. Controlled via `DATABASE_URL`; idempotency gate in `prisma/seed.ts:53` prevents clobbering. Operational-runbook concern, not in-code. Low severity. |
| T-07-06 | Information Disclosure | accept | CLOSED | Documented as accepted risk below. Error string "Demo data not found. Run `npx prisma db seed`..." (`src/features/demo/actions.ts:28-30`) only fires when `DEMO_EMAIL` (a fixed public string) is missing from the User table. No user-supplied input is echoed. Operational-only signal. |
| T-07-07 | Denial of Service | accept | CLOSED | Documented as accepted risk below. `findUnique` on the unique-indexed `email` column is O(log n); NextAuth Credentials provider rate-limits the signIn call path. Low impact. |
| T-07-08 | Spoofing | mitigate (existing) | CLOSED | `src/features/household/guards.ts` exposes `requireHouseholdAccess`, imported and invoked across 7 feature modules (grep: `src/features/{demo,household,rooms,plants,reminders,notes,watering}/actions.ts` plus `household/queries.ts` and `household/context.ts`). Spot-checks: `src/features/demo/actions.ts:79` invokes `requireHouseholdAccess(targetHouseholdId)` BEFORE any DB reads in `seedStarterPlants` (WR-03 fix verified in commit f321e8c). Demo user seeded as the only OWNER of exactly one Demo Household with `isDefault: true` (`prisma/seed.ts:131-138`); JWT activeHouseholdId resolution at `auth.ts:26-31` orders by `isDefault desc`, picking the Demo Household. Existing Phase-1 mitigation; no net-new code required. |

## Accepted Risks Log

The following threats are accepted (not mitigated in code) for the documented reasons. No further action required for Phase 07.

### T-07-03 — Demo seed leaking data into unrelated households (ASVS V4.3)
- **Why accepted:** Seed runs only at developer-controlled `npx prisma db seed` time; transaction is scoped by `householdId` to the freshly-created Demo Household; runtime authorization is enforced by `requireHouseholdAccess` (Phase 1). Defense-in-depth at the seed-script layer is out of scope.
- **Compensating controls:** `if (!existingDemo)` idempotency gate; per-request `requireHouseholdAccess`; ASVS V1 environment separation via `DATABASE_URL`.

### T-07-05 — Seed running against production DB (ASVS V10.1)
- **Why accepted:** Environmental concern (operator runs `prisma db seed` against the wrong `DATABASE_URL`). Idempotency gate `if (!existingDemo)` prevents clobbering existing demo data. Production deploys use `prisma migrate deploy`, not `db seed`. Low severity.
- **Compensating controls:** `DATABASE_URL` env separation; idempotency guard; DEVOPS runbook documentation.

### T-07-06 — Demo sign-in error leaking DB enumeration signal
- **Why accepted:** The error message "Demo data not found. Run `npx prisma db seed`..." only triggers when the fixed public string `DEMO_EMAIL = "demo@plantminder.app"` is missing. No user-supplied input appears in the error. The signal value to an attacker is zero (the email is hard-coded, public, and tied to dev-mode setup).
- **Compensating controls:** Error string is static; routes to `/login?error=demo_failed` (no detail leak in URL).

### T-07-07 — Repeated /demo hits with missing seed (DoS)
- **Why accepted:** `findUnique` on a unique-indexed column is O(log n); NextAuth's signIn path applies its own rate limits. Operational impact is negligible.
- **Compensating controls:** DB index on `User.email`; NextAuth rate limiting.

## Unregistered Flags

None. Both phase summaries (`07-01-SUMMARY.md` and `07-02-SUMMARY.md`) explicitly declare "## Threat Flags: None" — no new network endpoints, auth paths, file access, or schema changes outside the threat register.

## ASVS Level 1 Coverage

| ASVS Section | Coverage |
|--------------|----------|
| V1 (Architecture) | T-07-02 enforced via JWT email-equality check at `auth.ts:21`. |
| V2 (Authentication) | T-07-01 unusable bcrypt hashes prevent sample-member account login. |
| V4 (Access Control) | T-07-04 static audit gate; T-07-08 `requireHouseholdAccess` enforced at runtime. |
| V5 (Validation) | T-07-04 audit ensures every mutating Server Action carries the demo guard. |
| V6 (Cryptography) | T-07-01 bcrypt cost factor 12; CSPRNG via `node:crypto.randomBytes`. |
| V10 (Configuration) | T-07-05 accepted; environment-separated via DATABASE_URL. |

## Auditor Notes

- All threats declared in PLAN.md (Plan 01 + Plan 02 `<threat_model>` blocks) verified.
- The static guard audit (`tests/phase-07/demo-guard-audit.test.ts`) is the phase's primary security deliverable — it is a CI-enforced regression gate that fails any future PR adding a new mutating Server Action without the demo guard.
- No `high`-severity threats; per `block_on: high` config, phase clears the security gate.
- No deviations from declared mitigation patterns.

---
*Audited: 2026-04-26*
*Auditor: gsd-security-auditor*

---
phase: 01-schema-foundation-data-migration
verified: 2026-04-16T22:45:00Z
status: human_needed
score: 5/5 roadmap success criteria verified
overrides_applied: 0
human_verification:
  - test: "End-to-end signup smoke test — register a new user via the UI"
    expected: "User lands on /dashboard; DB has a new User row + a Household row (name='My Plants', 8-char unambiguous slug, timezone matches browser, cycleDuration=7, rotationStrategy='sequential') + a HouseholdMember row (role='OWNER', rotationOrder=0)"
    why_human: "End-to-end signup exercises auth.ts signIn, NextAuth session issuance, cookie write, and redirect — requires browser + live DB; unit tests only verify source shape and mocked-DB calls"
  - test: "Verify session.user.activeHouseholdId is populated after a fresh sign-in"
    expected: "After signing in with an existing account (or immediately after registering), inspecting the JWT cookie or calling a Server Component that reads session.user.activeHouseholdId should return the user's single household id, not null/undefined"
    why_human: "JWT/session flow runs inside NextAuth's cookie pipeline — the unit tests verify the source shape of the callbacks but not the live round-trip. WR-01 (null-vs-undefined type mismatch) is worth sanity-checking here."
  - test: "Confirm requireHouseholdAccess throws and is caught correctly in a real Server Action path"
    expected: "Calling a future Phase 2 Server Action with an invalid householdId yields a ForbiddenError and an observable 403-equivalent response; instanceof check works across module boundaries"
    why_human: "No consumer currently calls requireHouseholdAccess in production code (Phase 2 wires it up); live integration requires Phase 2 code. For Phase 1, mocked tests cover the shape but cross-module instanceof behavior under a real Next.js build is worth a smoke check before Phase 2 execution."
---

# Phase 1: Schema Foundation + Data Migration Verification Report

**Phase Goal:** The database has all household models with valid data; every existing plant is reparented to its owner's auto-created solo household; JWT carries `activeHouseholdId`; household context helpers exist.

**Verified:** 2026-04-16T22:45:00Z
**Status:** human_needed
**Re-verification:** No — initial verification.

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Success Criterion | Status | Evidence |
|---|-------------------|--------|----------|
| 1 | Every existing v1 plant is associated with exactly one household row — zero plants have a null `householdId` after migration | VERIFIED | HSLD-04 de-scoped per D-07 (DB flush 2026-04-16). Schema enforces `Plant.householdId String` NOT NULL (prisma/schema.prisma:91). Migration SQL line 60-77 creates Plant with `"householdId" TEXT NOT NULL`. Flushed DB has no legacy plant rows; future inserts cannot omit householdId. REQUIREMENTS.md records the de-scope in traceability. |
| 2 | A new user who signs up gets a solo household auto-created and is its owner | VERIFIED | `src/features/auth/actions.ts:44-86` wraps registerUser in `db.$transaction(async (tx) => ...)` with three sequential creates: tx.user.create → tx.household.create (name="My Plants", slug via generateHouseholdSlug, cycleDuration=7, rotationStrategy="sequential", timezone fallback to "UTC") → tx.householdMember.create (role="OWNER", rotationOrder=0). 9 source-shape tests in tests/household.test.ts assert every invariant. Prisma $transaction guarantees atomic rollback on any failure. |
| 3 | `session.user.activeHouseholdId` resolves to a valid household for every authenticated user | VERIFIED (with advisory) | `auth.ts:26-31` runs `db.householdMember.findFirst` inside `if (user)` block at sign-in only (Pitfall 4 honoured) and sets `token.activeHouseholdId`. `auth.ts:39` copies it to `session.user.activeHouseholdId` in the session callback. `src/types/next-auth.d.ts` augments both JWT and Session interfaces. 4 source-shape tests verify. Advisory: WR-01 (null-vs-undefined type mismatch) exists but does not block the goal. |
| 4 | Plant and watering-log timeline entries carry `createdByUserId` / `performedByUserId` so authorship is recorded from this phase forward | VERIFIED | schema.prisma: Plant.createdByUserId (line 93, SetNull), Room.createdByUserId (line 76, SetNull), WateringLog.performedByUserId (line 117, SetNull), Note.performedByUserId (line 127, SetNull). Migration SQL creates all columns correctly. 4 source-shape tests verify the columns and SetNull relations. |
| 5 | `requireHouseholdAccess()` guard exists and throws `Forbidden` when the user is not a member of the given household | VERIFIED | `src/features/household/guards.ts:31-51` implements `requireHouseholdAccess(householdId)` with auth() call, live `db.householdMember.findFirst` with include: { household: true }, and throws ForbiddenError on both the no-session and non-member paths. Returns rich `{ household, member, role }` object (D-20). ForbiddenError class uses Object.setPrototypeOf for cross-module instanceof safety. 10 unit tests (5 ForbiddenError + 5 guard) verify. |

**Score:** 5/5 ROADMAP success criteria verified.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/slug.ts` | CSPRNG slug generator with unambiguous alphabet | VERIFIED | 29 lines; exports `generateHouseholdSlug` (uses `randomBytes` from `crypto` + rejection sampling, cutoff 216) + `UNAMBIGUOUS_ALPHABET` (54 chars, no 0/O/I/l/1). Imported by `src/features/auth/actions.ts:8`. 4 tests pass (incl. 1000-sample forbidden-char check). |
| `tests/slug.test.ts` | Vitest suite for slug utility | VERIFIED | 30 lines; 4 tests all green. |
| `tests/household.test.ts` | Wave 0 scaffold progressively filled by Plans 01-04 | VERIFIED | 458 lines; **0 test.todo remaining** — all 11 describe blocks have real assertions covering schema shape, audit columns, composite indexes, functional index, registerUser transaction, JWT extension, ForbiddenError, requireHouseholdAccess, resolveHouseholdBySlug, schema enums. Full suite 129 passed / 88 todo (todos are in other files for future phases). |
| `prisma/schema.prisma` | Full Phase 1 schema with 5 new household models + reparented Plant/Room + audit columns | VERIFIED | 222 lines. `npx prisma validate` → valid. 13 models total; 5 new (Household, HouseholdMember, Cycle, Availability, Invitation); Plant/Room reparented to householdId; WateringLog/Note have performedByUserId; all composite indexes present (`@@index([householdId, archivedAt])`, `@@index([householdId, status])`, `@@index([householdId])`, `@@unique([householdId, userId])`, `@@unique([householdId, cycleNumber])`); Invitation.tokenHash @unique (Pitfall 10). 21 onDelete entries (13 Cascade + 8 SetNull). |
| `prisma/migrations/20260416175000_init/migration.sql` | Initial migration with functional index | VERIFIED | 302 lines. 13 CREATE TABLE statements. All FK constraints with correct ON DELETE rules. Functional unique index `WateringLog_plantId_day_key ON WateringLog(plantId, date_trunc('day', wateredAt AT TIME ZONE 'UTC'))` appended at line 301 (Pitfall 15). `npx prisma migrate status` → "Database schema is up to date!". |
| `auth.ts` | Extended JWT + session callbacks with activeHouseholdId | VERIFIED | 71 lines. jwt callback has `db.householdMember.findFirst` inside `if (user)` block (Pitfall 4). session callback copies `token.activeHouseholdId` to `session.user.activeHouseholdId`. |
| `src/types/next-auth.d.ts` | Module augmentation for activeHouseholdId | VERIFIED | 20 lines. Session.user has `activeHouseholdId?: string`; JWT has `activeHouseholdId?: string \| null`. |
| `src/features/auth/schemas.ts` | registerSchema with optional timezone | VERIFIED | 32 lines. `timezone: z.string().max(100).optional()` added; `.refine()` password-match check preserved; `zod/v4` import retained. |
| `src/components/auth/register-form.tsx` | Form captures browser timezone | VERIFIED | 192 lines. onSubmit uses `Intl.DateTimeFormat().resolvedOptions().timeZone` with try/catch fallback to undefined; passes to registerUser. |
| `src/features/auth/actions.ts` | registerUser in db.$transaction | VERIFIED | 154 lines. `db.$transaction(async (tx) => ...)` with User → slug-collision loop (bounded at 10 attempts) → Household (name='My Plants', cycleDuration=7, rotationStrategy='sequential') → HouseholdMember (role='OWNER', rotationOrder=0). isRedirectError re-throw preserved. generateHouseholdSlug imported from '@/lib/slug'. |
| `src/features/household/guards.ts` | requireHouseholdAccess + ForbiddenError | VERIFIED | 52 lines. ForbiddenError extends Error with readonly name='ForbiddenError' + readonly statusCode=403 + `Object.setPrototypeOf` in constructor. requireHouseholdAccess calls auth(), queries `db.householdMember.findFirst` with `include: { household: true }`, throws on no-session/no-member, returns `{ household, member, role }`. |
| `src/features/household/queries.ts` | resolveHouseholdBySlug | VERIFIED | 19 lines. `db.household.findUnique` with `where: { slug }`, `select: { id: true, name: true }`. No auth() call (reader pattern). |
| `src/features/household/schema.ts` | Zod v4 enum schemas | VERIFIED | 17 lines. Imports from 'zod/v4'. Exports `householdRoleSchema = z.enum(["OWNER", "MEMBER"])` and `rotationStrategySchema = z.enum(["sequential"])` with inferred types. |
| `.planning/workstreams/household/REQUIREMENTS.md` | HSLD-04 de-scope traceability | VERIFIED | Bullet at line 17 struck through with "Deferred / N/A — superseded by DB flush decision 2026-04-16 (Phase 1 D-07)". Traceability row at line 117 shows "Deferred / N/A — superseded by DB flush decision 2026-04-16". Coverage summary at line 152 reads "Mapped to phases: 34 (HSLD-04 de-scoped per Phase 1 D-07, 2026-04-16)". |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `src/features/auth/actions.ts` (registerUser) | `db.$transaction` with `tx.user.create + tx.household.create + tx.householdMember.create` | interactive transaction (Pattern 1) | WIRED | grep shows 1 `$transaction(async` call + 3 `tx.{user,household,householdMember}.create` calls inside body |
| `src/features/auth/actions.ts` (registerUser) | `src/lib/slug.ts` (generateHouseholdSlug) | `import { generateHouseholdSlug } from "@/lib/slug"` + 1 invocation | WIRED | Line 8 import; line 57 call inside transaction |
| `src/components/auth/register-form.tsx` | `src/features/auth/actions.ts` (registerUser) | form onSubmit passes detected timezone | WIRED | Line 11 import; line 46 call with `timezone: detectedTimezone` |
| `auth.ts` (jwt callback) | `db.householdMember` (live query) | `findFirst` inside `if (user)` at sign-in only | WIRED | Lines 26-31: `db.householdMember.findFirst` inside the `if (user)` guard; `orderBy: { createdAt: "asc" }` for determinism |
| `auth.ts` (session callback) | `session.user.activeHouseholdId` | `token.activeHouseholdId` copy with cast | WIRED | Line 39: `session.user.activeHouseholdId = token.activeHouseholdId as string \| undefined` |
| `src/features/household/guards.ts` (requireHouseholdAccess) | `auth()` + `db.householdMember.findFirst` | live DB check on every invocation (D-18) | WIRED | Line 32 auth() call; line 37 findFirst with include: { household: true } |
| `src/features/household/guards.ts` (ForbiddenError) | Error class with cross-boundary instanceof | `Object.setPrototypeOf(this, ForbiddenError.prototype)` | WIRED | Line 16; test verifies `instanceof ForbiddenError` works across dynamic import boundary |
| `src/lib/slug.ts` | `node:crypto` | `import { randomBytes } from "crypto"` | WIRED | Line 1 import; line 20 invocation |
| `prisma/schema.prisma` (Plant.household) | Household | FK with onDelete: Cascade | WIRED | Line 92: `household Household @relation(fields: [householdId], references: [id], onDelete: Cascade)` |
| `prisma/migrations/.../migration.sql` | WateringLog table | raw SQL CREATE UNIQUE INDEX with date_trunc | WIRED | Lines 300-302: `CREATE UNIQUE INDEX "WateringLog_plantId_day_key" ON "WateringLog" ("plantId", date_trunc('day', "wateredAt" AT TIME ZONE 'UTC'))` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `registerUser` | `user.id`, `household.id` | Prisma `tx.user.create` / `tx.household.create` | Yes — DB returns created row with cuid | FLOWING |
| `requireHouseholdAccess` | `member`, `member.household` | Prisma `db.householdMember.findFirst` with include | Yes — live DB query with composite filter | FLOWING |
| `resolveHouseholdBySlug` | `{ id, name }` | Prisma `db.household.findUnique` | Yes — indexed lookup on slug @unique | FLOWING |
| `auth.ts` jwt callback | `membership.householdId` | Prisma `db.householdMember.findFirst` | Yes — runs only once per sign-in | FLOWING |
| `register-form.tsx` | `detectedTimezone` | `Intl.DateTimeFormat().resolvedOptions().timeZone` | Yes — browser runtime API | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Slug tests produce real assertions and pass | `npx vitest run tests/slug.test.ts` | 4 tests passed | PASS |
| Household tests pass including schema/transaction/guard invariants | `npx vitest run tests/household.test.ts` | All tests passed (0 todo in this file, contributes 46 tests to the suite) | PASS |
| Full Vitest suite is green | `npx vitest run` | 129 passed / 88 todo / 2 skipped / 0 failed | PASS |
| Prisma schema validates | `npx prisma validate` | "The schema at prisma\schema.prisma is valid" | PASS |
| Prisma client regeneration produces household model types | `npx prisma generate` (ran during verification; `src/generated/prisma/models/` contains Household.ts, HouseholdMember.ts, Cycle.ts, Availability.ts, Invitation.ts) | All 5 new model type files generated | PASS |
| Database is migrated with this phase's schema | `npx prisma migrate status` | "Database schema is up to date!" | PASS |

**Note on generated client freshness:** At the start of verification, `src/generated/prisma/models.ts` was stale (did not re-export the 5 new household model files). This is expected — the directory is gitignored and regenerates via `postinstall`. Running `npx prisma generate` during verification produced the correct output. No gap.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| HSLD-01 | 01-03 | User's solo household is auto-created on signup; user is its owner | SATISFIED | registerUser transaction creates User + Household + HouseholdMember(role='OWNER') atomically; 9 source-shape tests verify every default (name, slug, timezone, cycleDuration, rotationStrategy, role, rotationOrder) |
| HSLD-04 | 01-01 | Existing v1 users are auto-migrated on first login | DEFERRED | De-scoped per D-07 (2026-04-16). REQUIREMENTS.md traceability row and bullet both marked "Deferred / N/A — superseded by DB flush decision 2026-04-16". Intentional disposition recorded pre-execution. |
| HSLD-05 | 01-02, 01-03 | Each household has configurable name/timezone/cycleDuration/rotationStrategy | SATISFIED | Household model has all 4 fields with correct defaults (timezone 'UTC', cycleDuration 7, rotationStrategy 'sequential'); registerUser populates them on creation |
| HSLD-06 | 01-02, 01-04 | Plants/rooms/watering logs/notes/reminders scoped to household | SATISFIED | Plant.householdId + Room.householdId NOT NULL with Cascade; WateringLog/Note cascade through Plant; requireHouseholdAccess provides the authorization chokepoint for Phase 2+ consumers |
| AUDT-01 | 01-02 | Plant actions (watering logs, notes) record performedByUserId | SATISFIED | WateringLog.performedByUserId + Note.performedByUserId both added with SetNull; schema-shape tests verify |
| AUDT-02 | 01-02 | Plants and rooms record createdByUserId | SATISFIED | Plant.createdByUserId + Room.createdByUserId both added with SetNull; schema-shape tests verify |

**Coverage summary:** 6 requirement IDs declared across plans (HSLD-01, HSLD-04, HSLD-05, HSLD-06, AUDT-01, AUDT-02) match the phase's requirement contract exactly. Zero orphaned requirements. HSLD-04 is intentionally DEFERRED (not blocked) per D-07.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/features/auth/actions.ts` | 9 | `import { isRedirectError } from "next/dist/client/components/redirect-error"` (deep import into Next.js private path) | Warning (advisory) | WR-02 from code review. Pre-existing; Next.js 16 may restructure this path. Non-blocking; use `next/navigation` or runtime guard instead. |
| `src/features/household/guards.ts` | 49 | `member.role as "OWNER" \| "MEMBER"` trusts DB content blindly without validation | Warning (advisory) | WR-03 from code review. Safe today (application-controlled writes), but a future migration adding "ADMIN" would silently misclassify. Non-blocking. |
| `auth.ts` | 39 | `token.activeHouseholdId as string \| undefined` launders `string \| null` into `string \| undefined` | Warning (advisory) | WR-01 from code review. Runtime value can be null; consumers using `=== undefined` for no-household get false. Non-blocking but should be normalized before Phase 2 consumers rely on it. |
| `src/features/auth/actions.ts` | 110 | `updateTimezone` silently returns on invalid input (length-only validation, no IANA shape check) | Warning (advisory) | WR-04 from code review. Out-of-scope for Phase 1 goal (registerUser, not updateTimezone) but noted for Phase 2. |
| `src/features/auth/actions.ts` | 56-66 | `do { ... } while (true)` slug collision loop (minor stylistic) | Info | IN-01 from code review. Works correctly; a bounded `for` loop would be clearer. Non-blocking. |
| `src/features/household/queries.ts` | 16 | Select projection omits `slug` field | Info | IN-02 from code review. Callers constructing return URLs may need to re-query. Non-blocking. |
| `prisma/schema.prisma` | 135-143 | `HealthLog` has no `@@index([plantId])` | Info | IN-03 from code review. Not used in this phase; add when queried in Phase 3+. |
| `auth.ts` | 47-52 | Inline Zod schema in authorize callback, duplicated from registerSchema/loginSchema | Info | IN-04 from code review. Minor maintainability concern. |
| `src/features/auth/schemas.ts` | 13 | `timezone: z.string().max(100).optional()` accepts any non-IANA string | Info | IN-05 from code review. Paired with WR-04; data-quality concern for Phase 3+ cycle timezone math. |
| `tests/household.test.ts` | many | Repeated `fs.readFileSync` + `await import("fs")` per test case | Info | IN-06 from code review. Not a correctness problem; performance / readability concern to refactor when Phase 2 introduces real integration tests. |

**Summary:** 4 warnings + 6 info. **Zero blockers.** All 10 findings are from 01-REVIEW.md; none prevent goal achievement. WR-01 through WR-04 should be addressed before heavy Phase 2 consumer integration but do not block Phase 1 closure.

### Human Verification Required

See the `human_verification` section in frontmatter. Three items warrant human smoke-testing before Phase 2 consumes these primitives:

1. **End-to-end signup smoke test** — Register a new user via the UI and inspect the DB for the full User + Household + HouseholdMember row set, confirm redirect to /dashboard, and check that the slug is 8 chars with no ambiguous characters.
2. **Session activeHouseholdId round-trip** — After a fresh sign-in, verify the JWT cookie / Server Component `session.user.activeHouseholdId` is populated correctly (not null/undefined when the user has a membership). Sanity-check WR-01 behavior.
3. **requireHouseholdAccess cross-module instanceof** — Once a Phase 2 consumer wires up the guard, confirm the thrown ForbiddenError still satisfies `instanceof ForbiddenError` in the error boundary (validates Object.setPrototypeOf across a real Next.js build, not just vitest's dynamic import).

### Notes

- **User action gate previously open (now resolved):** Plan 01-02 documented that `prisma migrate reset --force` required the `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` env var (Prisma 7 AI-agent safety feature). `npx prisma migrate status` during this verification returns "Database schema is up to date!" — the apply has been completed. No outstanding user action.
- **Generated client was stale at verification start:** `src/generated/prisma/models.ts` did not initially list Household/HouseholdMember/Cycle/Availability/Invitation because a branch base reset wiped the gitignored output. Running `npx prisma generate` regenerated it cleanly. Confirmed this is expected: `postinstall` rebuilds it automatically; no persistent gap.
- **88 todo tests in the full suite are all in other files** (tests that will be filled in during Phases 2, 4, 6). `tests/household.test.ts` has **zero test.todo** — all Phase 1 test scaffolding has been converted to real assertions.
- **WR-01 (JWT/Session null-vs-undefined)**: Does not fail Roadmap SC 3 because the value DOES resolve to a valid household id for any user with a membership. The type mismatch is a latent bug for code that probes for "no membership" via strict `=== undefined`, which no Phase 1 consumer does.

### Gaps Summary

No gaps prevent phase goal achievement. All 5 ROADMAP success criteria are met; all 6 requirement IDs are either SATISFIED or appropriately DEFERRED with traceability. The 10 code-review findings are advisory, not blocking.

Status is `human_needed` because end-to-end smoke tests are advisable before Phase 2 consumer code starts depending on registerUser/JWT/guard plumbing — unit tests verify source shape and mocked DB calls but cannot exercise the live NextAuth cookie pipeline or a real Prisma transaction against the flushed DB.

---

*Verified: 2026-04-16T22:45:00Z*
*Verifier: Claude (gsd-verifier)*

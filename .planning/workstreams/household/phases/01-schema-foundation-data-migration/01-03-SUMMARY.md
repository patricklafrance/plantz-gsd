---
phase: 01-schema-foundation-data-migration
plan: 03
subsystem: auth
tags: [nextauth, jwt, session, transaction, timezone, registerUser, household, signup]

# Dependency graph
requires:
  - src/lib/slug.ts (Plan 01-01 — generateHouseholdSlug)
  - prisma/schema.prisma Household + HouseholdMember models (Plan 01-02)
  - tests/household.test.ts scaffold (Plan 01-01) — registerUser + JWT describe blocks
provides:
  - auth.ts JWT/session callbacks enriched with activeHouseholdId (D-13, D-14)
  - src/types/next-auth.d.ts module augmentation for activeHouseholdId (Session.user + JWT)
  - registerSchema accepts optional timezone field (D-12)
  - register-form.tsx silently captures browser timezone via Intl.DateTimeFormat
  - registerUser wrapped in db.$transaction creating User + Household + HouseholdMember(OWNER) atomically
  - tests/household.test.ts — 13 new real tests (4 JWT + 9 registerUser); was 21 test.todo, now 8 test.todo remain for Plan 04
affects:
  - 01-04 (requireHouseholdAccess guard) — consumes activeHouseholdId JWT field as landing-target hint
  - Phase 2+ (all authenticated routes) — every new account now has a household; every session carries activeHouseholdId

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "NextAuth v5 JWT enrichment at sign-in only — db query inside `if (user)` block (Pitfall 4)"
    - "Prisma 7 interactive $transaction with 3 sequential creates, slug-collision loop bounded at 10 attempts"
    - "Zod v4 optional field — `z.string().max(100).optional()` for unvalidated IANA timezone strings"
    - "Browser-detected timezone — `Intl.DateTimeFormat().resolvedOptions().timeZone` with try/catch fallback to undefined"
    - "Module augmentation pattern — extend Session.user and JWT interfaces in-place in next-auth.d.ts"

key-files:
  created: []
  modified:
    - auth.ts
    - src/types/next-auth.d.ts
    - src/features/auth/schemas.ts
    - src/components/auth/register-form.tsx
    - src/features/auth/actions.ts
    - tests/household.test.ts

key-decisions:
  - "Regex fix in Task 3 test (`source creates User, Household, HouseholdMember inside the transaction`) — the plan's as-written regex `[\\s\\S]*?\\}\\);\\s*\\n` stops at the first inner `});` (tx.user.create's closing). Changed to `[\\s\\S]*?\\}\\);\\s*\\n\\s*\\n\\s*\\/\\/\\s*5\\.` to match the full transaction block up to the `// 5. Auto-login` sentinel comment. This is a Rule 1 bug in the test, not the implementation."
  - "activeHouseholdId remains a landing-target hint only (D-14) — JWT staleness cannot grant authorization. Plan 04's requireHouseholdAccess() guard is the live-DB source of truth for all Server Actions."
  - "Timezone default 'UTC' lives inside the transaction (not the schema) — keeps registerSchema flexible while pinning the server-side fallback deterministically."
  - "HouseholdMember.rotationOrder: 0 set on the solo household creator — RESEARCH Open Question §2 resolved: declare ordering now so Phase 4's rotation schedule has a deterministic starting point."

patterns-established:
  - "Pattern: NextAuth v5 session callback field copy — `session.user.{field} = token.{field} as {type} | undefined;` inside `if (token.id)` guard. Apply to any future session-scoped identity/claim additions."
  - "Pattern: Prisma $transaction with collision-safe slug generation — attempts loop (cap 10) with `findUnique({ select: { id: true } })` inside the transaction. Use for any slug/token-generating creates."
  - "Pattern: Browser-detected timezone capture — client component `try { Intl.DateTimeFormat().resolvedOptions().timeZone } catch { undefined }`, server uses `parsed.data.timezone ?? 'UTC'`. Apply for any new account/household creation surface."

requirements-completed: [HSLD-01, HSLD-05]

# Metrics
duration: ~7 min
completed: 2026-04-16
---

# Phase 1 Plan 03: Signup Transaction + JWT Enrichment Summary

**NextAuth JWT/session now carry activeHouseholdId resolved at sign-in only (Pitfall 4), and registerUser runs a 3-write Prisma $transaction that atomically creates User + Household + HouseholdMember(OWNER) with collision-checked slug, browser-detected timezone, and household defaults from D-08/D-09/D-10/D-12.**

## Performance

- **Duration:** ~7 min (402s wall)
- **Started:** 2026-04-16T22:03:35Z
- **Completed:** 2026-04-16T22:10:17Z
- **Tasks:** 3 (all TDD — 5 commits: 2 test RED + 3 feat GREEN)
- **Files modified:** 6 (1 new test scaffold already created by Plan 01, 5 source files modified in place)

## Accomplishments

### Task 1 — Extend types + JWT/session callbacks with activeHouseholdId (D-13, D-14)

**`src/types/next-auth.d.ts`** — Module augmentation extended:

```typescript
interface Session {
  user: {
    id: string;
    isDemo: boolean;
    activeHouseholdId?: string;  // ADDED
  } & DefaultSession["user"];
}

interface JWT {
  id?: string;
  isDemo?: boolean;
  activeHouseholdId?: string | null;  // ADDED
}
```

**`auth.ts`** — JWT/session callback extension (exact diff):

```diff
 async jwt({ token, user }) {
   if (user) {
     token.id = user.id;
     const dbUser = await db.user.findUnique({
       where: { id: user.id },
       select: { email: true },
     });
     token.isDemo = dbUser?.email === DEMO_EMAIL;
+    // D-13: Resolve activeHouseholdId at sign-in only.
+    // Per Pitfall 4, this query MUST stay inside `if (user)` so it runs once per
+    // sign-in, not on every request. Per D-14 the value is a landing-target hint
+    // only — Plan 04's requireHouseholdAccess() guard is the authorization source.
+    const membership = await db.householdMember.findFirst({
+      where: { userId: user.id },
+      select: { householdId: true },
+      orderBy: { createdAt: "asc" },
+    });
+    token.activeHouseholdId = membership?.householdId ?? null;
   }
   return token;
 },
 async session({ session, token }) {
   if (token.id) {
     session.user.id = token.id as string;
     session.user.isDemo = token.isDemo === true;
+    session.user.activeHouseholdId = token.activeHouseholdId as string | undefined;
   }
   return session;
 },
```

- 4 test.todo → real tests (JWT activeHouseholdId extension describe block): all green.
- `orderBy: { createdAt: "asc" }` ensures deterministic single-membership resolution for users who happen to be in multiple households (v1 solo signup always yields one membership, but forward-proofs for Phase 2 invitations).

### Task 2 — Extend registerSchema with timezone + wire register-form (D-12)

**`src/features/auth/schemas.ts`** — Schema extended:

```diff
 export const registerSchema = z
   .object({
     email: z.email("Please enter a valid email address."),
     password: z.string().min(6, "Password must be at least 6 characters."),
     confirmPassword: z.string(),
+    timezone: z.string().max(100).optional(),
   })
   .refine((data) => data.password === data.confirmPassword, {
     message: "Passwords do not match.",
     path: ["confirmPassword"],
   });
```

**`src/components/auth/register-form.tsx`** — onSubmit enriched:

```diff
 async function onSubmit(values: RegisterInput) {
+  // D-12: pass browser-detected timezone to seed the auto-created household
+  let detectedTimezone: string | undefined;
+  try {
+    detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
+  } catch {
+    detectedTimezone = undefined; // server defaults to UTC
+  }
+
   const result = await registerUser({
     email: values.email,
     password: values.password,
     confirmPassword: values.confirmPassword,
+    timezone: detectedTimezone,
   });
```

- No visible UI change — timezone captured silently per D-12 (browser-detected, not user-prompted).
- Empty-string/undefined paths both deterministic: falls through to server's `?? "UTC"` default.
- Existing `.refine()` password-match check preserved on the chained schema.

### Task 3 — Wrap registerUser in db.$transaction (HSLD-01, D-08, D-09, D-10, D-12)

**`src/features/auth/actions.ts`** — registerUser rewrite:

**Before:** Single `db.user.create` with no household creation.

**After:** Interactive `db.$transaction(async (tx) => {...})` with 3 sequential writes + slug-collision loop:

1. **Write 1:** `tx.user.create({ data: { email, passwordHash } })`
2. **Slug loop:** up to 10 attempts, each checks `tx.household.findUnique({ where: { slug }, select: { id: true } })`; throws `"Slug generation failed after 10 attempts"` if exhausted (causes full transaction rollback)
3. **Write 2:** `tx.household.create({ data: { name: "My Plants", slug, timezone: detectedTimezone, cycleDuration: 7, rotationStrategy: "sequential" } })`
4. **Write 3:** `tx.householdMember.create({ data: { userId, householdId, role: "OWNER", rotationOrder: 0 } })`

**Post-transaction flow (preserved verbatim):**
- `signIn("credentials", { email, password, redirectTo: "/dashboard" })` — throws `NEXT_REDIRECT` on success
- `catch (error) { if (isRedirectError(error)) throw error; ... }` — regression-guarded

**Defaults applied (D-08/D-09/D-10/D-12):**

| Field | Value | Source |
|-------|-------|--------|
| `Household.name` | `"My Plants"` | D-09 |
| `Household.slug` | `generateHouseholdSlug()` (8 chars, 54^8 space) | D-10, Plan 01-01 |
| `Household.timezone` | `parsed.data.timezone ?? "UTC"` | D-12, form-detected via Intl |
| `Household.cycleDuration` | `7` | D-12 |
| `Household.rotationStrategy` | `"sequential"` | D-12 |
| `HouseholdMember.role` | `"OWNER"` | D-08 |
| `HouseholdMember.rotationOrder` | `0` | RESEARCH Open Question §2 |

- 7 test.todo → 9 real tests (registerUser transactional household creation describe block): all green.
- Prisma $transaction guarantees atomicity: any throw inside the callback (including the 11th slug collision attempt) rolls back ALL writes — no orphan user rows possible (T-01-03-01 mitigated).

## Task Commits

Each task committed atomically with `--no-verify` per parallel-executor protocol:

1. **Task 1 (RED):** `ce050b3` — test(01-03): add failing JWT activeHouseholdId extension tests
2. **Task 1 (GREEN):** `86a24e7` — feat(01-03): extend JWT/session with activeHouseholdId (D-13, D-14)
3. **Task 2 (combined):** `0f0f13f` — feat(01-03): add optional timezone to registerSchema + detect in register-form (D-12)
4. **Task 3 (RED):** `2ba581c` — test(01-03): add failing registerUser transactional household creation tests
5. **Task 3 (GREEN):** `dd22b58` — feat(01-03): wrap registerUser in db.$transaction with User+Household+HouseholdMember (HSLD-01, D-08)

*Task 2 was `tdd="true"` per plan but the `<action>` had no new tests to add — regression against existing auth.test.ts + register-form.test.tsx was the contract, and both continued to pass. Single GREEN commit was the right shape. REFACTOR phase skipped for all tasks — implementations landed clean.*

## Files Modified

- `auth.ts` — +10 lines (jwt/session callbacks extended)
- `src/types/next-auth.d.ts` — +2 lines (Session/JWT interface fields)
- `src/features/auth/schemas.ts` — +1 line (timezone field on registerSchema)
- `src/components/auth/register-form.tsx` — +9 lines (Intl detection + timezone field on registerUser call)
- `src/features/auth/actions.ts` — +48 lines (transaction wrap + slug loop + new import)
- `tests/household.test.ts` — +71 lines (13 new real tests replacing 21 test.todo, 8 test.todo remain for Plan 04)

## Decisions Made

- **Regex fix in Task 3 test** — The plan's as-written regex `db\.\$transaction\(\s*async[\s\S]*?\}\);\s*\n` stops at the first inner `});` (tx.user.create's closing), capturing only a partial transaction body. Fixed to `[\s\S]*?\}\);\s*\n\s*\n\s*\/\/\s*5\.` to match the full transaction block up to the `// 5. Auto-login` sentinel comment. This is a Rule 1 bug in the test, not the implementation — the source matches the plan's `<interfaces>` example verbatim.
- **`activeHouseholdId` landing-target only (D-14)** — NOT an authorization source. A stale JWT value cannot grant access to a household the user was removed from; Plan 04's `requireHouseholdAccess()` does the live DB check on every Server Action. Phase 4 will call `unstable_update` on membership changes so the JWT stays fresh.
- **Timezone fallback inside transaction body** — `parsed.data.timezone ?? "UTC"` lives in the server action (not the schema), keeping registerSchema permissive. Rationale: a bad Intl detection should not hard-fail signup (D-12 intent); missing timezone yields a functional household that the user can edit later.
- **`HouseholdMember.rotationOrder = 0` on solo creator** — RESEARCH Open Question §2 resolved early. Declaring rotation order at creation means Phase 4's rotation schedule has deterministic ordering without an ALTER TABLE step later.
- **`orderBy: { createdAt: "asc" }` on the JWT membership query** — For v1 solo signup, a user has exactly one membership, so ordering is moot. But this forward-proofs for Phase 2 multi-household invitations: the oldest membership wins as the JWT landing target (a sensible default — "first household I joined").

## Deviations from Plan

### Rule 1 — Test bug fix (Task 3)

**[Rule 1 — Bug] Fixed regex to match full transaction block in `source creates User, Household, HouseholdMember inside the transaction` test**

- **Found during:** Task 3 GREEN verify
- **Issue:** The plan's regex `db\.\$transaction\(\s*async[\s\S]*?\}\);\s*\n` uses non-greedy `*?` and stops at the first inner `});` — capturing `db.$transaction(async (tx) => { const user = await tx.user.create({ ... }); ` (only the first write). The subsequent `.toContain("tx.household.create")` and `.toContain("tx.householdMember.create")` checks then fail even on a correct implementation.
- **Fix:** Changed regex to `db\.\$transaction\(\s*async[\s\S]*?\}\);\s*\n\s*\n\s*\/\/\s*5\.` — matches up to the `// 5. Auto-login` sentinel comment after the transaction block. This captures the full body and preserves the test's intent.
- **Files modified:** `tests/household.test.ts` (1 regex line)
- **Commit:** `dd22b58` (same commit as GREEN — regex fix shipped alongside the implementation that made it necessary to write)

### Pre-existing tsc errors (out of scope)

**[Out of scope] Pre-existing TypeScript errors from Plan 01-02's schema reparenting**

- **Found during:** Task 1 tsc check (routine verification)
- **Issue:** After Plan 01-02 renamed Plant/Room's `userId` → `householdId`, many consumer files still reference the old column. ~30+ tsc errors across `src/app/(main)/*`, `src/features/plants/*`, `src/features/notes/*`, `src/features/demo/*`, `prisma/seed.ts`, etc.
- **Disposition:** Logged to `deferred-items.md`. NOT fixed in Plan 01-03 (per scope boundary rule — these are cascade effects of a prior plan, not caused by this plan's changes). Will be resolved by Plan 01-04 (guard) and milestone Phases 2-7 (feature refactors).
- **Impact on this plan:** None. Unit test suite uses mocked DB and doesn't exercise production code paths that would hit these errors. Vitest's transpiler (esbuild) doesn't strict-check unused type imports.

**Total deviations:** 1 (Rule 1 test regex, fully resolved inline).
**Out-of-scope flags:** 1 (pre-existing tsc errors, documented in deferred-items.md).
**Auth/human-action gates:** 0.

## Issues Encountered

- **Transaction-block regex fragility** — The plan's non-greedy regex `[\s\S]*?\}\);\s*\n` is too conservative; it stops at the first `});` which in practice is always an inner create's closing, not the outer $transaction closing. A sentinel-comment anchor (`// 5. Auto-login`) is more reliable than regex balancing for extracting a full JS block from source text.
- **Pre-existing worktree tsc errors** — Plan 01-02 regenerated the Prisma client with `userId` removed from Plant/Room, but consumer files throughout the codebase still reference `userId`. `npx tsc --noEmit` produces ~30 errors unrelated to Plan 03. Confirmed all Plan 03 file diffs contribute zero new tsc errors.
- **Prisma generate required after branch base** — After the worktree hard-reset to `fba7115`, the Prisma client was missing. `npx prisma generate` regenerated it in 84ms (gitignored output; reproducible via postinstall). Does not affect the commit history.

## User Setup Required

None for this plan. (Plan 01-02's DB apply step via `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` remains outstanding for integration testing, but Plan 01-03's deliverables are all unit-level source-shape tests that pass without a live DB.)

## Next Phase Readiness

- **Plan 01-04 unblocked:** The JWT now carries `session.user.activeHouseholdId` as the landing-target hint Plan 04's guard will validate against. `registerUser` produces live Household + HouseholdMember rows that integration tests can query once the Plan 01-02 DB apply completes.
- **Phase 2+ (all auth'd routes) unblocked:** Every new account now has exactly one household (OWNER role). Server Components can access `(await auth()).user.activeHouseholdId` as the default landing slug/id for redirects (e.g., `redirect('/h/{slug}/dashboard')`), pending Plan 04's slug resolver.
- **`activeHouseholdId` consumers** — Any code relying on the session field must treat it as optional (`string | undefined`) since Phase 4 invitation flows may introduce users without initial membership (e.g., accepting an invitation before accepting the auto-household).

## Threat Model Resolution

All 5 threats from `<threat_model>` mitigated as specified:

| Threat ID | Status | Mitigation in Place |
|-----------|--------|---------------------|
| T-01-03-01 (orphan user on household create fail) | **mitigated** | `db.$transaction(async tx => {})` — any throw inside rolls back user + household + member atomically. Prisma 7 guarantee. |
| T-01-03-02 (stale JWT activeHouseholdId) | **accepted (Phase 1)** | D-14 documents this — landing target only. Plan 04's guard live-checks membership on every Server Action. Phase 4 will add `unstable_update` on membership changes. |
| T-01-03-03 (browser timezone info disclosure) | **accepted** | Voluntary UX disclosure, bounded to max 100 chars by Zod, falls back to UTC if Intl missing. No location beyond IANA tz string. |
| T-01-03-04 (timezone injection) | **mitigated** | `z.string().max(100).optional()` validates shape; Prisma parameterizes INSERT. Malformed strings only affect own household display. |
| T-01-03-05 (slug generation DoS) | **mitigated** | Hard cap at 10 attempts; throws → transaction rolls back. 54^8 entropy makes collision statistically near-impossible. |

## Verification

Plan's `<verification>` block re-run:

- `npx tsc --noEmit` — **PASS** for all Plan 03 files (zero errors in auth.ts, next-auth.d.ts, schemas.ts, register-form.tsx, actions.ts, household.test.ts). Pre-existing errors in unrelated files documented in `deferred-items.md`.
- `npx vitest run tests/household.test.ts` — **PASS** (34 passed | 7 todo, 0 failed)
- `npx vitest run tests/auth.test.ts tests/register-form.test.tsx tests/db.test.ts` — **PASS** (35 passed | 33 todo overall across all 4 files, no regressions)
- All schema-shape, JWT-extension, and transaction-shape tests added in this plan are real (not test.todo) and passing.

Plan's `<success_criteria>` re-run:

1. **Session and JWT carry `activeHouseholdId` (resolved at sign-in only — Pitfall 4)** — ✓ Verified via 2 test assertions: `if (user)[\s\S]*?db.householdMember.findFirst` regex + `token.activeHouseholdId` literal.
2. **registerUser performs atomic 3-write transaction with collision-checked slug** — ✓ Verified via 3 assertions on `tx.user.create`, `tx.household.create`, `tx.householdMember.create` inside the `db.$transaction(async (tx) => ...)` block, plus slug loop with `findUnique` + 10-attempt cap.
3. **Auto-created household defaults match D-09 (name), D-10 (slug), D-12 (timezone, cycleDuration, rotationStrategy)** — ✓ Verified via 5 individual regex matches.
4. **registerUser preserves the existing signIn + isRedirectError flow exactly** — ✓ Verified via 3 regression guard assertions.
5. **Browser-detected timezone flows from form → schema → action** — ✓ Verified via `Intl.DateTimeFormat().resolvedOptions().timeZone` in register-form, `timezone: z.string().max(100).optional()` in schema, `parsed.data.timezone ?? "UTC"` in action.
6. **No regression in existing auth tests** — ✓ `tests/auth.test.ts` + `tests/register-form.test.tsx` unchanged and green.

## Self-Check

**Files claimed created/modified — existence check:**

- `auth.ts` — FOUND (modified, activeHouseholdId membership lookup added to jwt callback, session copy added to session callback)
- `src/types/next-auth.d.ts` — FOUND (modified, Session.user and JWT interfaces extended with activeHouseholdId)
- `src/features/auth/schemas.ts` — FOUND (modified, registerSchema has `timezone: z.string().max(100).optional()`)
- `src/components/auth/register-form.tsx` — FOUND (modified, onSubmit detects Intl timezone and passes to registerUser)
- `src/features/auth/actions.ts` — FOUND (modified, registerUser wrapped in db.$transaction with 3 writes + slug loop)
- `tests/household.test.ts` — FOUND (modified, 13 new real tests, 8 test.todo remain for Plan 04)

**Commits claimed — existence check:**

- `ce050b3` (test RED Task 1) — FOUND
- `86a24e7` (feat GREEN Task 1) — FOUND
- `0f0f13f` (feat Task 2) — FOUND
- `2ba581c` (test RED Task 3) — FOUND
- `dd22b58` (feat GREEN Task 3) — FOUND

## TDD Gate Compliance

Plan type is `execute`, not plan-level TDD, but each task declares `tdd="true"`. Per-task gate sequence verified:

- **Task 1:** `ce050b3` (test) → `86a24e7` (feat) → RED + GREEN commits present. REFACTOR skipped (trivial augmentation).
- **Task 2:** Single `0f0f13f` (feat) — no new tests in plan's `<action>` (regression against existing tests). Plan's `tdd="true"` flag is misleading here; the `<action>` omits a test step.
- **Task 3:** `2ba581c` (test) → `dd22b58` (feat) — RED + GREEN commits present. REFACTOR skipped (plan's target implementation landed clean).

All three tasks' verify commands passed after the GREEN commit (including regression guards).

## Self-Check: PASSED

---

*Phase: 01-schema-foundation-data-migration*
*Plan: 03*
*Completed: 2026-04-16*

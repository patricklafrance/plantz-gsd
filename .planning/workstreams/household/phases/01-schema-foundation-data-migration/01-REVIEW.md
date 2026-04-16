---
phase: 01-schema-foundation-data-migration
reviewed: 2026-04-16T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - auth.ts
  - prisma/migrations/20260416175000_init/migration.sql
  - prisma/schema.prisma
  - src/components/auth/register-form.tsx
  - src/features/auth/actions.ts
  - src/features/auth/schemas.ts
  - src/features/household/guards.ts
  - src/features/household/queries.ts
  - src/features/household/schema.ts
  - src/lib/slug.ts
  - src/types/next-auth.d.ts
  - tests/household.test.ts
  - tests/slug.test.ts
findings:
  critical: 0
  warning: 4
  info: 6
  total: 10
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-04-16
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Phase 1 (schema foundation + data migration) delivers a solid Prisma schema, migration, auth/registration flow, and household guards. Decision-to-implementation traceability (D-08, D-10, D-12, D-13, D-16..D-20) is excellent — the inline comments explicitly tie every non-trivial line back to planning artifacts, and the self-test coverage in `tests/household.test.ts` is thorough.

No critical security or correctness issues were found. The concerns below are mostly about type-safety consistency, coupling to Next.js internals, and a few places where defense-in-depth would strengthen the code:

- A JWT-to-session type mismatch (`string | null` vs `string | undefined`) that TypeScript masks with `as`.
- A deep import into Next.js private internals (`next/dist/...`) which tends to break across versions.
- Unvalidated role narrowing at the DB boundary in `guards.ts`.
- Timezone string accepted from clients with only length validation (not IANA-shape).

None of the findings block merging; all can be addressed in follow-up PRs. I recommend tackling WR-01 and WR-02 before the guard starts being consumed by Phase 2+ callers.

## Warnings

### WR-01: JWT/Session `activeHouseholdId` type mismatch hidden by `as` assertion

**File:** `auth.ts:39`
**Issue:** `next-auth/jwt` declares `activeHouseholdId?: string | null` (nullable), but `next-auth`'s `Session.user.activeHouseholdId?: string` (non-nullable). The session callback launders the type with `token.activeHouseholdId as string | undefined`, so when the user has no membership (`token.activeHouseholdId === null`), the session receives the string `"null"`-able slot typed as `string | undefined`, but the actual runtime value is `null`. Any consumer doing a truthy check is safe, but a consumer doing `if (session.user.activeHouseholdId === undefined)` will get false for a user with no household, which is a bug the types hide.
**Fix:** Normalize to a single representation. Either (a) store `undefined` in the token when there's no membership, or (b) widen the Session type to `string | null | undefined` to match reality.
```ts
// Option A — auth.ts jwt callback:
token.activeHouseholdId = membership?.householdId; // drop the `?? null`

// Option B — src/types/next-auth.d.ts:
activeHouseholdId?: string | null;
```

### WR-02: Deep import into Next.js internal path `next/dist/client/components/redirect-error`

**File:** `src/features/auth/actions.ts:9`
**Issue:** `isRedirectError` is imported from `next/dist/client/components/redirect-error`. This is not a stable public API — Next.js frequently restructures `dist/` paths between minors (the 15 → 16 upgrade path renamed several internals). A silent rename will compile (TS resolves the path), then break redirect handling at runtime, causing the `catch` block to treat redirects as failures and return a generic error toast to the user who actually did register successfully.
**Fix:** Use the supported entry point. Next.js 14+ re-exports `isRedirectError` from `next/navigation`:
```ts
import { isRedirectError } from "next/navigation";
```
If that path is not available in the installed Next.js 16 build, add a runtime-based guard instead of the deep import:
```ts
function isRedirectError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.startsWith("NEXT_REDIRECT")
  );
}
```

### WR-03: `member.role as "OWNER" | "MEMBER"` trusts DB content blindly

**File:** `src/features/household/guards.ts:49`
**Issue:** The `role` column is a free-form `String` in the schema (schema.prisma:63), not an enum. The guard casts the DB value to the narrow `"OWNER" | "MEMBER"` union without validation. If a DB row contains `"ADMIN"` (e.g. migrated from another system, or a future expansion that forgets to update the guard), the assertion silently produces a `role` that TypeScript believes is safe to switch on — downstream code in Phase 6 "settings" will make incorrect authorization decisions.
**Fix:** Validate with the existing `householdRoleSchema` (already defined in `src/features/household/schema.ts`, imported from `zod/v4`):
```ts
import { householdRoleSchema } from "./schema";

const roleResult = householdRoleSchema.safeParse(member.role);
if (!roleResult.success) {
  throw new ForbiddenError("Invalid role state");
}
return {
  household: member.household,
  member,
  role: roleResult.data,
};
```

### WR-04: `updateTimezone` silently swallows invalid input

**File:** `src/features/auth/actions.ts:110`
**Issue:** `updateTimezone` returns silently (no error, no logging) when the session is missing, the user is demo, or the timezone is invalid. A bug in the caller that passes `undefined` or an empty string will be indistinguishable from the demo-user-short-circuit case. Combined with the length-only validation (`timezone.length > 100`), any non-IANA string under 100 chars will be happily written to the DB, which can confuse downstream travel-detection code in later phases.
**Fix:** (a) Return a discriminated result so the caller can tell what happened; (b) Validate IANA shape before writing. `Intl.supportedValuesOf('timeZone')` is Node 18+:
```ts
const validTimezones = new Set(Intl.supportedValuesOf("timeZone"));
if (!validTimezones.has(timezone)) {
  return { skipped: "invalid-timezone" };
}
```
If the IANA whitelist is too heavy, at minimum require a `/` in the input (`"America/Toronto"`) and log a warning when the regex fails.

## Info

### IN-01: Slug collision loop uses `do { ... } while (true)` with dual exit conditions

**File:** `src/features/auth/actions.ts:56-66`
**Issue:** The loop mixes an `if (!existing) break` early-exit and an `if (++attempts > 10) throw`. It works, but reads harder than necessary and the `break` before the `attempts` check means a successful generation on attempt 11+ is still counted against the throw threshold. Minor stylistic concern, no bug.
**Fix:** A bounded `for` loop is clearer:
```ts
let slug: string | undefined;
for (let attempt = 0; attempt < 10; attempt++) {
  const candidate = generateHouseholdSlug();
  const existing = await tx.household.findUnique({
    where: { slug: candidate },
    select: { id: true },
  });
  if (!existing) { slug = candidate; break; }
}
if (!slug) throw new Error("Slug generation failed after 10 attempts");
```

### IN-02: `resolveHouseholdBySlug` omits the `slug` in its select

**File:** `src/features/household/queries.ts:13-18`
**Issue:** Returns `{ id, name }`. Callers that need to construct a URL back to the household (`/h/${slug}`) will have to re-fetch the household or propagate the slug separately from the original `params.householdSlug`. Not a bug — the current signature is usable — but the API will likely grow a second query soon.
**Fix:** Add `slug: true` to the select, since we already know the slug (it's the unique index we just queried), and it costs nothing:
```ts
select: { id: true, name: true, slug: true },
```

### IN-03: `HealthLog` lacks an index on `plantId`

**File:** `prisma/schema.prisma:135-143` and `prisma/migrations/20260416175000_init/migration.sql:102-111`
**Issue:** `Note` has `@@index([plantId])` (schema.prisma:132) and `WateringLog` has the functional `(plantId, day)` unique index. `HealthLog.plantId` has a FK but no dedicated index. Any future "show me all health logs for this plant" query will fan-scan. Per project CLAUDE.md, performance issues are explicitly out of scope for v1 review, so filing this as info rather than warning.
**Fix:** Add `@@index([plantId])` to the `HealthLog` model when it gets used in Phase 3+.

### IN-04: `authorize` callback defines its Zod schema inline on every sign-in

**File:** `auth.ts:47-52`
**Issue:** The credentials-validation schema is rebuilt on every call. It also duplicates the `registerSchema` / `loginSchema` constraints in `src/features/auth/schemas.ts` (email format + min length 6) but uses `.min(6)` here vs. `.min(1)` in `loginSchema` — the inconsistency is intentional (registration needs length 6, login only needs non-empty so legacy users with shorter passwords can still sign in), but an inline schema makes that intent invisible.
**Fix:** Extract a module-level `credentialsAuthorizeSchema` next to the callback, or import `loginSchema` from `./src/features/auth/schemas` and reuse it. Pairs well with a comment: `// accepts any non-empty password — registration-time length rules enforced separately`.

### IN-05: `timezone` accepted via registration is stored verbatim without IANA validation

**File:** `src/features/auth/actions.ts:38`, `src/features/auth/schemas.ts:13`
**Issue:** `registerSchema` validates `z.string().max(100)` only. A forged request (any attacker-controlled client) can write `"not-a-real-zone"` into `Household.timezone`. Paired with WR-04, this means the `timezone` column on both `User` and `Household` can hold garbage. Downstream date-arithmetic (cycle start/end rendering, watering day calculations) will silently fall back to UTC or throw at runtime. Not a security issue (no injection), but a data-quality one.
**Fix:** Tighten the schema:
```ts
timezone: z.string()
  .regex(/^[A-Za-z_]+\/[A-Za-z_+\-0-9]+$/, "Invalid IANA timezone")
  .max(100)
  .optional(),
```
Or use `Intl.supportedValuesOf('timeZone')` as a whitelist (same approach as WR-04).

### IN-06: Tests use repeated `fs.readFileSync` + dynamic import pattern per test case

**File:** `tests/household.test.ts` (multiple tests)
**Issue:** Every test block re-opens `prisma/schema.prisma`, `auth.ts`, or `src/features/auth/actions.ts` via `fs.readFileSync` and `await import("fs")`. Not a correctness problem — and the dynamic imports are deliberately used so the `vi.mock` declarations at the top take effect — but the dozens of repeated reads slow the test suite and make it harder to spot when a test is actually asserting behavior vs. asserting source text.
**Fix:** Hoist file reads into a `beforeAll` or a shared const for the schema/source-text assertions, and consider tagging "source-text" assertions as a separate describe block from runtime-behavior assertions so it's obvious which tests are regression guards vs. integration tests. No rush — current code is fine and will be refactored naturally as Phase 2 adds real integration tests.

---

_Reviewed: 2026-04-16_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

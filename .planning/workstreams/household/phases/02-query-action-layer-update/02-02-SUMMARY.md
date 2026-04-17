---
phase: "02-query-action-layer-update"
plan: "02"
subsystem: household
tags: [server-action, transaction, household, hsld-02, hsld-03, isDefault, tdd, wave-2]
dependency_graph:
  requires:
    - "02-01-SUMMARY.md (HouseholdMember.isDefault migration, Wave 0 test scaffolds)"
    - "01-04-SUMMARY.md (generateHouseholdSlug, resolveHouseholdBySlug)"
  provides:
    - "createHousehold Server Action (plan 03, phase 6 settings form, phase 7 demo seed)"
    - "getUserHouseholds query (phase 6 household switcher)"
    - "createHouseholdSchema Zod v4 schema (phase 6 form binding)"
    - "registerUser isDefault: true backfill (Q7 — signup household is user default)"
  affects:
    - "src/features/household/ — new actions.ts entry point"
    - "src/features/household/queries.ts — getUserHouseholds appended"
    - "src/features/household/schema.ts — createHouseholdSchema appended"
    - "src/features/auth/actions.ts — registerUser tx.householdMember.create gains isDefault: true"
tech_stack:
  added: []
  patterns:
    - "db.$transaction with slug collision loop — mirrors auth/actions.ts registerUser pattern"
    - "TDD RED/GREEN: test.todo scaffold → failing real tests → passing implementation"
    - "Zod v4 safeParse as action input gate (createHouseholdSchema)"
key_files:
  created:
    - "src/features/household/actions.ts"
  modified:
    - "src/features/household/queries.ts (getUserHouseholds appended, resolveHouseholdBySlug preserved)"
    - "src/features/household/schema.ts (createHouseholdSchema + CreateHouseholdInput appended)"
    - "src/features/auth/actions.ts (isDefault: true added to registerUser tx.householdMember.create)"
    - "tests/household-create.test.ts (5 test.todo converted to real tests)"
    - "tests/household-list.test.ts (3 test.todo converted to real tests)"
decisions:
  - "createHousehold does NOT call requireHouseholdAccess — creating a new household has no existing membership to verify; session + demo + Zod parse are the sole precondition gates (per D-04 / plan threat model)"
  - "isDefault write semantics: registerUser = true (signup household is user default per Q7); createHousehold = false (secondary household must not override existing default)"
  - "getUserHouseholds has no authz wrapper — caller (Phase 6) MUST pass session.user.id, never a userId from URL/form (documented in JSDoc per T-02-02-04)"
  - "HSLD-02 and HSLD-03 are data-layer-complete; UI surface deferred to Phase 6 (settings form + household switcher)"
metrics:
  duration: "~5 minutes"
  completed: "2026-04-17"
  tasks_completed: 2
  files_created: 1
  files_modified: 5
---

# Phase 02 Plan 02: createHousehold + getUserHouseholds Summary

**One-liner:** TDD RED/GREEN — createHousehold $transaction Server Action + getUserHouseholds query + createHouseholdSchema Zod v4 schema + registerUser isDefault: true backfill.

## What Was Built

### Task 1 — RED phase: convert test.todos to failing real tests

All 8 `test.todo` scaffolds from Plan 02-01 converted to real failing tests:

**`tests/household-create.test.ts`** (5 tests — all RED as expected):
1. Creates Household + OWNER HouseholdMember in a single `$transaction`
2. Slug collision loop throws after 10 attempts
3. Returns `{ error: "Not authenticated." }` when no session
4. Returns demo-mode error when `session.user.isDemo`
5. New createHousehold membership has `isDefault: false` (secondary household)

**`tests/household-list.test.ts`** (3 tests — all RED as expected):
1. Returns `{ household, role, isDefault, joinedAt }` array sorted by joinedAt asc
2. Returns empty array when user has no memberships
3. Preserves role field across OWNER and MEMBER rows

RED failures were exactly the two expected modes:
- `household-create.test.ts`: "Failed to resolve import @/features/household/actions" (file not yet created)
- `household-list.test.ts`: "getUserHouseholds is not a function" (not yet exported from queries.ts)

### Task 2 — GREEN phase: implement the four artifacts

**`src/features/household/actions.ts`** (new file, 82 lines):

```typescript
export async function createHousehold(data: unknown): Promise<
  { success: true; household: Household } | { error: string }
>
```

Seven-step shape (D-12 minus step 4 — no requireHouseholdAccess for new-household creation):
1. `auth()` → return `{ error: "Not authenticated." }` if no session
2. Demo guard → return `{ error: "Demo mode — sign up to save your changes." }` if `isDemo`
3. `createHouseholdSchema.safeParse(data)` → return `{ error: "Invalid input." }` on failure
4. (skipped — no existing membership to verify)
5+6. `db.$transaction` → slug collision loop (bounded at 10 attempts) → `tx.household.create` → `tx.householdMember.create({ isDefault: false, role: "OWNER", rotationOrder: 0 })`
7. Returns `{ success: true, household }` (no revalidatePath — no UI consumer in Phase 2)

**`src/features/household/queries.ts`** (extended):

```typescript
export async function getUserHouseholds(userId: string): Promise<
  Array<{ household: Household; role: "OWNER" | "MEMBER"; isDefault: boolean; joinedAt: Date }>
>
```

- `db.householdMember.findMany({ where: { userId }, include: { household: true }, orderBy: { createdAt: "asc" } })`
- Maps to `{ household, role, isDefault, joinedAt: m.createdAt }`
- `resolveHouseholdBySlug` preserved verbatim (Plan 01 export)

**`src/features/household/schema.ts`** (extended):

```typescript
export const createHouseholdSchema = z.object({
  name: z.string().min(1, "Household name is required.").max(80),
  timezone: z.string().optional(),
});
export type CreateHouseholdInput = z.infer<typeof createHouseholdSchema>;
```

Phase 1 exports `householdRoleSchema` and `rotationStrategySchema` preserved verbatim.

**`src/features/auth/actions.ts`** (1-line addition):

```typescript
// registerUser tx.householdMember.create — before:
{ userId: user.id, householdId: household.id, role: "OWNER", rotationOrder: 0 }

// after (Q7 backfill):
{ userId: user.id, householdId: household.id, role: "OWNER", rotationOrder: 0, isDefault: true }
```

## isDefault Write Semantics

| Site | isDefault value | Rationale |
|------|-----------------|-----------|
| `registerUser` (auth/actions.ts) | `true` | Signup creates the user's first and only household — it is by definition the default (Q7) |
| `createHousehold` (household/actions.ts) | `false` | Secondary households do not override the existing default; user explicitly switches default via Phase 6 HSET-02 |

## HSLD-02 / HSLD-03 Satisfaction Status

| Requirement | Status | Notes |
|-------------|--------|-------|
| HSLD-02: User can create additional households | Data layer complete | `createHousehold` action callable and tested; UI form deferred to Phase 6 |
| HSLD-03: User can view list of households with role | Data layer complete | `getUserHouseholds` query callable and tested; UI switcher deferred to Phase 6 |

Both requirements are **partially satisfied** — data layer complete, UI deferred to Phase 6. REQUIREMENTS.md traceability should record "data-layer satisfied in Phase 2; UI satisfied in Phase 6" rather than marking complete now.

## Test Counts

| File | Real tests | test.todo remaining |
|------|-----------|---------------------|
| `tests/household-create.test.ts` | 5 | 0 |
| `tests/household-list.test.ts` | 3 | 0 |
| **Total** | **8** | **0** |

All 8 tests pass GREEN after implementation.

## Exported Function Signatures (Plan 03 + Phase 6 Reference)

```typescript
// src/features/household/actions.ts
export async function createHousehold(data: unknown):
  Promise<{ success: true; household: Household } | { error: string }>

// src/features/household/queries.ts
export async function resolveHouseholdBySlug(slug: string):
  Promise<{ id: string; name: string } | null>

export async function getUserHouseholds(userId: string):
  Promise<Array<{ household: Household; role: "OWNER" | "MEMBER"; isDefault: boolean; joinedAt: Date }>>

// src/features/household/schema.ts
export const createHouseholdSchema: ZodObject<{ name: ZodString; timezone: ZodOptional<ZodString> }>
export type CreateHouseholdInput = { name: string; timezone?: string }
export const householdRoleSchema: ZodEnum<["OWNER", "MEMBER"]>   // preserved from Phase 1
export const rotationStrategySchema: ZodEnum<["sequential"]>      // preserved from Phase 1
```

## Threat Model Coverage

All T-02-02-0x mitigations from the plan's threat register are implemented:

| Threat ID | Status |
|-----------|--------|
| T-02-02-01 (EoP — no requireHouseholdAccess) | Mitigated: session guard + userId from session only, never from data arg |
| T-02-02-02 (Tampering — mass assignment) | Mitigated: createHouseholdSchema gates name/timezone only; slug/cycleDuration/rotationStrategy hard-coded |
| T-02-02-03 (DoS — slug collision loop) | Mitigated: `if (++attempts > 10) throw` at line 48; throw propagates out of $transaction |
| T-02-02-04 (InfoDisc — getUserHouseholds caller) | Mitigated: JSDoc documents caller must pass session.user.id |
| T-02-02-05 (Repudiation) | Accepted: no createdByUserId on Household; derivable via earliest OWNER membership |
| T-02-02-06 (InfoDisc — demo user) | Mitigated: isDemo guard verbatim on line 27-29 |

## Deviations from Plan

None — plan executed exactly as written. Both tasks followed the exact code templates specified in the plan's `<action>` blocks. All acceptance criteria met.

## Commits

| Task | Hash | Message |
|------|------|---------|
| Task 1 (RED) | 1f24047 | test(02-02): RED phase — convert household-create and household-list test.todos to failing real tests |
| Task 2 (GREEN) | 366f5fa | feat(02-02): GREEN phase — createHousehold action, getUserHouseholds query, createHouseholdSchema, registerUser isDefault |

## Self-Check: PASSED

- `src/features/household/actions.ts` — EXISTS
- `src/features/household/queries.ts` — EXISTS (getUserHouseholds appended, resolveHouseholdBySlug preserved)
- `src/features/household/schema.ts` — EXISTS (createHouseholdSchema appended, Phase 1 exports preserved)
- `src/features/auth/actions.ts` — EXISTS (isDefault: true present)
- `tests/household-create.test.ts` — EXISTS (5 real tests, 0 test.todo)
- `tests/household-list.test.ts` — EXISTS (3 real tests, 0 test.todo)
- Commits 1f24047, 366f5fa — PRESENT in git log
- `npx vitest run tests/household-create.test.ts tests/household-list.test.ts` — 8/8 PASSED
- `npx tsc --noEmit` — 0 errors in target files

# Phase 2: Query + Action Layer Update - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 02-CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-16
**Phase:** 02-query-action-layer-update
**Workstream:** household
**Areas discussed:** Household plumbing strategy, HSLD-02/03 delivery surface, Reminders signature for Phase 5, Cross-household isolation tests

---

## Gray area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Household plumbing strategy | URL prefix timing, current-household source, Server Action contract | ✓ |
| HSLD-02/03 delivery surface | What Phase 2 ships for create/list households (actions-only vs UI) | ✓ |
| Reminders signature for Phase 5 | Coordination of getReminderCount / getReminderItems shape | ✓ |
| Cross-household isolation tests | Depth and shape of tests proving Pitfall 1 isolation | ✓ |

**User's choice:** All four.

---

## Area 1: Household plumbing strategy

### Q1.1 — URL layer timing

| Option | Description | Selected |
|--------|-------------|----------|
| Defer URL to Phase 6 | Current routes unchanged; pages read `session.user.activeHouseholdId` | |
| Ship `/h/[slug]/` URL prefix now | Move all (main) routes; URL-driven household resolution | ✓ |
| Hybrid: keep URLs, add slug to forms | Pages stay; actions take slug/id — awkward middle | |

**User's choice:** Ship URL prefix now.
**Notes:** Elevates this from ROADMAP Phase 6 (HSET-01) intent to keep query/action migration and route move aligned.

### Q1.2 — Route migration approach

| Option | Description | Selected |
|--------|-------------|----------|
| Move all (main) routes under `/h/[slug]/` | One clean cut-over; legacy paths redirect | ✓ |
| Additive: new /h/ alongside legacy | Both live; removed in Phase 6 | |
| Cherry-pick — auth-only routes move | Some slug-scoped, some not | |

**User's choice:** Move all (main) routes.

### Q1.3 — Guard invocation site

| Option | Description | Selected |
|--------|-------------|----------|
| Layout.tsx + React `cache()` | Single chokepoint, cached result, no repeat queries | ✓ (after middleware question resolved) |
| Every page.tsx + every Server Action | Most explicit; redundant DB round-trips | |
| Layout only; Server Actions trust it | Breaks Pitfall 16 | |

**User's first response:** "Isn't there a middleware or something that could be leverage for this guard?" (via Other)

**Claude's response (plain text):**
- proxy.ts is edge-runtime; cannot return the rich `{ household, member, role }` the guard promises
- Auth.js v5 guidance: middleware is for optimistic session checks; real authz in Server Components/Actions
- DB-backed membership check at edge would require `@prisma/adapter-pg` or JWT-cached memberships (latter violates D-14/D-18)
- Layout-based guard with React `cache()` gives the "called once per request" property middleware would provide, inside the Node runtime where Prisma lives

**User's final choice:** Layout.tsx + React `cache()` (Recommended).

### Q1.4 — Server Action household-context contract

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit `householdId` hidden form field | Most auditable; grep-friendly | ✓ |
| Derive from entity (plantId → plant.householdId) | Saves input; extra query before authz | |
| Slug in URL action path | `/h/[slug]/action/...`; multiplies files | |
| Mix: hidden-field + entity-derive | Two patterns, each where it fits | |

**User's choice:** Explicit hidden form field.

---

## Area 2: HSLD-02/03 delivery surface

### Q2.1 — Create-household delivery

| Option | Description | Selected |
|--------|-------------|----------|
| Action only, no UI in Phase 2 | Integration tests only; Phase 6 wires UI | ✓ |
| Action + minimal `/account/households/new` form | Ugly interim UI | |
| Action + inline form on `/h/[slug]/settings` stub | Risks Phase 6 rewrite | |

**User's choice:** Action only.

### Q2.2 — List-my-households delivery

| Option | Description | Selected |
|--------|-------------|----------|
| Query only (`getUserHouseholds`) + integration test | Phase 6 is the consumer | ✓ |
| Query + minimal list page | Ugly interim UI | |
| Skip dedicated query; derive at call time in Phase 6 | Breaks Pitfall 13 spirit | |

**User's choice:** Query only + integration test.

---

## Area 3: Reminders signature for Phase 5

### Q3.1 — Signature coordination

| Option | Description | Selected |
|--------|-------------|----------|
| Signature-stable: `getReminderCount(householdId)` | Phase 5 modifies body only | ✓ |
| Explicit optional `assigneeUserId?` param | Caller-aware; early exposure | |
| Pair functions (household + assignee) | Churns dashboard twice | |

**User's choice:** Signature-stable.

### Q3.2 — Phase 2 reminder behavior before Cycle gate

| Option | Description | Selected |
|--------|-------------|----------|
| Every member sees household-level count | Time-boxed false positives until Phase 5 | ✓ |
| Only OWNER sees reminders until Phase 5 | Rule Phase 5 must rewrite | |
| Disable reminder surface entirely | Lost functionality for several phases | |

**User's choice:** Every member sees household-level count.

---

## Area 4: Cross-household isolation tests

### Q4.1 — Cross-household read test depth

| Option | Description | Selected |
|--------|-------------|----------|
| Integration tests on all 5 entities (real Prisma) | Highest confidence | |
| Integration on reads, unit on action throws | Split | |
| Unit tests with mocked Prisma throughout | Verifies filter construction; trusts Prisma | ✓ |

**User's choice:** Unit tests with mocked Prisma throughout.
**Notes:** Paired with the "every mutating action" Forbidden coverage below for defense-in-depth; bets on Prisma's WHERE reliability.

### Q4.2 — Server Action Forbidden coverage

| Option | Description | Selected |
|--------|-------------|----------|
| Every mutating action in scope | ~13 targeted Forbidden tests | ✓ |
| One per feature area | 5 representative tests | |
| Guard-level only; trust wiring | Lightest; relies on code review | |

**User's choice:** Every mutating action.

---

## Claude's Discretion

The following are left open in CONTEXT.md §decisions §"Claude's Discretion":
- React `cache()` helper location/name
- Legacy-path redirect implementation (single layout vs per-segment page)
- Null/undefined `activeHouseholdId` fallback at login and legacy-path redirect
- Login post-auth landing target mechanism (auth.config.ts vs client nav)
- `updateTimezone` audit — user-level vs household-level timezone coexistence
- Test-file organization (one cross-household file vs per-feature)
- Whether to opportunistically address Phase 1 advisory warnings (WR-01, WR-03, WR-04) during consumer wiring

## Deferred Ideas

See CONTEXT.md §deferred — includes Phase 5/6/7 scope items (switcher UI, default-household selection, assignee gate, demo-household seeding) plus rejected alternatives (real-DB integration tests, entity-derive contract, legacy path cleanup).

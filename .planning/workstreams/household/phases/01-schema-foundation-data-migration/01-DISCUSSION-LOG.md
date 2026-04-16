# Phase 1: Schema Foundation + Data Migration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-16
**Phase:** 01-schema-foundation-data-migration
**Workstream:** household
**Areas discussed:** Schema scope, Migration strategy, Slug & naming defaults, Guard helper shape

---

## Schema scope

### Which models land in Phase 1?

| Option | Description | Selected |
|--------|-------------|----------|
| All 5 models, shape-complete (Recommended) | Household + HouseholdMember + Cycle + Availability + Invitation declared now with final fields and indexes. Behavior in feature phases. | ✓ |
| Minimum gate (2 models) | Only Household + HouseholdMember. Phase 3 adds Cycle + Availability. Phase 4 adds Invitation. | |
| Gradual (2 + 2 + 1) | Explicit incremental cadence across phases 1, 3, 4. | |

**User's choice:** All 5 models, shape-complete.
**Notes:** Single migration, indexes declared at source, Phase 3/4 only add behavior.

### Cycle field completeness

| Option | Description | Selected |
|--------|-------------|----------|
| Final field set now (Recommended) | anchorDate, cycleDuration, member-order snapshot, assignedUserId, status enum, cycleNumber. | ✓ |
| Minimal placeholder | id + householdId + createdAt only; Phase 3 adds real columns. | |

**User's choice:** Final field set now.

---

## Migration strategy

### Backfill mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Eager SQL inside migration (Recommended) | Prisma migration runs: add nullable → INSERT Household + HouseholdMember per User + UPDATE Plant/Room.householdId → flip NOT NULL. | |
| Lazy per-user on first login | Columns stay nullable; auth callback creates household per user on first sign-in. Follow-up migration flips NOT NULL later. | |
| Eager SQL + lazy fallback | Eager path plus belt-and-suspenders auth-callback repair. | |
| **Flush production DB, start clean** | User-provided alternative via "Other". | ✓ |

**User's choice:** Flush production data. No backfill. Schema ships `NOT NULL` from day one.
**Notes:** User explicitly said "I don't mind dumping the current production database and start over."

### Failure mode

| Option | Description | Selected |
|--------|-------------|----------|
| Fail-fast, roll back whole migration (Recommended) | Transactional wrap, deploy fails loud on any problem row. | |
| Log + continue, leave problem rows null | Per-row error tolerance. | |
| **Flush current production** | User-provided via "Other". | ✓ |

**User's choice:** Flush — failure-mode question moot after backfill is eliminated.

### Confirmation gate

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, flush and ship clean (Recommended given intent) | De-scope HSLD-04, ship clean schema with NOT NULL columns. | ✓ |
| Flush prod, but keep HSLD-04 as demo seed regeneration | Reinterpret HSLD-04 as demo-seed requirement. | |
| Wait — reconsider | Reopen the eager/lazy question. | |

**User's choice:** Flush and ship clean. HSLD-04 formally de-scoped.

---

## Slug & naming defaults

### Default household name

| Option | Description | Selected |
|--------|-------------|----------|
| 'My Plants' (fixed) (Recommended) | Every solo household starts as 'My Plants'. Renamable in settings. | ✓ |
| '{First name or email local}'s Plants' | Derived from User.name/email. | |
| Prompted in onboarding | New field in signup/first-login flow. | |

**User's choice:** 'My Plants' (fixed).

### Slug shape (first pass)

| Option | Description | Selected |
|--------|-------------|----------|
| Slugify name + numeric suffix, immutable (Recommended) | 'my-plants', 'my-plants-2', etc. No redirect infra. | |
| Slugify name + random suffix, immutable | 'my-plants-a7k2'. | |
| Slugify name, editable with redirect table | Slug change supported with HouseholdSlugHistory. | |
| **Random-only suffix (no name prefix)** | User-provided via "Other". | ✓ |

**User's choice:** Random-only — user noted that "My Plants" would collide for every user, making the numeric suffix strategy ugly.

### Slug format (follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| 8-char base32 (/h/a7k2n9x3/) (Recommended) | crypto.randomBytes(5) → base32url. Unambiguous, ~1 trillion values. | ✓ |
| 6-char base32 (/h/a7k2n9/) | Shorter, still plenty of space. | |
| CUID-style full id (/h/clxy9k2.../) | Use Household.id directly. | |

**User's choice:** 8-char base32.

### Slug editability

| Option | Description | Selected |
|--------|-------------|----------|
| No — slug is immutable (Recommended) | Name changes are cosmetic. | ✓ |
| Editable in settings with redirect table | HouseholdSlugHistory + proxy.ts redirect. | |

**User's choice:** Immutable.

---

## Guard helper shape

### Where guard lives + return shape

| Option | Description | Selected |
|--------|-------------|----------|
| features/household/guards.ts, rich return (Recommended) | requireHouseholdAccess(id) → { household, member, role }. Co-located with domain. | ✓ |
| lib/auth-guard.ts, thin return | Returns role string only; callers re-query. | |
| features/household/guards.ts, membership-only + separate loader | Two-call pattern. | |

**User's choice:** features/household/guards.ts, rich return.

### Input resolution

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit householdId arg, verified against JWT (Recommended) | Callers pass id (from URL slug). Guard always hits DB for membership. | ✓ |
| Implicit from JWT activeHouseholdId | Read from session directly. Violates Pitfall 16. | |
| From URL context (via next/headers) | Couples to Next.js request scope. | |

**User's choice:** Explicit arg with live DB check. JWT's activeHouseholdId is a landing target, not a permission source.

### Failure mode

| Option | Description | Selected |
|--------|-------------|----------|
| Throw custom ForbiddenError (Recommended) | Custom error class; error.tsx converts to 403. | ✓ |
| Return null; caller handles | Explicit but verbose. | |
| notFound() — 404 instead of 403 | Privacy-preserving but semantically wrong. | |

**User's choice:** Throw ForbiddenError.

---

## Claude's Discretion

Items left to downstream planning/execution:
- Exact `ForbiddenError` class shape
- Location of `resolveHouseholdBySlug` helper (likely `features/household/queries.ts`)
- Prisma middleware vs hand-written assertion helper for Pitfall 1 dev-time checks
- Timing of `HouseholdMember.rotationOrder` column (Phase 1 vs Phase 3) — recommended Phase 1 for shape-completeness

## Deferred Ideas

- Slug editability with redirect table — considered, rejected
- Personalized default household name — considered, rejected
- Lazy per-user auto-migration — moot after flush decision
- JWT re-issue on every membership change — unnecessary with live-DB guard
- HSLD-04 (v1 user auto-migration) as an active requirement — de-scoped for this milestone
- Prisma middleware for Pitfall 1 enforcement — may land Phase 1 or Phase 2 audit

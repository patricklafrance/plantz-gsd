# Phase 1: Schema Foundation + Data Migration - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning
**Workstream:** `household`

<domain>
## Phase Boundary

Lay down the complete multi-household Prisma schema (5 new models), ship the on-signup auto-household creation path, extend the NextAuth JWT with `activeHouseholdId`, and deliver the `requireHouseholdAccess()` membership guard — so Phase 2 can swap every query and action from `userId` to `householdId` ownership without writing to a moving target.

**Explicitly not in this phase:** CRUD actions and UI for households, invitations, rotation, or availability (owned by Phases 2, 3, 4, 6). Schema shape for those models ships here; behavior ships in their feature phases.

</domain>

<decisions>
## Implementation Decisions

### Schema scope
- **D-01:** Declare all 5 household models in a single Phase 1 migration, shape-complete: `Household`, `HouseholdMember`, `Cycle`, `Availability`, `Invitation`. No behavior for Cycle/Availability/Invitation ships here — only the tables, columns, relations, and indexes.
- **D-02:** `Cycle` model carries its final field set from day one: `anchorDate`, `cycleDuration` (int days), member-order snapshot, `assignedUserId`, `status` enum, `cycleNumber` for race-safety uniqueness. Phase 3 writes the engine behavior against this stable schema.
- **D-03:** Composite indexes declared explicitly in the schema: `@@index([householdId, archivedAt])` on `Plant`, `@@index([householdId, status])` on `Cycle`, `@@index([householdId])` on `Room` (Pitfall 3). WateringLog gets a DB-level unique on `(plantId, date_trunc('day', wateredAt))` (Pitfall 15).
- **D-04:** `Plant → User` and `Room → User` relations change from `onDelete: Cascade` to `onDelete: SetNull` on the `createdByUserId` audit column. The ownership relation becomes `Plant → Household` / `Room → Household` with `onDelete: Cascade` (Pitfall 2).
- **D-05:** Audit columns added this phase: `Plant.createdByUserId`, `Room.createdByUserId`, `WateringLog.performedByUserId`, `Note.performedByUserId` — nullable `SetNull` on user delete so deletion never wipes an audit trail.

### Migration strategy
- **D-06:** Production database is **flushed** before the schema deploys. Schema ships with `householdId NOT NULL` from day one on every household-scoped entity. No three-step nullable → backfill → NOT NULL migration — the pattern is moot when there are no pre-existing rows.
- **D-07:** **HSLD-04 (v1 user auto-migration) is de-scoped** for this milestone. No existing users remain after the flush. REQUIREMENTS.md traceability to be updated: HSLD-04 moves to "Deferred / N/A — superseded by DB flush decision 2026-04-16." HSLD-01 (new-signup auto-household) carries the full weight of the auto-creation requirement.
- **D-08:** On successful credential signup (existing register flow in `src/features/auth/`), a transactional hook creates: one `Household` row with default values + one `HouseholdMember` row (role: `OWNER`) for the new user. Failure to create the household rolls back the user creation — a user without a household is not a valid state.

### Household auto-creation defaults
- **D-09:** Auto-created solo household name is the fixed string **"My Plants"** for every new user. Renamable from the settings page (ships in Phase 6).
- **D-10:** Household slug is an **8-character base32url random string** (e.g., `/h/a7k2n9x3/`). Generated via `crypto.randomBytes(5).toString('base64url')` with base32url alphabet, unambiguous (no `0/O/l/1`). Collision check runs but effectively never fires at expected scale (~1 trillion values).
- **D-11:** Slug is **immutable** after creation. Household name changes are cosmetic and never affect the URL. No slug-history / redirect table — not worth the complexity; the in-nav switcher handles recognizability.
- **D-12:** Default household timezone is browser-detected at signup (`Intl.DateTimeFormat().resolvedOptions().timeZone`), fallback `UTC`. Editable in settings (Phase 6). Default cycle duration: 7 days (per HSLD-05). Rotation strategy: `sequential` (only supported value in v1).

### JWT extension
- **D-13:** NextAuth JWT callback in `auth.ts` adds `activeHouseholdId: string`. Resolved on sign-in as the user's default household (newly-created for signups; marked default for multi-household users once Phase 2/6 land). For Phase 1 every user has exactly one household, so resolution is the single membership row.
- **D-14:** `activeHouseholdId` in the JWT is **not** a permission source. It is only a default landing target post-login. Every Server Action and query re-verifies membership live via `requireHouseholdAccess()` (Pitfall 16). Stale JWT cannot grant access.
- **D-15:** `session.user` type extension adds `activeHouseholdId` alongside existing `id` and `isDemo` fields. TypeScript module augmentation in `src/types/next-auth.d.ts` or equivalent.

### requireHouseholdAccess guard
- **D-16:** Guard lives at **`src/features/household/guards.ts`**. Signature: `requireHouseholdAccess(householdId: string) → Promise<{ household, member, role }>`. Throws on failure. Matches the feature-folder server-logic pattern established in v1.0 Phase 1 (D-04).
- **D-17:** Caller passes `householdId` explicitly as an argument, typically resolved server-side from the `/h/[householdSlug]` URL segment via a separate `resolveHouseholdBySlug(slug)` helper. Guard never peeks at request context or JWT for the household target.
- **D-18:** Guard performs a **live DB check** on every call: `db.householdMember.findFirst({ where: { householdId, userId: session.user.id } })`. No caching, no JWT-only fast path. Member rows carry the authoritative role.
- **D-19:** Failure mode: guard throws a custom `ForbiddenError` class (new, lives with the guard). Route handlers and `error.tsx` convert it to a 403 response. Distinct from `NotFoundError` — do not collapse 403 into 404.
- **D-20:** Guard returns `{ household: Household, member: HouseholdMember, role: 'OWNER' | 'MEMBER' }`. Server Actions consume all three without re-querying.

### Claude's Discretion
- Exact TypeScript shape of the `ForbiddenError` class (just extends `Error` with a discriminant field, per convention).
- Location of `resolveHouseholdBySlug` — likely `src/features/household/queries.ts` alongside the guard.
- Whether to use a Prisma middleware or hand-written assertion helper to enforce Pitfall 1 at dev time. Either is fine; pick what tests best.
- Exact fields on `Invitation` beyond the token hash / revoked flag / inviter ref — Phase 4 will refine if gaps surface.
- Whether `HouseholdMember` carries a `rotationOrder: Int` column this phase or in Phase 3 when the rotation engine lands. Recommend: declare it now (shape-complete principle) with default `0`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope
- `.planning/workstreams/household/ROADMAP.md` §Phase 1 — Goal, success criteria, pitfall flags (1, 2, 3, 4, 15, 17)
- `.planning/workstreams/household/REQUIREMENTS.md` — HSLD-01, HSLD-05, HSLD-06, AUDT-01, AUDT-02 (in scope); HSLD-04 (de-scoped per D-07)
- `.planning/workstreams/household/STATE.md` §Accumulated Context §Decisions — URL-scoped routing, CSPRNG invitation tokens, `@date-fns/tz` mandate

### Pitfalls (binding)
- `.planning/research/PITFALLS.md` §Pitfall 1 — Missed `householdId` filter risk; mandates query audit checklist
- `.planning/research/PITFALLS.md` §Pitfall 2 — Cascade misconfiguration; drives D-04
- `.planning/research/PITFALLS.md` §Pitfall 3 — Missing composite indexes; drives D-03
- `.planning/research/PITFALLS.md` §Pitfall 15 — WateringLog per-day uniqueness; drives D-03
- `.planning/research/PITFALLS.md` §Pitfall 17 — URL-scoped routing decision; drives slug schema in D-10, D-11

### Project & tech stack
- `.planning/PROJECT.md` §Current Milestone — Household and Rotation goals, data model additions
- `CLAUDE.md` §Technology Stack — Prisma 7.7.0, PostgreSQL 17, NextAuth v5 beta, TypeScript 6.0
- `CLAUDE.md` §Stack Patterns — Server Actions + Zod + Prisma writes; Server Components with direct Prisma reads

### Prior phase context (v1.0)
- `.planning/milestones/v1.0-phases/01-scaffold-and-foundations/01-CONTEXT.md` §D-04 — Feature-folder server-logic pattern (`src/features/{domain}/actions.ts|queries.ts|schema.ts`) — drives guard location D-16
- `.planning/milestones/v1.0-phases/02-authentication-and-onboarding/02-CONTEXT.md` — JWT session strategy, existing signup flow the on-signup hook extends

### Existing codebase anchor points
- `prisma/schema.prisma` — Current schema; Phase 1 modifies it end-to-end (adds 5 models, reparents Plant/Room/WateringLog/Note, adds audit columns, updates cascades, adds indexes)
- `auth.ts` — JWT callback gets the `activeHouseholdId` extension (D-13); session callback mirrors it into `session.user`
- `auth.config.ts` — `publicPaths` list will need `/join/[token]` added in Phase 4; no change this phase
- `src/features/auth/` — existing register action is where D-08's transactional household creation wraps

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Prisma singleton (`src/lib/db.ts`)** — all new queries and the guard use this.
- **NextAuth v5 JWT + session callbacks (`auth.ts:13-32`)** — pattern for adding `activeHouseholdId` is identical to how `isDemo` was added.
- **Feature-folder pattern (`src/features/auth`, `plants`, `rooms`, `watering`, `notes`, `reminders`, `demo`)** — new `src/features/household/` slots in cleanly with `guards.ts`, `queries.ts`, `actions.ts`, `schema.ts`.
- **Existing register action** — D-08's household auto-creation hook wraps it transactionally; no new signup surface needed.

### Established Patterns
- **Server Actions call Zod-validated → Prisma writes** (CLAUDE.md §Stack Patterns). Guard throws on access failure; actions bubble to `error.tsx`. Applies verbatim to new household actions.
- **JWT session strategy with callback-based token enrichment** — `activeHouseholdId` follows the `isDemo` precedent.
- **`@db.Timestamptz(3)` everywhere** — every new `createdAt`/`updatedAt` column uses the same annotation for consistency.
- **Cuid-based primary keys** (`@id @default(cuid())`) — applies to all 5 new models for consistency with User/Plant/Room.

### Integration Points
- **`prisma/schema.prisma`** — single file, all schema changes land here.
- **`auth.ts` JWT + session callbacks** — activeHouseholdId injection.
- **`src/types/next-auth.d.ts`** (or equivalent) — session type augmentation for `activeHouseholdId`.
- **`src/features/auth/actions.ts`** (register) — wrap in transaction with household + member creation.
- **Phase 2 consumer interface:** every query/action file (`src/features/{plants,rooms,watering,notes,reminders}/queries.ts` + `actions.ts`) will consume the guard. Phase 1 ships the guard; Phase 2 wires it in.
- **Phase 4 consumer interface:** `Invitation` model ships shape-complete this phase so Phase 4 only writes the token-generation / accept / revoke logic.

</code_context>

<specifics>
## Specific Ideas

- "Slug in URL should be short, opaque, and unambiguous — no `0/O/l/1` confusion, no leaking household name in URLs."
- "Don't do a half-migration. If we're doing this, flush prod and start clean." (Drives D-06 / D-07.)
- The guard's rich return `{ household, member, role }` was preferred specifically so Phase 2 Server Actions don't re-query — a single call services ownership check + role gate + household data load.

</specifics>

<deferred>
## Deferred Ideas

- **Slug editability with redirect table** — considered, rejected in Area 3. Revisit only if analytics show users confused by opaque URLs.
- **Personalized default household name** (`"{firstName}'s Plants"`) — considered, rejected in favor of fixed `"My Plants"` for signup simplicity. Users rename in settings.
- **Lazy per-user auto-migration** — considered during Area 2; mooted by the DB flush decision. If ever needed (e.g., a future data restore), the on-signup transactional hook in D-08 can be adapted.
- **JWT re-issue on every membership change** — considered under "Guard input" options; rejected because the guard's live DB check makes JWT staleness irrelevant for authorization.
- **HSLD-04 (v1 user auto-migration) as a requirement** — formally de-scoped this milestone per D-07. REQUIREMENTS.md traceability update is a planner task.
- **Prisma middleware for Pitfall 1 dev-time assertion** — left to Claude's discretion during planning; may land in Phase 1 or be folded into the Phase 2 query audit.

</deferred>

---

*Phase: 01-schema-foundation-data-migration*
*Workstream: household*
*Context gathered: 2026-04-16*

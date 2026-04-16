# Phase 1: Schema Foundation + Data Migration - Research

**Researched:** 2026-04-16
**Domain:** Prisma 7 migrations + PostgreSQL schema design + NextAuth v5 JWT extension + TypeScript 6 custom errors
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** All 5 household models ship in a single Phase 1 migration — `Household`, `HouseholdMember`, `Cycle`, `Availability`, `Invitation` — shape-complete. No behavior for Cycle/Availability/Invitation in Phase 1.
- **D-02:** `Cycle` carries its final field set from day one: `anchorDate`, `cycleDuration` (int days), member-order snapshot, `assignedUserId`, `status` enum, `cycleNumber`.
- **D-03:** Composite indexes: `@@index([householdId, archivedAt])` on Plant, `@@index([householdId, status])` on Cycle, `@@index([householdId])` on Room. WateringLog gets DB-level unique on `(plantId, date_trunc('day', wateredAt))`.
- **D-04:** `Plant → User` and `Room → User` change from `onDelete: Cascade` to `onDelete: SetNull` on `createdByUserId`. Ownership becomes `Plant → Household` / `Room → Household` with `onDelete: Cascade`.
- **D-05:** Audit columns: `Plant.createdByUserId`, `Room.createdByUserId`, `WateringLog.performedByUserId`, `Note.performedByUserId` — nullable `String?` with `onDelete: SetNull`.
- **D-06:** Production DB is flushed. Schema ships with `householdId NOT NULL` from day one. No three-step migration.
- **D-07:** HSLD-04 (v1 user auto-migration) is de-scoped. REQUIREMENTS.md traceability must be updated: HSLD-04 → "Deferred / N/A — superseded by DB flush decision 2026-04-16."
- **D-08:** Transactional signup hook: one `Household` row + one `HouseholdMember` row (role: OWNER) created atomically in the register action. Failure rolls back user creation.
- **D-09:** Auto-created household name is the fixed string **"My Plants"**.
- **D-10:** Household slug = 8-character string, unambiguous alphabet (no 0/O/l/1). Generated via `crypto.randomBytes(5).toString('base64url')` with unambiguous alphabet. (See Pitfall: D-10 has an encoding bug — see research correction below.)
- **D-11:** Slug is immutable after creation.
- **D-12:** Default timezone = `Intl.DateTimeFormat().resolvedOptions().timeZone` from browser (passed at signup), fallback `UTC`. Default cycle duration: 7 days. Rotation strategy: `sequential`.
- **D-13:** JWT callback in `auth.ts` adds `activeHouseholdId: string`. Resolved at sign-in as the user's single membership row.
- **D-14:** `activeHouseholdId` in JWT is a landing target only, not a permission source. Every action re-verifies via `requireHouseholdAccess()`.
- **D-15:** `session.user` type extension adds `activeHouseholdId` alongside `id` and `isDemo`. TypeScript module augmentation in `src/types/next-auth.d.ts`.
- **D-16:** Guard at `src/features/household/guards.ts`. Signature: `requireHouseholdAccess(householdId: string) → Promise<{ household, member, role }>`. Throws on failure.
- **D-17:** Guard receives `householdId` as explicit argument. `resolveHouseholdBySlug(slug)` helper resolves slug → householdId.
- **D-18:** Guard performs live DB check: `db.householdMember.findFirst({ where: { householdId, userId: session.user.id } })`.
- **D-19:** Failure throws `ForbiddenError`. Route handlers convert to 403. Distinct from `NotFoundError`.
- **D-20:** Guard returns `{ household: Household, member: HouseholdMember, role: 'OWNER' | 'MEMBER' }`.

### Claude's Discretion

- Exact TypeScript shape of `ForbiddenError` class (extend `Error` with discriminant field per convention).
- Location of `resolveHouseholdBySlug` — likely `src/features/household/queries.ts`.
- Whether Prisma middleware or hand-written assertion enforces Pitfall 1 at dev time.
- Exact fields on `Invitation` beyond token hash / revoked flag / inviter ref.
- Whether `HouseholdMember` carries `rotationOrder: Int` this phase or in Phase 3. Research recommendation: declare now (shape-complete principle), default `0`.

### Deferred Ideas (OUT OF SCOPE)

- Slug editability with redirect table.
- Personalized default household name (`"{firstName}'s Plants"`).
- Lazy per-user auto-migration.
- JWT re-issue on every membership change.
- HSLD-04 (v1 user auto-migration) — formally de-scoped per D-07.
- Prisma middleware for Pitfall 1 dev-time assertion — may land in Phase 1 or Phase 2.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HSLD-01 | User's solo household is auto-created on signup; user is its owner | D-08 transactional hook in `registerUser`; `$transaction(async tx => {})` interactive form supports dependent IDs |
| HSLD-04 | **DE-SCOPED** — superseded by DB flush decision (D-07, D-06). REQUIREMENTS.md traceability must be updated to "Deferred / N/A" | REQUIREMENTS.md traceability update is a planner task for Wave 0 |
| HSLD-05 | Household has configurable fields: name, timezone, default cycle duration (7 days default), rotation strategy | Schema: `Household` model carries all fields; defaults set at creation in D-08 hook |
| HSLD-06 | Plants, rooms, watering logs, notes, reminders scoped to household; cross-household data never visible | Schema: `householdId NOT NULL` on Plant/Room; `requireHouseholdAccess()` guard for authorization |
| AUDT-01 | Plant actions (watering logs, notes) record `performedByUserId`; attribution visible in timeline | D-05 audit columns on `WateringLog` and `Note`; nullable SetNull |
| AUDT-02 | Plants and rooms record `createdByUserId`; visible on plant detail | D-05 audit columns on `Plant` and `Room`; nullable SetNull |
</phase_requirements>

---

## Summary

Phase 1 lays down the structural foundation for the entire household milestone. The key insight from research is that **the production DB flush (D-06) dramatically simplifies the migration path** — no three-step nullable → backfill → NOT NULL ritual is needed. The entire new schema can ship as a single clean `prisma migrate dev` run with `householdId NOT NULL` from day one.

The most critical technical corrections uncovered during research are: (1) **D-10's slug generation formula is incorrect** — `crypto.randomBytes(5).toString('base64url')` produces 7 characters (not 8) and includes ambiguous characters (0, O, l, 1, I). The correct implementations are either `crypto.randomBytes(6).toString('base64url')` for 8 chars (but still ambiguous) or a Crockford base32 custom-alphabet approach for genuinely unambiguous output. (2) The **WateringLog functional unique index must be added via raw SQL** in a `--create-only` migration because Prisma does not support functional indexes natively.

The NextAuth v5 JWT extension follows an established pattern already in `auth.ts` (`isDemo` precedent). The transactional signup hook uses the **interactive form** of `$transaction` because the `Household.id` is needed to create `HouseholdMember`. The `ForbiddenError` class is straightforward — no existing class to inherit from (no `NotFoundError` exists yet in the codebase).

**Primary recommendation:** Generate a single `--create-only` migration, manually add the WateringLog functional unique index SQL before applying, then apply. This gives full control without any special reset flow needed since the DB is flushed.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Schema definition (5 new models) | Database / Storage | — | Prisma schema change; PostgreSQL executes the migration |
| Household auto-creation on signup | API / Backend (Server Action) | Database / Storage | `registerUser` Server Action wraps transaction; DB enforces atomicity |
| JWT `activeHouseholdId` extension | Frontend Server (SSR/NextAuth) | — | NextAuth JWT callback runs server-side; session cookie is the transport |
| `session.user` type augmentation | API / Backend (TypeScript) | — | Module augmentation in `src/types/next-auth.d.ts` |
| `requireHouseholdAccess()` guard | API / Backend | Database / Storage | Pure server-side function; lives in `src/features/household/guards.ts` |
| `resolveHouseholdBySlug()` helper | API / Backend | Database / Storage | DB lookup by slug; one additional query per request |
| `ForbiddenError` class | API / Backend | — | Error class; no tier complexity |
| Slug generation | API / Backend | — | `crypto.randomBytes` at write time; no browser involvement |
| Composite indexes | Database / Storage | — | Declared in Prisma schema, executed by PostgreSQL planner |
| WateringLog functional unique index | Database / Storage | — | Raw SQL in migration file only; Prisma cannot express this natively |
| REQUIREMENTS.md HSLD-04 traceability update | — (docs task) | — | Pure documentation update in Wave 0 |

---

## Standard Stack

### Core (already installed — verified in package.json)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| Prisma ORM | 7.7.0 | Schema + migration management | [VERIFIED: package.json] |
| `@prisma/adapter-pg` | 7.7.0 | PostgreSQL adapter | [VERIFIED: package.json] |
| PostgreSQL | 17.x | Database | [VERIFIED: CLAUDE.md] |
| NextAuth.js | 5.0.0-beta.30 | JWT session management | [VERIFIED: package.json] |
| TypeScript | 5.x (^5 in package.json) | Type safety | [VERIFIED: package.json] |
| `@date-fns/tz` | 1.4.1 | Timezone-aware date arithmetic (Phase 3+ use; not needed in Phase 1 directly) | [VERIFIED: node_modules/@date-fns/tz/package.json] |

### Nothing New to Install

Phase 1 is purely schema, server logic, and auth extension. All required libraries are already installed. No new `npm install` step is needed.

---

## Architecture Patterns

### System Architecture Diagram

```
signup request
    │
    ▼
registerUser() Server Action
    │
    ├── validate (Zod)
    ├── check email uniqueness
    ├── hash password
    │
    └── db.$transaction(async tx => {})
            │
            ├── tx.user.create()           → User row
            │       │ id returned
            ├── tx.household.create()      → Household row (name:"My Plants", slug:generateSlug(), timezone, cycleDuration:7)
            │       │ id returned
            └── tx.householdMember.create() → HouseholdMember row (role:OWNER, rotationOrder:0)
                    │
                    [any failure → full rollback: no orphan user/household]

signIn() after transaction
    │
    └── jwt() callback
            │
            ├── token.id = user.id
            ├── token.isDemo = false
            └── token.activeHouseholdId = (query db.householdMember for userId)
                    │
                    └── session() callback
                            └── session.user.activeHouseholdId = token.activeHouseholdId

Server Action (any household-scoped action, Phase 2+)
    │
    ├── auth() → session
    ├── params.householdSlug → resolveHouseholdBySlug(slug) → householdId
    └── requireHouseholdAccess(householdId)
            │
            ├── db.householdMember.findFirst({ where: { householdId, userId: session.user.id } })
            ├── found → return { household, member, role }
            └── not found → throw ForbiddenError("Not a member of this household")
```

### Recommended Project Structure for Phase 1

```
prisma/
├── schema.prisma           # modified end-to-end
└── migrations/
    └── <timestamp>_household_schema/
        └── migration.sql   # Prisma-generated + manual WateringLog functional index SQL appended

src/
├── types/
│   └── next-auth.d.ts      # add activeHouseholdId to Session + JWT interfaces (already exists)
├── features/
│   ├── auth/
│   │   └── actions.ts      # registerUser wrapped in $transaction (D-08)
│   └── household/          # new feature folder
│       ├── guards.ts        # requireHouseholdAccess() + ForbiddenError class
│       └── queries.ts       # resolveHouseholdBySlug()
└── lib/
    └── slug.ts             # generateHouseholdSlug() utility (or inline in household/queries.ts)
auth.ts                     # jwt() + session() callbacks extended with activeHouseholdId
```

### Pattern 1: Prisma Interactive Transaction for Dependent IDs

**What:** When creating multiple records where a later record needs the ID of an earlier one, use the interactive form `$transaction(async tx => {})`.

**When to use:** D-08 — create User, then Household (needs nothing yet), then HouseholdMember (needs both userId and householdId).

**Why not array form:** The array form `$transaction([...])` cannot pass IDs between operations. Nested writes on `user.create` with `household: { create: {...} }` are possible but the HouseholdMember needs a separate explicit create because HouseholdMember is not a direct nested relation on User in the schema.

**Example:**
```typescript
// Source: Prisma docs - interactive transactions
// https://www.prisma.io/docs/orm/prisma-client/queries/transactions#interactive-transactions
const result = await db.$transaction(async (tx) => {
  const user = await tx.user.create({
    data: { email, passwordHash, name },
  });

  const household = await tx.household.create({
    data: {
      name: "My Plants",
      slug: generateHouseholdSlug(),
      timezone: detectedTimezone ?? "UTC",
      cycleDuration: 7,
      rotationStrategy: "sequential",
    },
  });

  const member = await tx.householdMember.create({
    data: {
      userId: user.id,
      householdId: household.id,
      role: "OWNER",
      rotationOrder: 0,
    },
  });

  return { user, household, member };
});
```

**Rollback guarantee:** [VERIFIED: Prisma docs] "If the application encounters an error along the way, the async function will throw an exception and automatically rollback the transaction." Any failure (DB constraint, duplicate email race, etc.) rolls back all three creates.

**Timeout:** Default `timeout: 5000ms`, `maxWait: 2000ms`. This transaction is fast (3 sequential inserts, no network calls) — well within limits.

### Pattern 2: NextAuth v5 JWT Callback Extension

**What:** Adding `activeHouseholdId` to the JWT token and surfacing it in `session.user`. Mirrors the existing `isDemo` pattern.

**Source:** [CITED: authjs.dev/guides/extending-the-session] + [VERIFIED: existing auth.ts in codebase]

**auth.ts change:**
```typescript
async jwt({ token, user }) {
  if (user) {
    token.id = user.id;
    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: { email: true },
    });
    token.isDemo = dbUser?.email === DEMO_EMAIL;

    // NEW: resolve activeHouseholdId at sign-in
    const membership = await db.householdMember.findFirst({
      where: { userId: user.id },
      select: { householdId: true },
      orderBy: { createdAt: "asc" }, // deterministic: first household for future multi-household
    });
    token.activeHouseholdId = membership?.householdId ?? null;
  }
  return token;
},
async session({ session, token }) {
  if (token.id) {
    session.user.id = token.id as string;
    session.user.isDemo = token.isDemo === true;
    session.user.activeHouseholdId = token.activeHouseholdId as string | undefined;
  }
  return session;
},
```

**src/types/next-auth.d.ts change (add to existing file):**
```typescript
// Source: authjs.dev/getting-started/typescript
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      isDemo: boolean;
      activeHouseholdId?: string;   // ADD THIS
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    isDemo?: boolean;
    activeHouseholdId?: string | null;   // ADD THIS
  }
}
```

### Pattern 3: requireHouseholdAccess() Guard

**What:** A server-side function that enforces membership before any household-scoped operation. Called at the top of every Server Action and Server Component that needs household data.

**Source:** [VERIFIED: CONTEXT.md D-16 through D-20] + pattern aligns with NextAuth v5 App Router Server Action patterns.

```typescript
// src/features/household/guards.ts

import { auth } from "../../../auth";
import { db } from "@/lib/db";

export class ForbiddenError extends Error {
  readonly name = "ForbiddenError" as const;
  readonly statusCode = 403;

  constructor(message = "Access denied") {
    super(message);
    // Maintain correct prototype chain in TypeScript
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

export async function requireHouseholdAccess(householdId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new ForbiddenError("Not authenticated");
  }

  const member = await db.householdMember.findFirst({
    where: { householdId, userId: session.user.id },
    include: { household: true },
  });

  if (!member) {
    throw new ForbiddenError("Not a member of this household");
  }

  return {
    household: member.household,
    member,
    role: member.role as "OWNER" | "MEMBER",
  };
}
```

**Note:** The `Object.setPrototypeOf(this, ForbiddenError.prototype)` call is required in TypeScript when extending built-in classes to maintain correct `instanceof` checks. [ASSUMED — TypeScript known gotcha with class extension, standard pattern since TS 2.2]

### Pattern 4: Slug Generation (Corrected from D-10)

**What:** 8-character URL-safe slug with no visually ambiguous characters.

**Why D-10 needs correction:** `crypto.randomBytes(5).toString('base64url')` produces 7 characters (not 8), and base64url includes digits 0-9 and uppercase letters — specifically `0`, `O`, `l`, `1`, `I` which are visually ambiguous. [VERIFIED by running in Node 24.13.0]

**Two valid options:**

Option A — Custom unambiguous alphabet (recommended for strictest compliance with D-10's "unambiguous" requirement):
```typescript
// src/lib/slug.ts
import { randomBytes } from "crypto";

// Remove visually ambiguous: 0, O, I, l, 1
const UNAMBIGUOUS_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

export function generateHouseholdSlug(length = 8): string {
  const bytes = randomBytes(length * 2); // oversample to avoid bias
  let result = "";
  const maxValid = Math.floor(256 / UNAMBIGUOUS_ALPHABET.length) * UNAMBIGUOUS_ALPHABET.length;
  for (let i = 0; i < bytes.length && result.length < length; i++) {
    if (bytes[i] < maxValid) {
      result += UNAMBIGUOUS_ALPHABET[bytes[i] % UNAMBIGUOUS_ALPHABET.length];
    }
  }
  // Safety fallback (statistically near-impossible to reach)
  while (result.length < length) {
    const b = randomBytes(1)[0];
    if (b < maxValid) result += UNAMBIGUOUS_ALPHABET[b % UNAMBIGUOUS_ALPHABET.length];
  }
  return result;
}
```

Option B — `crypto.randomBytes(6).toString('base64url')` = 8 chars but includes ambiguous chars. Simpler but does not meet D-10's stated "unambiguous" requirement.

**Recommendation:** Option A (custom alphabet). The unambiguity requirement is explicit in D-10. The alphabet size of 54 chars * 8 positions = 54^8 ≈ 72 trillion possible values — collision probability is negligible.

**Collision check pattern:**
```typescript
// In household creation, generate slug + verify uniqueness
let slug: string;
let attempts = 0;
do {
  slug = generateHouseholdSlug();
  const existing = await tx.household.findUnique({ where: { slug }, select: { id: true } });
  if (!existing) break;
  attempts++;
  if (attempts > 10) throw new Error("Slug generation failed after 10 attempts");
} while (true);
```

### Pattern 5: WateringLog Functional Unique Index via Raw Migration SQL

**What:** A database-level unique constraint on `(plantId, date_trunc('day', wateredAt))` preventing duplicate watering logs per plant per calendar day.

**Prisma limitation:** [VERIFIED: Prisma docs] "Indexes using a function (such as `to_tsvector`) to determine the indexed value are not yet supported by Prisma ORM." Functional indexes like `date_trunc` cannot be expressed in `schema.prisma`.

**Implementation:**
```bash
# Step 1: Generate migration file without applying
npx prisma migrate dev --create-only --name household_schema

# Step 2: Edit the generated migration.sql file, append at the end:
```
```sql
-- WateringLog: prevent duplicate logs per plant per calendar day (Pitfall 15)
CREATE UNIQUE INDEX "WateringLog_plantId_day_key"
ON "WateringLog" ("plantId", date_trunc('day', "wateredAt" AT TIME ZONE 'UTC'));
```
```bash
# Step 3: Apply
npx prisma migrate dev
```

**Survival across future migrations:** The index lives in the migration SQL file and in the PostgreSQL catalog. Future `prisma migrate dev` runs will not touch it unless you explicitly drop it. The `schema.prisma` does not need to reflect it — Prisma treats it as "custom SQL" and leaves it alone. [VERIFIED: Prisma customizing-migrations docs]

**Application-layer handling:** When a duplicate watering log is attempted, PostgreSQL will throw `P2002` (Unique constraint failed). The Server Action must catch this and return `{ error: "DUPLICATE" }`. [VERIFIED: existing watering tests already test for DUPLICATE return value]

### Anti-Patterns to Avoid

- **Single-step migration with functional index in schema.prisma:** Prisma does not support functional indexes; attempting `@@index` with a function expression will fail schema validation.
- **Using `$transaction([])` array form for D-08:** Cannot pass `user.id` to the household creation or `household.id` to the member creation within the array form. Use interactive form.
- **Trusting JWT `activeHouseholdId` as authorization:** D-14 is explicit — JWT is a landing target only. Every Server Action calls `requireHouseholdAccess()` with a live DB check.
- **Keeping `onDelete: Cascade` on `Plant.userId` or `Room.userId`:** Must change to `onDelete: SetNull` on the audit column before the migration runs (Pitfall 2).
- **`crypto.randomBytes(5).toString('base64url')`:** Produces 7 chars (not 8) with ambiguous characters. Use the custom alphabet function above.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Transaction atomicity | Custom try/catch rollback | Prisma `$transaction(async tx => {})` | PostgreSQL ACID guarantee; automatic rollback on any thrown error |
| Session extension | Custom cookie / header | NextAuth v5 JWT callback | Token management, signature, cookie httpOnly already handled |
| Password hashing | Custom hash | `bcryptjs` (already in use) | bcrypt handles salting, rounds, timing-safe comparison |
| TypeScript session types | Manual type casts | Module augmentation in `next-auth.d.ts` | Propagates type safely to all `auth()` call sites |

**Key insight:** This phase is structural. Every capability in it has a standard tool. The only custom code is the domain logic (slug generation, guard logic) — not infrastructure.

---

## Migration Strategy (D-06 flushed DB path)

### Correct Approach: Single Clean Migration

Since D-06 declares the production DB is flushed before Phase 1 deploys:

1. **Generate with `--create-only`:**
   ```bash
   npx prisma migrate dev --create-only --name household_schema
   ```
   This generates the full migration SQL without applying it.

2. **Append the WateringLog functional index** to the generated `migration.sql` (see Pattern 5).

3. **Apply:**
   ```bash
   npx prisma migrate dev
   ```

4. **Do NOT use `prisma migrate reset`** unless you need to drop and recreate the local dev DB. `migrate dev` on a schema-driftless DB is cleaner.

### What NOT to do

- **Three-step migration (nullable → backfill → NOT NULL):** Explicitly not needed per D-06. The DB is empty; `householdId NOT NULL` ships from day one. The PITFALLS.md Pitfall 4 documents the three-step ritual for live databases — this phase bypasses it entirely.
- **`--force-reset` flag:** Destroys all existing migrations. Not needed; we're adding to a clean slate.
- **Squashing existing migrations:** The current schema has no migration history (no `prisma/migrations/` directory exists). The first migration IS the baseline.

### Migration SQL Shape (key additions)

```sql
-- Household
CREATE TABLE "Household" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "timezone" TEXT NOT NULL DEFAULT 'UTC',
  "cycleDuration" INTEGER NOT NULL DEFAULT 7,
  "rotationStrategy" TEXT NOT NULL DEFAULT 'sequential',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL
);

-- HouseholdMember
CREATE TABLE "HouseholdMember" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "householdId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'MEMBER',
  "rotationOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("householdId", "userId"),
  FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE,
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- Plant gets householdId NOT NULL + cascade change + audit column + indexes
ALTER TABLE "Plant"
  ADD COLUMN "householdId" TEXT NOT NULL,
  ADD COLUMN "createdByUserId" TEXT,
  ALTER COLUMN "userId" DROP NOT NULL; -- userId → createdByUserId rename may require intermediate step
-- Full SQL generated by Prisma from schema.prisma changes

-- Add composite index
CREATE INDEX "Plant_householdId_archivedAt_idx" ON "Plant" ("householdId", "archivedAt");

-- WateringLog functional unique index (hand-appended)
CREATE UNIQUE INDEX "WateringLog_plantId_day_key"
ON "WateringLog" ("plantId", date_trunc('day', "wateredAt" AT TIME ZONE 'UTC'));
```

**Note:** Prisma generates the full correct SQL from `schema.prisma`. The above is illustrative; only the functional index must be hand-appended.

---

## Common Pitfalls

### Pitfall 1: `crypto.randomBytes(5).toString('base64url')` Produces 7 Chars, Not 8

**What goes wrong:** D-10 specifies `crypto.randomBytes(5).toString('base64url')` for 8-char slugs. In practice: 5 bytes = 40 bits. base64url encodes 6 bits per character. ceil(40/6) = 7 characters. The output is 7 chars, not 8. Additionally, base64url includes digits `0-9` and uppercase letters `I`, `O` — all visually ambiguous. [VERIFIED: running in Node 24.13.0]

**Fix:** Use `crypto.randomBytes(6).toString('base64url')` for 8 chars (but still ambiguous), or use the custom unambiguous alphabet function in Pattern 4 (recommended).

**Planner action:** Use the custom alphabet implementation. Flag D-10's formula as incorrect in a code comment.

### Pitfall 2: Plant/Room rename from `userId` to `createdByUserId`

**What goes wrong:** The current schema has `Plant.userId String` (required, the ownership field) and `Room.userId String` (required). Phase 1 must:
1. Remove the ownership relationship (Plant → User as owner).
2. Add `Plant.householdId String` (NOT NULL, owner → Household).
3. Add `Plant.createdByUserId String?` (nullable, audit field, SetNull on user delete).

This is a **column rename + type change + relation change** in one migration. Prisma cannot automatically map `userId` → `createdByUserId` — it will generate a DROP + ADD, not a RENAME. For a flushed DB this is fine (no data loss). The migration SQL will be:
```sql
ALTER TABLE "Plant" DROP COLUMN "userId";  -- OLD ownership
ALTER TABLE "Plant" ADD COLUMN "householdId" TEXT NOT NULL;  -- NEW ownership
ALTER TABLE "Plant" ADD COLUMN "createdByUserId" TEXT;  -- audit
```
[VERIFIED: Prisma schema diff behavior — confirmed by examining migration output patterns]

**Warning sign to check in plan:** Any implementation that tries to do this as an in-place rename will fail because `userId` had `NOT NULL` and was an FK — PostgreSQL requires separate operations.

### Pitfall 3: `ForbiddenError` `instanceof` Check May Fail Across Module Boundaries

**What goes wrong:** In TypeScript, extending built-in classes (`Error`) and then checking `instanceof` across module compilation boundaries can fail. The `ForbiddenError` thrown in `guards.ts` may not be recognized as `instanceof ForbiddenError` in `error.tsx` if the compilation unit differs.

**Fix:** Always call `Object.setPrototypeOf(this, ForbiddenError.prototype)` in the constructor. Additionally, check by `error.name === "ForbiddenError"` as the authoritative check in error handlers (more reliable than `instanceof` across boundaries).

**Example error.tsx handling:**
```typescript
// In error.tsx or route handler
if (error instanceof ForbiddenError || (error as any)?.name === "ForbiddenError") {
  return <div>Access denied</div>;
}
```

### Pitfall 4: JWT `activeHouseholdId` Resolves at Sign-In, Not on Every Request

**What goes wrong:** The `if (user)` guard in the jwt callback means `activeHouseholdId` is only set when `user` is non-null — i.e., at sign-in time. On subsequent requests the jwt callback runs with `token` but no `user`. If the implementation mistakenly tries to DB-query inside `if (!user)`, it runs on every request, adding a DB query to every page load.

**Fix (per CONTEXT.md D-13):** Resolve at sign-in only. The token value is stale by design (D-14: it's a landing target, not an authorization source). Do not query for `activeHouseholdId` on subsequent token refreshes.

**Implementation note:** The existing pattern for `isDemo` shows the correct approach — `if (user) { ... query ... }`. Match that pattern exactly.

### Pitfall 5: No `@@index` on `HouseholdMember(householdId, userId)`

**What goes wrong:** The guard calls `db.householdMember.findFirst({ where: { householdId, userId } })` on every Server Action. Without a composite index on `(householdId, userId)`, this is a sequential scan at scale.

**Fix:** Add `@@unique([householdId, userId])` on `HouseholdMember` (it's a unique constraint, not just an index — a user can only be in a household once). This creates a unique index implicitly. If a unique constraint is too strict (it shouldn't be — duplicates are invalid), add `@@index([householdId, userId])` as a fallback.

**Note:** D-03 lists the mandatory indexes but does not mention HouseholdMember explicitly. The planner should add `@@unique([householdId, userId])` to HouseholdMember schema definition.

---

## Code Examples

### Complete `registerUser` with Transaction (D-08)

```typescript
// src/features/auth/actions.ts (modified)
"use server";
import { db } from "@/lib/db";
import { generateHouseholdSlug } from "@/lib/slug";
// ...

export async function registerUser(data: {
  email: string;
  password: string;
  confirmPassword: string;
  timezone?: string; // detected browser timezone passed from client
}) {
  const parsed = registerSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  try {
    const existingUser = await db.user.findUnique({
      where: { email: parsed.data.email },
    });
    if (existingUser) {
      return { error: "An account with this email already exists. Sign in instead?" };
    }

    const passwordHash = await bcryptjs.hash(parsed.data.password, 12);
    const detectedTimezone = parsed.data.timezone ?? "UTC";

    // D-08: transactional household creation — rollback on any failure
    await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: parsed.data.email, passwordHash },
      });

      let slug: string;
      let attempts = 0;
      do {
        slug = generateHouseholdSlug();
        const existing = await tx.household.findUnique({ where: { slug }, select: { id: true } });
        if (!existing) break;
        if (++attempts > 10) throw new Error("Slug collision");
      } while (true);

      const household = await tx.household.create({
        data: {
          name: "My Plants",
          slug,
          timezone: detectedTimezone,
          cycleDuration: 7,
          rotationStrategy: "sequential",
        },
      });

      await tx.householdMember.create({
        data: {
          userId: user.id,
          householdId: household.id,
          role: "OWNER",
          rotationOrder: 0,
        },
      });
    });

    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/dashboard", // Phase 6 changes this to /h/[slug]/dashboard
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return { error: "Something went wrong. Please try again in a moment." };
  }
}
```

### `requireHouseholdAccess` Guard (D-16 through D-20)

```typescript
// src/features/household/guards.ts
import { auth } from "../../../auth";
import { db } from "@/lib/db";

export class ForbiddenError extends Error {
  readonly name = "ForbiddenError" as const;
  readonly statusCode = 403 as const;

  constructor(message = "Access denied") {
    super(message);
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

export async function requireHouseholdAccess(householdId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new ForbiddenError("Not authenticated");
  }

  const member = await db.householdMember.findFirst({
    where: { householdId, userId: session.user.id },
    include: { household: true },
  });

  if (!member) {
    throw new ForbiddenError("Not a member of this household");
  }

  return {
    household: member.household,
    member,
    role: member.role as "OWNER" | "MEMBER",
  };
}
```

### `resolveHouseholdBySlug` Helper

```typescript
// src/features/household/queries.ts
import { db } from "@/lib/db";

export async function resolveHouseholdBySlug(slug: string) {
  const household = await db.household.findUnique({
    where: { slug },
    select: { id: true, name: true },
  });
  return household; // null if slug not found
}
```

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| Three-step migration (nullable → backfill → NOT NULL) | Single clean migration (flushed DB) | Pitfall 4 in PITFALLS.md documents the three-step as "mandatory" for live DBs — D-06 removes this requirement entirely |
| `prisma migrate reset` to clean dev DB | `prisma migrate dev --create-only` + edit + `migrate dev` | `reset` works too, but `--create-only` gives surgical control for appending the functional index SQL |
| Hand-rolled functional index constraint | Raw SQL appended to `--create-only` migration | Prisma docs confirm functional indexes are not supported in schema.prisma |
| JWT `strategy: "database"` | `strategy: "jwt"` (already in use) | JWT strategy avoids session table; `activeHouseholdId` is a natural JWT claim |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `Object.setPrototypeOf(this, ForbiddenError.prototype)` is needed to fix `instanceof` across compilation units | Pattern 3 / Pitfall 3 | `instanceof ForbiddenError` check in error.tsx may fail silently; fallback `error.name` check mitigates |
| A2 | No `prisma/migrations/` directory exists (first-ever migration for this project) | Migration Strategy | If a migrations directory exists, `--create-only` appends a new migration; does not squash old ones. Review before applying. |
| A3 | `@hookform/resolvers` v5.2.2 supports passing `timezone` field through existing register form without additional wiring | Code examples | If register form schema doesn't accept `timezone`, a silent client-side capture via `Intl.DateTimeFormat()` + hidden field is needed |
| A4 | Phase 2 redirects should go to `/dashboard` temporarily and be updated to `/h/[slug]/dashboard` in Phase 6 | Code examples | Phase 6 ROADMAP note says URL routing established Phase 1, full navigation Phase 6. Redirect target must be acknowledged as a planned Phase 6 update. |

**Verified claims (no user confirmation needed):** All claims about Prisma 7 migration mechanics, NextAuth v5 JWT callback pattern, `crypto.randomBytes` output, base64url character set, functional index limitation, and transaction API behavior.

---

## Open Questions

1. **Does the register form currently pass `timezone` to the server action?**
   - What we know: `registerUser()` in `src/features/auth/actions.ts` accepts `{ email, password, confirmPassword }` — no `timezone` field.
   - What's unclear: D-12 says "browser-detected at signup." This requires a hidden field or `useEffect` capture on the client-side register form.
   - Recommendation: Planner should include a task to add `timezone` to the register schema + form + action. Low-risk addition.

2. **Should `rotationOrder` be on `HouseholdMember` in Phase 1 or Phase 3?**
   - What we know: CONTEXT.md leaves this to Claude's discretion with a recommendation to declare it now.
   - What's unclear: Phase 3 builds the rotation engine — if `rotationOrder` is absent in Phase 1, Phase 3 adds a migration.
   - Recommendation: Add `rotationOrder Int @default(0)` to `HouseholdMember` in Phase 1. Shape-complete principle prevents unnecessary Phase 3 migration.

3. **`Invitation` model exact fields for Phase 4 compatibility**
   - What we know: STATE.md says "CSPRNG (`crypto.randomBytes(32).toString('hex')`), no expiry, owner-revocable, store SHA-256 hash."
   - What's unclear: Should Phase 1 store the raw token or its hash? STATE.md says "store SHA-256 hash" (security best practice — never store raw tokens).
   - Recommendation: `Invitation.tokenHash String @unique` (SHA-256 of the raw token). Raw token is sent in URL, never stored. The `invitedEmail String?` field is optional per PITFALLS.md Pitfall 10 guidance.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Prisma CLI, Next.js | ✓ | v24.13.0 | — |
| Prisma CLI | Migration commands | ✓ | 7.7.0 | — |
| PostgreSQL | Database | Not confirmed in PATH | — | Needs DATABASE_URL env var; dev DB must be running |
| `@date-fns/tz` | D-12 timezone detection (Phase 3+ use) | ✓ | 1.4.1 | — |
| `crypto` (Node built-in) | Slug generation | ✓ | built-in (Node 24) | — |

**Missing dependencies with no fallback:**
- PostgreSQL running instance — confirmed that `psql` is not in PATH. The DATABASE_URL must be configured and the Postgres server must be running before `prisma migrate dev` can execute.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 |
| Config file | `vitest.config.mts` |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run` |
| Environment | jsdom (current) — see note below |

**Environment note:** Current `vitest.config.mts` sets `environment: "jsdom"`. Server Action tests (guards, transactions) must mock DB calls (the existing pattern in `watering.test.ts` and `plants.test.ts` uses `vi.mock` to stub DB modules). No real PostgreSQL connection is required for unit/integration tests. This is intentional for CI compatibility.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HSLD-01 | New user signup creates User + Household + HouseholdMember(OWNER) atomically | unit (mocked DB) | `npx vitest run tests/auth.test.ts` | Partial — `tests/auth.test.ts` exists with `test.todo` stubs |
| HSLD-01 | Household creation failure rolls back user creation | unit (mocked DB) | `npx vitest run tests/auth.test.ts` | ❌ Wave 0 |
| HSLD-05 | Auto-created household has name "My Plants", timezone from browser, cycleDuration 7, strategy sequential | unit | `npx vitest run tests/household.test.ts` | ❌ Wave 0 |
| HSLD-06 | `requireHouseholdAccess()` returns `{ household, member, role }` for valid member | unit (mocked DB) | `npx vitest run tests/household.test.ts` | ❌ Wave 0 |
| HSLD-06 | `requireHouseholdAccess()` throws `ForbiddenError` for non-member | unit (mocked DB) | `npx vitest run tests/household.test.ts` | ❌ Wave 0 |
| HSLD-06 | `requireHouseholdAccess()` throws `ForbiddenError` for unauthenticated session | unit (mocked DB) | `npx vitest run tests/household.test.ts` | ❌ Wave 0 |
| AUDT-01 | `WateringLog.performedByUserId` and `Note.performedByUserId` are nullable String columns in schema | schema shape test | `npx vitest run tests/household.test.ts` | ❌ Wave 0 |
| AUDT-02 | `Plant.createdByUserId` and `Room.createdByUserId` are nullable String columns in schema | schema shape test | `npx vitest run tests/household.test.ts` | ❌ Wave 0 |
| D-10 | `generateHouseholdSlug()` produces 8-char string with no 0/O/l/1/I chars | unit | `npx vitest run tests/household.test.ts` | ❌ Wave 0 |
| D-13/D-15 | `session.user.activeHouseholdId` is populated after sign-in | unit (mocked NextAuth) | `npx vitest run tests/auth.test.ts` | Partial (stub exists) |
| HSLD-04 | De-scoped — REQUIREMENTS.md traceability updated to "Deferred / N/A" | docs verification | N/A | ❌ Wave 0 task (manual) |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/household.test.ts tests/auth.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/household.test.ts` — covers HSLD-01 (transactional signup), HSLD-05 (defaults), HSLD-06 (guard behavior), D-10 (slug generation), AUDT-01/02 (schema shape assertions via source-read pattern matching existing test style)
- [ ] `src/lib/slug.ts` — create before writing guard tests
- [ ] `src/features/household/guards.ts` — create before guard tests
- [ ] `src/features/household/queries.ts` — create before resolver tests
- [ ] REQUIREMENTS.md update for HSLD-04 → "Deferred / N/A" (planner task, not a code task)

*(No new test framework install needed — Vitest 4.1.4 already installed and working.)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes (signup hook) | bcryptjs 12 rounds (already in use); transactional signup prevents orphan users |
| V3 Session Management | Yes (JWT extension) | NextAuth v5 JWT; `activeHouseholdId` is informational only, not authoritative |
| V4 Access Control | Yes (guard) | `requireHouseholdAccess()` live DB check; no JWT-only fast path (D-14, D-18) |
| V5 Input Validation | Yes (schemas) | Zod v4 validates all inputs; slug generated server-side (never from user input) |
| V6 Cryptography | Yes (slug) | `crypto.randomBytes` (CSPRNG); never `Math.random()` |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Stale JWT grants unauthorized household access | Elevation of Privilege | Live DB membership check in every Server Action (D-18); JWT is landing target only (D-14) |
| Slug enumeration (brute-force valid household URLs) | Information Disclosure | Custom alphabet = 54^8 ≈ 72 trillion values; `requireHouseholdAccess()` returns 403 (not 404) for non-members, preventing oracle |
| Race condition in `user.create` email uniqueness check | Tampering | PostgreSQL unique constraint on `User.email` is the authoritative guard; application-layer check is UX optimization only |
| Orphan user without household after signup failure | Denial of Service / Data Integrity | `$transaction` rollback ensures atomicity — either both User and Household exist, or neither does |

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 1 |
|-----------|------------------|
| Next.js 16 App Router; `proxy.ts` not `middleware.ts` | `auth.config.ts` already uses proxy.ts pattern; `requireHouseholdAccess` must be a Server Action / server function, not middleware |
| Prisma 7.7.0 + PostgreSQL 17 | Use `$transaction(async tx => {})` interactive form; no Rust binary; adapter-pg already configured |
| NextAuth v5 beta (not v4) | `unstable_update` API for future membership changes; jwt/session callback pattern per authjs.dev docs |
| TypeScript 5.x (^5 in package.json — note: CLAUDE.md says 6.0 but package.json says `^5`) | Module augmentation pattern in `next-auth.d.ts` already established; extend existing file |
| Zod v4 (`import { z } from "zod/v4"`) | Validation schemas in new `src/features/household/schema.ts` must use `zod/v4` import path |
| `@db.Timestamptz(3)` on all datetime fields | All new `createdAt`, `updatedAt`, timestamps must include `@db.Timestamptz(3)` annotation |
| Cuid-based primary keys `@id @default(cuid())` | All 5 new models use cuid PKs for consistency with User/Plant/Room |
| No direct repo edits outside GSD workflow | N/A — this is research for planning |

**TypeScript version note:** `package.json` specifies `"typescript": "^5"` which resolves to TypeScript 5.x. CLAUDE.md's "Recommended Stack" section mentions TypeScript 6.0. Planner should verify the actual installed version with `npx tsc --version` before assuming 6.0 features are available. All patterns in this research are compatible with both TS 5.x and 6.0.

---

## Sources

### Primary (HIGH confidence)
- [VERIFIED: `prisma/schema.prisma`] — Current schema; exact field names, cascade behaviors, existing indexes confirmed by direct file read
- [VERIFIED: `auth.ts`] — Existing JWT/session callback structure; `isDemo` pattern confirmed for `activeHouseholdId` implementation
- [VERIFIED: `src/features/auth/actions.ts`] — Existing `registerUser` shape; D-08 transaction wraps this function
- [VERIFIED: `src/types/next-auth.d.ts`] — Existing module augmentation; `activeHouseholdId` extends this file
- [VERIFIED: `package.json`] — All library versions confirmed; `@date-fns/tz` 1.4.1 installed
- [VERIFIED: Node 24.13.0 runtime test] — `crypto.randomBytes(5).toString('base64url')` = 7 chars with ambiguous characters confirmed
- [CITED: Prisma docs — customizing-migrations] — `--create-only` workflow for hand-editing migration SQL
- [CITED: Prisma docs — indexes] — Functional indexes not supported in schema.prisma; confirmed raw SQL workaround
- [CITED: Prisma docs — transactions] — Interactive `$transaction` supports dependent IDs and automatic rollback
- [CITED: authjs.dev/guides/extending-the-session] — JWT/session callback pattern for custom fields
- [CITED: authjs.dev/getting-started/typescript] — Module augmentation syntax for `next-auth` and `next-auth/jwt`

### Secondary (MEDIUM confidence)
- [CITED: Vitest 4.1.4 config in `vitest.config.mts`] — jsdom environment; existing test patterns use `vi.mock` for DB calls
- [WebSearch: nextauthjs/next-auth #9715] — `unstable_update` pattern for server-side session update (relevant for Phase 4 membership changes, not Phase 1)

---

## Metadata

**Confidence breakdown:**
- Schema design: HIGH — direct codebase audit + Prisma docs
- Migration mechanics: HIGH — Prisma official docs verified
- NextAuth JWT extension: HIGH — existing `isDemo` pattern in `auth.ts` is identical
- Slug generation: HIGH — runtime-verified in Node; D-10 formula bug confirmed with evidence
- Transaction API: HIGH — Prisma docs + existing patterns in codebase
- Guard / ForbiddenError pattern: HIGH — TypeScript class extension is well-established; A1 assumption on prototype chain is standard TS practice
- Test architecture: HIGH — vitest.config.mts + existing tests directly examined

**Research date:** 2026-04-16
**Valid until:** 2026-05-16 (stable stack; Prisma 7 / NextAuth v5 beta — check for beta.31+ if more than 2 weeks pass before planning)

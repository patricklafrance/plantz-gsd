# Stack Research — Household + Rotation Milestone

**Domain:** Multi-tenant collaborative plant-care (household scoping, rotation engine, in-app notifications)
**Researched:** 2026-04-16
**Confidence:** HIGH (all critical claims verified against official docs or npm registry)

---

## Context: What the Milestone Adds

This is a SUBSEQUENT MILESTONE on top of a shipped v1.0 app. The existing stack is locked (Next.js 16.2.2 / React 19.2 / TypeScript / Prisma 7.7 / NextAuth v5 beta / Tailwind v4 / date-fns v4). This document covers only the **additions and adaptations** required for:

- Multi-tenant data scoping via `householdId`
- Active-household selection stored in JWT session
- Rotation / cycle engine (request-time lazy transitions)
- Secure invitation token generation
- Timezone-aware cycle date arithmetic
- Additional shadcn/ui primitives for new UI surfaces

Current installed packages (from `package.json`):

- `date-fns ^4.1.0` — already installed, no core timezone support
- `react-day-picker ^9.14.0` — already installed (used by Calendar component)
- `@base-ui/react ^1.4.0` — already installed (shadcn primitives)
- `zod ^4.3.6` — already installed

---

## Recommended Additions

### 1. Timezone-Aware Date Arithmetic

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| `@date-fns/tz` | `^1.3.0` | TZDate class for DST-safe cycle date arithmetic | Official date-fns team package (not the third-party `date-fns-tz`). date-fns v4 deliberately excludes timezone support from core to keep it lean — `@date-fns/tz` is the sanctioned companion. Provides `TZDate` which performs all arithmetic in the household's stored IANA timezone, automatically handling DST transitions. ~916 B (TZDateMini). 2.3M weekly downloads. |

**Why this is needed:** Cycle `startDate`/`endDate` boundaries are stored per-household with an IANA timezone field (e.g., `America/Toronto`). A 7-day cycle that crosses a DST boundary must compute the wall-clock end date in the household's timezone, not UTC. Plain `date-fns` `addDays()` on a UTC timestamp will produce the wrong wall-clock boundary after a DST shift. `TZDate` wraps a timestamp in the given zone and all date-fns functions operate correctly on it.

**What NOT to use:**
- `date-fns-tz` (package `marnusw/date-fns-tz`) — third-party, targets date-fns v3, dormant for v4 support (see GitHub issue #260)
- `luxon` — adds 50 KB, no integration with existing date-fns ecosystem in this codebase

---

### 2. Invitation Token Generation

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| `nanoid` | `^5.1.9` | Secure URL-safe invitation token generation | 118 bytes, zero dependencies. Uses `crypto.randomBytes()` in Node.js (same entropy as `crypto.randomBytes` direct calls). 21-character default output has ~126 bits of entropy — sufficient for invitation tokens with expiry. Already in use as a transitive dependency in this stack; adding it explicitly is near-zero cost. URL-safe alphabet avoids encoding issues in query strings. |

**Why not `crypto.randomBytes` directly:** You can use it — `crypto.randomBytes(32).toString('hex')` produces a 64-char hex token with 256 bits of entropy. This is also acceptable. `nanoid` is recommended because it produces shorter tokens (21 chars vs 64), is already a well-understood pattern in the Next.js ecosystem, and requires no manual encoding decisions. Either approach is correct.

**Why not `@paralleldrive/cuid2`:** CUID2 embeds a timestamp hash into the ID, which is useful for database primary keys (sortable, collision-resistant at scale) but unnecessary for single-use invitation tokens. Over-engineered for this use case.

**Why not `uuid`:** UUIDs are not cryptographically secure for tokens by default — only `crypto.randomUUID()` (built-in, Node 14.17+) is. If adding zero dependencies is the goal, `crypto.randomUUID()` is a valid alternative to nanoid for this specific use case (both produce URL-safe output with sufficient entropy).

**Verdict:** Use `nanoid` for ergonomics, or `crypto.randomUUID()` for zero-dependency. Do not use the `uuid` npm package.

---

### 3. Multi-Tenant Query Scoping (Prisma)

**No new library needed.** Use Prisma's built-in `$extends` query component API (GA since Prisma 4.16, stable in Prisma 7).

**Approach: Manual `householdId` where-clause per query (recommended for this app)**

Do NOT use a `$allModels` / `$allOperations` auto-injection extension for this app. Here is why:

The `$extends` query extension approach injects `where` conditions into top-level queries but **does not apply to nested reads and writes** — this is an explicit documented limitation. Including nested `plants` in a `household.findUnique({ include: { plants: true } })` would not have the household filter re-applied on the nested side without custom recursive logic or the community `prisma-extension-nested-operations` package. For Plant Minder's query patterns (fetching plants with watering logs, rooms with plants), the nested-read gap is a real pitfall.

The PostgreSQL RLS approach (setting `app.current_household_id` as a runtime parameter) is robust but requires:
- Custom Postgres row security policies on every table
- Per-request PrismaClient instantiation or transaction wrapping
- Non-trivial DB migration effort

**Recommended pattern:** Explicit `householdId` in every query `where` clause, passed from the session. This is:
- Simple to audit (every query explicitly declares its scope)
- Compatible with all Prisma v7 features including nested reads
- No new dependencies
- Proven in Next.js Server Actions pattern where `auth()` returns `activeHouseholdId`

Helper utility (no library needed):

```typescript
// lib/auth-context.ts
export async function getHouseholdContext() {
  const session = await auth();
  if (!session?.user?.activeHouseholdId) throw new Error('No active household');
  return {
    userId: session.user.id,
    householdId: session.user.activeHouseholdId,
  };
}
```

Every Server Action starts with `const { householdId } = await getHouseholdContext()` and every Prisma query includes `where: { householdId }`.

---

### 4. Active-Household in Session (NextAuth v5)

**No new library needed.** Uses existing NextAuth v5 beta callbacks + TypeScript module augmentation.

**Pattern:**

```typescript
// auth.ts — add to existing callbacks
callbacks: {
  async jwt({ token, user }) {
    if (user) {
      token.id = user.id;
      // On first sign-in, resolve the user's default household
      const member = await prisma.householdMember.findFirst({
        where: { userId: user.id, isDefault: true },
        select: { householdId: true },
      });
      token.activeHouseholdId = member?.householdId ?? null;
    }
    return token;
  },
  session({ session, token }) {
    session.user.id = token.id as string;
    session.user.activeHouseholdId = token.activeHouseholdId as string | null;
    return session;
  },
},
```

**Household switching (after user switches active household):**

NextAuth v5 beta exports `unstable_update` for server-side session mutation. A Server Action calls `unstable_update({ user: { activeHouseholdId: newId } })` which re-invokes the `jwt` callback and issues a refreshed session cookie. This is the current v5 pattern for post-sign-in session mutation — verified in community discussions (see sources).

**TypeScript module augmentation (add to `types/next-auth.d.ts`):**

```typescript
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      activeHouseholdId: string | null;
    } & DefaultSession["user"];
  }
}
declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    activeHouseholdId: string | null;
  }
}
```

**Caution:** `unstable_update` is named "unstable" intentionally — the API signature may change before NextAuth v5 reaches stable. It works in production as of v5 beta.30 but watch for breaking changes. The alternative is to always re-query the DB for the active household on each request (one extra query per request), avoiding the unstable API entirely.

---

### 5. Cycle Scheduling Engine

**No background-job library needed.** Use request-time lazy transitions.

**Recommendation: Request-time lazy cycle evaluation**

The rotation cycle is a deterministic, date-math-driven state machine. Given a household's `cycleDurationDays`, `rotationStartDate`, and the current UTC timestamp converted to the household's timezone, the current assignee can be computed in O(n) where n = number of rotation members. No persistent background job is needed.

**How it works:**

```typescript
// Pseudocode — runs in every Server Component that needs the current assignee
function computeCurrentAssignee(household, members, now: TZDate): Member {
  const cycleIndex = Math.floor(
    differenceInDays(now, TZDate(household.rotationStartDate, household.timezone))
    / household.cycleDurationDays
  );
  const activeIndex = cycleIndex % members.length;
  return members[activeIndex]; // ordered by rotationOrder
}
```

Cycle transitions happen naturally: when the dashboard is loaded after a cycle boundary has passed, the computed assignee is the next member. No cron needed to "flip a switch."

**When a background job WOULD be needed:**

- Sending email notifications at cycle start (deferred to a later milestone per PROJECT.md)
- Scheduled availability-expiry recalculations across all households simultaneously

Since email infrastructure is explicitly deferred, and in-app notification banners are query-time rendered, request-time lazy evaluation covers all in-scope notification requirements for this milestone.

**Vercel Cron is not recommended for this milestone because:**
1. Cron jobs run in UTC only — timezone-aware cycle boundaries require household-level timezone conversion, not a global cron
2. Minimum interval is once per hour on Pro plan (once per day on Hobby)
3. No retry mechanism if the function fails
4. Overkill when the same result is achievable through lazy evaluation on request

**If a background job is needed later (email milestone):**
Use **Inngest** — event-driven, serverless-compatible with Next.js, supports step functions, built-in retries, and timezone-aware scheduling. Do NOT add it in this milestone.

---

### 6. shadcn/ui Primitives

The app already uses `@base-ui/react` and `react-day-picker`. The following shadcn/ui components are needed for new UI surfaces but may not yet be installed via `npx shadcn@latest add`:

| Component | CLI Command | Used For | Already Installed? |
|-----------|-------------|----------|-------------------|
| `calendar` | `npx shadcn@latest add calendar` | Availability period date selection | `react-day-picker` is installed (Calendar's dep), but Calendar component itself may need to be added to components/ |
| `date-picker` | Built from Popover + Calendar | Availability start/end date inputs | Not a standalone install — compose from Calendar + Popover |
| `combobox` | Built from Popover + Command | Household member selector, rotation reorder | Not a standalone install — compose from Command + Popover |
| `sheet` | `npx shadcn@latest add sheet` | Household settings panel (mobile drawer pattern already used) | Likely already installed given existing ResponsiveDialog pattern — verify |
| `popover` | `npx shadcn@latest add popover` | Calendar trigger | Likely already installed — verify |
| `command` | `npx shadcn@latest add command` | Combobox inner component | Verify |

**No date-range-picker library needed.** The availability period UI is a simple start-date + end-date pair (two separate date pickers). A full date-range-picker component adds complexity without proportional value for this use case. The `DateRangePicker` community component (`johnpolacek/date-range-picker-for-shadcn`) is not needed.

**Do NOT add:**
- Any calendar library beyond react-day-picker (already installed)
- A separate drag-and-drop library for rotation reordering — HTML5 drag events are sufficient for a simple ordered list of 2-8 members

---

## Installation

```bash
# Timezone support for cycle date arithmetic
npm install @date-fns/tz

# Invitation token generation (or use crypto.randomUUID() — no install needed)
npm install nanoid

# shadcn/ui components (verify which are already in components/)
npx shadcn@latest add calendar
npx shadcn@latest add sheet
npx shadcn@latest add popover
npx shadcn@latest add command
```

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| `@date-fns/tz` | `date-fns-tz` (marnusw) | Third-party, targets date-fns v3, no v4 support (GitHub issue #260 open). Official `@date-fns/tz` is the sanctioned replacement. |
| `@date-fns/tz` | `luxon` | 50 KB overhead, different API than existing date-fns usage. No justification to introduce a second date library. |
| `nanoid` | `crypto.randomUUID()` | Both are fine. `crypto.randomUUID()` is zero-dependency (built into Node 14.17+). Choose either. `nanoid` wins on token length ergonomics. |
| `nanoid` | `@paralleldrive/cuid2` | CUID2 is optimized for sortable database IDs, not opaque invitation tokens. Overkill. |
| Manual `where: { householdId }` | Prisma `$extends` auto-injection | `$extends` query extension does not apply to nested reads — a documented limitation. Manual explicit scoping is safer and fully auditable. |
| Manual `where: { householdId }` | PostgreSQL RLS | RLS is more secure (DB-enforced) but requires migration of every table, custom policies, and per-request transaction wrapping. High complexity for a 2-person household feature at current scale. Revisit if the app moves to many-tenant SaaS model. |
| Request-time lazy cycle eval | Vercel Cron | Cron is UTC-only, has no retries, and requires infrastructure that adds no value when the same result is achievable deterministically at request time. |
| Request-time lazy cycle eval | Inngest | Inngest is the right tool if/when email notifications are added. Not needed for in-app-only notifications. |
| Request-time lazy cycle eval | BullMQ | Requires Redis. Zero justification for a Redis dependency at this scale. |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `date-fns-tz` (marnusw/date-fns-tz) | Targets date-fns v3; no v4 support; community-maintained, not official | `@date-fns/tz` (official date-fns team) |
| `luxon` | 50 KB, duplicate date handling, no integration with existing date-fns code | `@date-fns/tz` TZDate |
| Email libraries (Resend, SendGrid, Nodemailer) | Explicitly deferred per PROJECT.md. Do not add infra for out-of-scope features. | None — in-app notifications only |
| Inngest / BullMQ / Trigger.dev | Background job infrastructure not needed for this milestone's in-app-only notification scope | Request-time lazy cycle evaluation |
| `react-beautiful-dnd` / `@dnd-kit/core` | Full drag-and-drop for rotation reordering is overkill for a list of 2-8 people | HTML5 drag events or shadcn sortable pattern |
| `date-range-picker-for-shadcn` (community) | Availability periods use two separate date pickers, not a range selector | Two Calendar + Popover instances |
| ZenStack | Policy-layer on top of Prisma adds a build step and DSL learning curve. Appropriate for open-SaaS products, not a focused feature addition to an existing app. | Manual `where: { householdId }` |
| `@prisma/extension-accelerate` | Connection pooling/caching service — adds Prisma Cloud dependency. Premature optimization at current scale. | Existing `@prisma/adapter-pg` |

---

## Stack Patterns by Variant

**For cycle boundary computation:**
- Store `cycleDurationDays` and `rotationStartDate` (UTC) on the `Household` record, plus `timezone` as an IANA string
- At query time: `new TZDate(rotationStartDate, household.timezone)` then `differenceInDays(now, start)` to derive cycle index
- Because: all date-fns functions accept `TZDate` transparently; no new API to learn

**For household switcher UI:**
- On switch: Server Action calls `unstable_update({ user: { activeHouseholdId: newId } })` then `redirect()` to refresh dashboard
- Because: Re-renders the dashboard with the new household context without a full sign-out/sign-in

**For invitation link delivery:**
- Generate token with `nanoid()` or `crypto.randomUUID()`
- Store hashed token in DB (`crypto.createHash('sha256').update(token).digest('hex')`) — never store raw token
- Surface the raw token in the app UI as a copyable link (e.g., `https://app.example.com/join?token=...`)
- Because: No email infrastructure in scope; user copies and shares link manually

**For notification scoping:**
- When computing `Reminder` records for the notification center, add `WHERE assignedUserId = currentUserId` to the cycle-aware notification query
- Because: Existing notification center already reads from DB; scoping is a query-layer change, not a new component

---

## Version Compatibility

| Package | Version | Compatible With | Notes |
|---------|---------|-----------------|-------|
| `@date-fns/tz` | `^1.3.0` | `date-fns ^4.1.0` | Official companion to date-fns v4. Not compatible with date-fns v3. |
| `nanoid` | `^5.1.9` | Node.js >= 18 (ESM) | v5 is ESM-only. Next.js 16 App Router runs in ESM context — compatible. If using in an edge route, verify. CJS projects need nanoid v3. This project is ESM. |
| `unstable_update` | ships with `next-auth@beta` | next-auth 5.0.0-beta.30 | Named `unstable_update` — API may change before v5 stable. |

---

## Sources

- [Prisma Client Extensions — query component](https://www.prisma.io/docs/orm/prisma-client/client-extensions/query) — $allModels/$allOperations pattern, nested read limitation (HIGH confidence, official docs)
- [prisma-client-extensions/row-level-security](https://github.com/prisma/prisma-client-extensions/tree/main/row-level-security) — per-request RLS extension pattern (HIGH confidence, official Prisma repo)
- [Auth.js — Extending the Session](https://authjs.dev/guides/extending-the-session) — jwt + session callbacks, module augmentation pattern (HIGH confidence, official Auth.js docs)
- [NextAuth v5 unstable_update discussion](https://github.com/nextauthjs/next-auth/discussions/10366) — Server-side session mutation API pattern (MEDIUM confidence, community-confirmed)
- [date-fns v4 timezone support blog](https://blog.date-fns.org/v40-with-time-zone-support/) — confirms @date-fns/tz is the official companion, not bundled in core (HIGH confidence, official date-fns blog)
- [@date-fns/tz npm](https://www.npmjs.com/package/@date-fns/tz) — 2.3M weekly downloads, v1.3.0+ (HIGH confidence, npm registry)
- [date-fns/tz GitHub](https://github.com/date-fns/tz) — TZDate API, DST handling (HIGH confidence, official source)
- [nanoid GitHub](https://github.com/ai/nanoid) — v5.1.9, ESM-only, crypto.randomBytes under the hood (HIGH confidence, official source)
- [Vercel Cron Jobs docs](https://vercel.com/docs/cron-jobs) — UTC-only confirmed, plan-tier minimums (HIGH confidence, official Vercel docs)
- [ZenStack: Prisma Client Extensions Use Cases and Pitfalls](https://zenstack.dev/blog/prisma-client-extensions) — nested read limitation documented (MEDIUM confidence, well-regarded ORM tooling blog)
- [prisma-extension-nested-operations](https://github.com/olivierwilkinson/prisma-extension-nested-operations) — community workaround for nested-read limitation (MEDIUM confidence, community package)

---

*Stack research for: Household + Rotation milestone (Plant Minder)*
*Researched: 2026-04-16*

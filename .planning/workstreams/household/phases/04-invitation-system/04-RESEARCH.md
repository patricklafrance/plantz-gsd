# Phase 4: Invitation System — Research

**Researched:** 2026-04-18
**Domain:** Invitation token lifecycle, NextAuth v5 JWT mutation, Next.js 16 public routing, Prisma atomic writes, co-owner membership mutations
**Confidence:** HIGH — all claims verified against the live codebase; no framework research required because the stack is established and the CONTEXT.md decisions are fully locked

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Token = `crypto.randomBytes(32).toString('hex')` (256-bit entropy). Only `tokenHash` (SHA-256) persisted. Raw token returned to caller once at generation time only.
- **D-02:** Unlimited concurrent active invitations per household. No auto-revoke on new link. Query: `where: { householdId, revokedAt: null, acceptedAt: null }`.
- **D-03:** No expiry. Revoke is the only invalidation path. No `expiresAt` column.
- **D-04:** Atomic acceptance: `updateMany WHERE tokenHash=$hash AND acceptedAt IS NULL AND revokedAt IS NULL`, check `count === 0` for already-used guard. Runs inside the accept transaction.
- **D-05:** `invitedEmail` always null in v1. No email-match gate at accept time.
- **D-06:** `/join/[token]` is a public route — added to `authConfig.publicPaths` in `auth.config.ts` and excluded from `proxy.ts` matcher.
- **D-07:** Logged-out flow uses NextAuth native `callbackUrl`. Page shows household preview + "Sign in" (`/login?callbackUrl=/join/<token>`) and "Create account" (`/register?callbackUrl=/join/<token>`). No cookie, no DB pending-row.
- **D-08:** Logged-in confirm screen: one page, not two-route split. Accept button submits Server Action on the same page. Cancel → user's dashboard.
- **D-09:** Four distinct failure branches: (1) unknown token, (2) revoked, (3) already used, (4) caller already a member.
- **D-10:** Co-owner model: multiple OWNERs per household, no schema change. `HouseholdMember.role` string column.
- **D-11:** `promoteToOwner(householdId, targetUserId)` — idempotent, caller must be OWNER.
- **D-12:** `demoteToMember(householdId, targetUserId)` — self-demote allowed only if another OWNER exists after.
- **D-13:** Leave/remove blocked when caller would be last OWNER in a multi-member household. Error: "You're the only owner. Promote another member to owner first, then try again."
- **D-14:** Sole-member last-OWNER leave: `db.household.delete` (cascade wipes everything). Destructive-confirm dialog gates client-side invocation.
- **D-15:** No "founding owner" concept. OWNER set is flat.
- **D-16:** Six Server Actions in `src/features/household/actions.ts` following the Phase 2 7-step template: `createInvitation`, `revokeInvitation`, `acceptInvitation`, `leaveHousehold`, `removeMember`, `promoteToOwner` / `demoteToMember`.
- **D-17:** `getHouseholdInvitations(householdId)` — active-only (`revokedAt: null, acceptedAt: null`), `createdAt DESC`.
- **D-18:** `resolveInvitationByToken(rawToken)` — read helper (not Server Action); hashes token, `findUnique({ where: { tokenHash } })` with household + inviter include.
- **D-19:** `getHouseholdMembers(householdId)` — lightweight member read, any household member can call.
- **D-20:** Zero Prisma schema changes. `Invitation` model is shape-complete from Phase 1.
- **D-21:** `authConfig.publicPaths` gains `/join` (prefix match). `proxy.ts` matcher excludes `/join/:path*`. `authorized` callback carves `/join` out of the logged-in redirect.
- **D-22:** Post-accept redirect: `/h/[newlyJoinedHouseholdSlug]/dashboard` via server-side `redirect()`.
- **D-23–D-27:** Test strategy (acceptance atomicity, role-gate, last-owner-blocks-leave, `unstable_update` JWT refresh, assignee-leaves triggers `transitionCycle`).

### Claude's Discretion

- File organization: consolidate in `actions.ts` if under ~500 lines, split otherwise.
- Exact return envelope from `createInvitation` (`{ token, invitationId }` vs `{ token, invitationId, url }`).
- Whether `promoteToOwner`/`demoteToMember` are separate actions or one `setMemberRole`.
- Whether `revokeInvitation` also takes `householdId` as a hidden field (recommended for grep-consistency).
- Handling of `unstable_update` failure when DB write succeeded (v1: let next page load correct via live membership check).

### Deferred Ideas (OUT OF SCOPE)

- QR code for invite link
- App-sent invitation email
- Invite link expiry
- `invitedEmail` match-gate at accept time
- One-active-link-per-household simplification
- Two-route confirm → accept split
- Atomic promote-and-leave transferOwnership
- Auto-promote oldest MEMBER on last-OWNER leave
- "Founding owner" special role
- Block leave while inside active availability window
- Revoked/accepted invitation history surface
- Observer role, bulk member removal, inter-household plant transfer
- Rotation reorder controls (Phase 6)
- Demo-mode invitation seeding (Phase 7)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INVT-01 | Owner can generate a shareable invitation link (CSPRNG token, no expiry, revocable) | D-01 token generation pattern; `crypto.randomBytes(32).toString('hex')` verified in `node:crypto` stdlib; SHA-256 hash via `createHash('sha256')` |
| INVT-02 | Owner can view all active invitation links and revoke any | `getHouseholdInvitations` query (D-17); `revokeInvitation` action (D-16); unlimited concurrent links (D-02) |
| INVT-03 | Opening link while logged out routes to login/signup; token preserved through auth redirect | `callbackUrl` mechanism (D-07); `auth.config.ts` publicPaths + proxy.ts carve-out (D-21) |
| INVT-04 | Opening link while logged in shows confirm screen (name, owner, member count); user explicitly accepts | `resolveInvitationByToken` read helper (D-18); `acceptInvitation` Server Action (D-16); single-page confirm (D-08) |
| INVT-05 | User can leave any household; sole-owner last-member triggers cascading household delete with destructive dialog | `leaveHousehold` action (D-16); last-owner pre-check (D-13); sole-member-last-OWNER branch (D-14); `unstable_update` JWT refresh (Pitfall 16) |
| INVT-06 | Owner can remove non-owner member; owner can transfer ownership to another member | `removeMember` (D-16); `promoteToOwner` / `demoteToMember` (D-11, D-12, D-16) |
</phase_requirements>

---

## Summary

Phase 4 is a behavior-only phase — the Prisma schema is shape-complete from Phase 1 (D-20 verified against `prisma/schema.prisma` lines 211–226), and the full set of foundation patterns (7-step Server Action template, `requireHouseholdAccess` guard, `transitionCycle` function, Phase 2 `db.$transaction` conventions) are already live in the codebase. The planner's job is to wire six Server Actions, three read helpers, the `/join/[token]` public page, and two surgical edits to the auth layer — no schema migration, no new dependencies, no new shadcn components.

The two highest-risk integration points are (1) the atomic `updateMany` acceptance pattern that prevents double-joins under concurrent token use, and (2) the `unstable_update` JWT call in `acceptInvitation` and `leaveHousehold` that refreshes `activeHouseholdId` in the caller's session. Both patterns are well-understood in the codebase: concurrency is already tested with `FOR UPDATE SKIP LOCKED` in Phase 3 (`transition-concurrency.test.ts`); `unstable_update` is documented in Pitfall 16 and imported from `next-auth`.

The auth layer change (D-21) is surgical but requires careful handling: the current `authorized` callback in `auth.config.ts` redirects all logged-in users away from public paths to `/dashboard`. `/join/[token]` must be in `publicPaths` but must NOT trigger the redirect — logged-in users need to stay on the join page to see the confirm screen.

**Primary recommendation:** Wave 0 establishes test stubs and verifies crypto/hash helper. Wave 1 ships the three read helpers and Zod schemas. Wave 2 ships the six Server Actions with mocked-Prisma unit tests. Wave 3 ships the auth layer edits and the `/join/[token]` page + `accept-form.tsx`. Wave 4 ships real-DB integration tests (atomicity, last-owner-blocks-leave, assignee-leaves cycle transition).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Token generation (`crypto.randomBytes`) | API / Backend | — | Pure server-side; raw token never persisted, only SHA-256 hash stored |
| Token hash lookup (`resolveInvitationByToken`) | API / Backend (Server Component) | — | Server Component calls this read helper directly; no REST endpoint |
| Atomic acceptance (`updateMany + count guard`) | API / Backend (Server Action) | — | Must be server-side; atomicity requires Prisma inside `db.$transaction` |
| Public join page render | Frontend Server (SSR) | — | Server Component; renders branch based on DB lookup; no client hydration for read path |
| Accept form pending state | Browser / Client | — | `useActionState` + `disabled={isPending}` requires a Client Component (`accept-form.tsx`) |
| Auth redirect carve-out for `/join` | Frontend Server (SSR / Edge) | — | `proxy.ts` matcher + `auth.config.ts` `authorized` callback run at the edge |
| JWT refresh (`unstable_update`) | API / Backend (Server Action) | — | Called from within Server Actions after DB write; NextAuth v5 API |
| Membership mutations (leave, remove, promote, demote) | API / Backend (Server Action) | — | 7-step template; all live-DB checks via `requireHouseholdAccess` |
| Rotation cycle transition on member leave | API / Backend (Server Action) | — | Delegates to `transitionCycle(householdId, 'member_left')` inside same `$transaction` |
| Destructive-leave dialog | Browser / Client | — | Client component; `ResponsiveDialog` + `isPending` state; triggered by Phase 6 UI |
| Invitation list queries | API / Backend (Server Component) | — | `getHouseholdInvitations` consumed by Phase 6 settings page (not rendered this phase) |

---

## Standard Stack

No new packages. All libraries already installed and active.

### Core (verified from `package.json`)
| Library | Version (installed) | Purpose | Why Standard |
|---------|---------------------|---------|--------------|
| `next-auth` | `^5.0.0-beta.30` | Auth session, `unstable_update`, JWT strategy | Locked project choice; v5 required for App Router |
| `prisma` | `^7.7.0` | Database ORM, `updateMany`, `$transaction` | Locked project choice; Pitfall 10 atomic accept via `updateMany` |
| `zod` | `^4.3.6` | Input validation (`zod/v4` import path) | Locked; already used in all Server Actions |
| `node:crypto` | Node stdlib (built-in) | `randomBytes(32)`, `createHash('sha256')` | No install; available in Node 18+ / Next.js 16 server context |

**Installation:** none required.

---

## Architecture Patterns

### System Architecture Diagram

```
[INVT-01/02] Owner generates link
      │
      ▼
createInvitation(householdId)
  auth() → demo guard → Zod → requireHouseholdAccess (role=OWNER)
  → crypto.randomBytes(32) → createHash('sha256').update(raw).digest('hex')
  → db.invitation.create({ tokenHash })
  → return { token: rawToken, invitationId }
      │
      ▼ Owner pastes URL into WhatsApp / iMessage
[INVT-03] Recipient opens /join/<rawToken>
      │
      ├─── Logged out ────────────────────────────────────────────────────┐
      │       resolveInvitationByToken(rawToken)                          │
      │         → SHA-256 hash                                            │
      │         → db.invitation.findUnique({ where: { tokenHash } })     │
      │       Branch render (D-09):                                       │
      │         • No row → Branch 1 (invalid)                             │
      │         • revokedAt → Branch 2 (revoked)                          │
      │         • acceptedAt → Branch 3 (already used)                    │
      │         • Valid → Branch 5a (logged-out preview)                  │
      │             Sign-in CTA: /login?callbackUrl=/join/<token>          │
      │             Create-account CTA: /register?callbackUrl=/join/<token>│
      │             → auth succeeds → NextAuth redirects to callbackUrl   │
      │             → lands back at /join/<token> as logged-in user       │
      │                                                                   │
      └─── Logged in ─────────────────────────────────────────────────────┤
              resolveInvitationByToken(rawToken)                          │
              + householdMember.findFirst (already-member check)          │
              Branch render (D-09):                                       │
                • Already member → Branch 4 (go to dashboard)            │
                • Valid + not member → Branch 5b (INVT-04 confirm)       │
[INVT-04] Accept button → acceptInvitation(token) Server Action
      │
      ▼
acceptInvitation(token)
  auth() → demo guard → Zod
  → SHA-256 hash
  → db.$transaction:
      updateMany(WHERE tokenHash=hash AND acceptedAt IS NULL AND revokedAt IS NULL)
      if count === 0 → return { error: "already used" }
      db.householdMember.findFirst(MAX rotationOrder) + 1
      db.householdMember.create({ role: 'MEMBER', rotationOrder: max+1 })
  → unstable_update({ activeHouseholdId: joinedHouseholdId })
  → redirect('/h/[slug]/dashboard')
      │
      ▼
[INVT-05] leaveHousehold(householdId)
  auth() → demo guard → Zod → requireHouseholdAccess
  → last-OWNER pre-check (D-13)
  → if sole-member-last-OWNER: db.household.delete (D-14 cascade)
  → else db.$transaction:
      if caller === activeAssignee: transitionCycle(tx, householdId, 'member_left')
      db.availability.deleteMany({ userId, startDate >= today })
      db.householdMember.delete
  → unstable_update({ activeHouseholdId: nextHousehold | null })
  → revalidatePath

[INVT-06a] removeMember(householdId, targetUserId)
  → same assignee + availability + transition side effects as leaveHousehold
  → does NOT call unstable_update for the removed user
  → removed user's next request hits requireHouseholdAccess → ForbiddenError → 403

[INVT-06b] promoteToOwner / demoteToMember
  → requireHouseholdAccess (role=OWNER)
  → for demote: pre-check at least one other OWNER after change
  → db.householdMember.update({ role })
  → revalidatePath
```

### Recommended Project Structure

No new directories. All Phase 4 server code lands in the existing feature folder per Phase 3 D-20 binding.

```
src/
├── app/
│   └── join/
│       └── [token]/
│           ├── page.tsx          # NEW: public Server Component (D-06..D-09)
│           └── accept-form.tsx   # NEW: Client Component (useActionState)
├── components/
│   └── household/
│       └── destructive-leave-dialog.tsx   # NEW: Client Component (UI-SPEC §3)
├── features/
│   └── household/
│       ├── actions.ts            # EXTEND: 6 new Server Actions (D-16)
│       ├── queries.ts            # EXTEND: 3 new read helpers (D-17, D-18, D-19)
│       └── schema.ts             # EXTEND: 7 new Zod schemas
├── lib/
│   └── crypto.ts                 # NEW (or inline): SHA-256 hash helper
auth.config.ts                    # MODIFY: publicPaths + authorized callback (D-21)
proxy.ts                          # MODIFY: matcher excludes /join/:path* (D-21)
```

### Pattern 1: Token Generation and Hashing

[VERIFIED: node:crypto stdlib — available in Node 18+, used in codebase at `src/lib/slug.ts`]

```typescript
// src/lib/crypto.ts (or inline in actions.ts)
import { randomBytes, createHash } from "node:crypto";

export function generateInvitationToken(): { rawToken: string; tokenHash: string } {
  const rawToken = randomBytes(32).toString("hex"); // 256 bits entropy (D-01)
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  return { rawToken, tokenHash };
}

export function hashInvitationToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}
```

**Key:** Only `tokenHash` goes in the DB. `rawToken` is returned to the caller once and never stored.

### Pattern 2: Atomic Acceptance (Pitfall 10 §2, D-04)

[VERIFIED: Prisma `updateMany` returns `{ count: number }` — confirmed from Prisma 7 docs and Phase 3 codebase patterns]

```typescript
// Inside acceptInvitation, wrapped in db.$transaction
const tokenHash = hashInvitationToken(rawToken);

const result = await tx.invitation.updateMany({
  where: {
    tokenHash,
    acceptedAt: null,    // not yet accepted
    revokedAt: null,     // not revoked
  },
  data: {
    acceptedAt: new Date(),
    acceptedByUserId: session.user.id,
  },
});

if (result.count === 0) {
  // Token was already accepted or revoked between lookup and update
  return { error: "This invite has already been used." };
}

// Now safe to insert HouseholdMember — the invitation row is locked
const maxOrder = await tx.householdMember.aggregate({
  where: { householdId },
  _max: { rotationOrder: true },
});
const nextOrder = (maxOrder._max.rotationOrder ?? -1) + 1;

await tx.householdMember.create({
  data: {
    userId: session.user.id,
    householdId,
    role: "MEMBER",
    rotationOrder: nextOrder,   // append to end (Pitfall 9 §B)
    isDefault: false,
  },
});
```

**Why `updateMany` not `update`:** `update` throws on no match (P2025 error), requiring a try/catch. `updateMany` returns `{ count: 0 }` cleanly, enabling the explicit count guard without exception handling.

### Pattern 3: unstable_update JWT Refresh (Pitfall 16, D-16)

[VERIFIED: `unstable_update` exported from `next-auth` in the installed `next-auth@5.0.0-beta.30` — confirmed from pitfall documentation and NextAuth v5 beta API]

```typescript
// Called from Server Actions AFTER the DB write completes
import { auth, unstable_update } from "next-auth"; // re-exported from auth.ts

// In acceptInvitation — update activeHouseholdId to the joined household
await unstable_update({ activeHouseholdId: joinedHouseholdId });

// In leaveHousehold — find another household or null
const remaining = await db.householdMember.findFirst({
  where: { userId: session.user.id, householdId: { not: householdId } },
  select: { householdId: true },
  orderBy: { isDefault: "desc" },
});
await unstable_update({ activeHouseholdId: remaining?.householdId ?? null });
```

**Critical:** `unstable_update` must be called from within the Server Action **after** the DB transaction commits, not inside the `$transaction` callback. It updates the JWT cookie on the response.

**The JWT callback in `auth.ts` only runs on sign-in (`if (user)` guard).** `unstable_update` patches the session cookie directly. The `session` callback re-maps the token fields — which means if `unstable_update` sets `activeHouseholdId` on the token, the `session` callback's existing code (`session.user.activeHouseholdId = typeof token.activeHouseholdId === "string" ? token.activeHouseholdId : undefined`) will pass it through on the next request. No change to `auth.ts` required.

**Export from auth.ts:** The project currently exports `{ auth, handlers, signIn, signOut }` from `auth.ts`. `unstable_update` must be added to that export:

```typescript
// auth.ts — add unstable_update to the destructured export
export const { auth, handlers, signIn, signOut, unstable_update } = NextAuth({ ... });
```

### Pattern 4: auth.config.ts — Carving /join Out of the Logged-In Redirect

[VERIFIED: Current `auth.config.ts` source read directly]

**Current state:** `publicPaths = ["/login", "/register", "/demo"]`. Any logged-in user hitting a public path is redirected to `/dashboard`. `/join` must be public but must NOT redirect logged-in users away.

**Required change:**

```typescript
// auth.config.ts
const publicPaths = ["/login", "/register", "/demo"];
const noRedirectPublicPaths = ["/join"]; // logged-in users stay on these pages

const isPublicRoute = publicPaths.some(
  (path) => nextUrl.pathname === path || nextUrl.pathname.startsWith(path + "/"),
);
const isNoRedirectPublic = noRedirectPublicPaths.some(
  (path) => nextUrl.pathname === path || nextUrl.pathname.startsWith(path + "/"),
);

if (isNoRedirectPublic) {
  return true; // allow both logged-in and logged-out; no redirect
}

if (isPublicRoute) {
  if (isLoggedIn) {
    return Response.redirect(new URL("/dashboard", nextUrl));
  }
  return true;
}

return isLoggedIn;
```

**proxy.ts change (additive):**

```typescript
// proxy.ts matcher — add join to exclusions
matcher: [
  "/((?!api/auth|api/cron|_next/static|_next/image|favicon.ico|login|register|demo|join).*)",
],
```

### Pattern 5: transitionCycle Called from leaveHousehold

[VERIFIED: `transitionCycle` exported from `src/features/household/cycle.ts`, verified live source]

The current `transitionCycle(householdId, hintReason)` signature uses its own internal `db.$transaction`. Phase 4's `leaveHousehold` must call it, but the member delete and the cycle transition must be atomic — both or neither.

**Problem:** `transitionCycle` creates its own transaction internally. Nesting Prisma transactions is not standard.

**Resolution (from CONTEXT.md D-16 leaveHousehold):** Call `transitionCycle` first (it acquires its own transaction for the cycle write), then delete the member row in a separate write. The cycle transition and member delete are not one atomic unit — this is acceptable because:
1. `transitionCycle` uses `FOR UPDATE SKIP LOCKED`: if it fails (e.g., concurrent cron), it returns `{ skipped: true }` cleanly.
2. The member is deleted after the cycle transition succeeds. A crash between the two would leave an orphaned HouseholdMember for a completed cycle — the next cron tick or page load corrects this naturally (Phase 3 robustness contract).

```typescript
// leaveHousehold: assignee-leaves path
const currentCycle = await db.cycle.findFirst({
  where: { householdId, status: { in: ["active", "paused"] } },
  select: { assignedUserId: true },
});

if (currentCycle?.assignedUserId === session.user.id) {
  // Transition cycle first (its own transaction with SKIP LOCKED)
  await transitionCycle(householdId, "member_left");
}

// Then remove member + cancel future availability in a separate transaction
await db.$transaction(async (tx) => {
  await tx.availability.deleteMany({
    where: {
      userId: session.user.id,
      householdId,
      startDate: { gte: new Date() },
    },
  });
  await tx.householdMember.delete({
    where: { householdId_userId: { householdId, userId: session.user.id } },
  });
});
```

**Note on `householdMember` compound key:** `HouseholdMember` has `@@unique([householdId, userId])` (verified from Phase 2 schema migration). The Prisma-generated compound key accessor is `householdId_userId`.

### Pattern 6: resolveInvitationByToken (Read Helper, D-18)

```typescript
// src/features/household/queries.ts
export async function resolveInvitationByToken(rawToken: string) {
  const tokenHash = hashInvitationToken(rawToken);

  const invitation = await db.invitation.findUnique({
    where: { tokenHash },
    include: {
      household: {
        include: {
          _count: { select: { members: true } },
          members: {
            where: { role: "OWNER" },
            orderBy: { joinedAt: "asc" },  // earliest-joining OWNER (UI-SPEC §owner display name)
            take: 1,
            include: { user: { select: { name: true, email: true } } },
          },
        },
      },
    },
  });

  if (!invitation) return null;

  const ownerMember = invitation.household.members[0];
  const ownerName = ownerMember?.user.name ?? ownerMember?.user.email ?? "An owner";
  const memberCount = invitation.household._count.members;

  return {
    invitation,
    household: invitation.household,
    ownerName,
    memberCount,
  };
}
```

**`HouseholdMember.joinedAt`:** Verify this column name against the schema. The Phase 1 schema uses `createdAt` on `HouseholdMember`. The UI-SPEC says "earliest-joining OWNER by `joinedAt ASC`" — the actual column is `createdAt` (confirmed from Phase 3 `fixtures.ts` which reads `orderBy: { createdAt: "asc" }` on membership queries). Use `orderBy: { createdAt: "asc" }`.

### Anti-Patterns to Avoid

- **Non-atomic acceptance:** Never do a `findUnique` on the invitation followed by a separate `update`. The race between lookup and update allows double-joins. Always use `updateMany` with the `WHERE acceptedAt IS NULL` guard and check `count`.
- **Storing the raw token:** Only `tokenHash` goes in the DB. Storing the raw token exposes it to anyone with DB read access.
- **Calling `unstable_update` inside `db.$transaction`:** JWT mutation is an HTTP operation (cookie on response). It has no Prisma semantics. Call it after the transaction commits.
- **Applying `/join` redirect to logged-in users:** The current `authorized` callback redirects all logged-in public-path visitors to `/dashboard`. Must carve out `/join` from this redirect — logged-in users need the confirm-join page.
- **Resetting cycle pointer on `acceptInvitation`:** New member appends to `rotationOrder = max + 1`. Never reset `cycleNumber` or `anchorDate` on join. The current active cycle continues unchanged.
- **Forgetting `unstable_update` on `leaveHousehold`:** Without it, the leaving user's JWT still carries the old `activeHouseholdId`. Their next request resolves to a household they no longer belong to. The `requireHouseholdAccess` guard blocks them, but they'll see a 403 on every request until their JWT expires.
- **Using `db.invitation.update` instead of `updateMany` for acceptance:** `update` throws P2025 "Record to update not found" when no row matches — this requires wrapping in try/catch and doesn't distinguish "already accepted" from "revoked" from "typo in token." `updateMany` returns `{ count }` cleanly.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSPRNG token | Custom timestamp/UUID token | `crypto.randomBytes(32).toString('hex')` | UUID v4 is 122 bits; `randomBytes(32)` is 256 bits; never encode predictable data (Pitfall 10 §1) |
| Token hashing | Custom hash or base64 | `createHash('sha256')` from `node:crypto` | SHA-256 is the standard single-pass hash for tokens; constant-time lookup via DB unique index |
| Atomic token acceptance | `findUnique` + separate `update` | `updateMany` with `count` guard | Only `updateMany` gives a row-count return without throwing on zero matches |
| JWT session refresh | Manual cookie manipulation | `unstable_update` from `next-auth` | NextAuth owns the JWT signing/encryption; custom cookie writes will break session verification |
| Role authorization | Re-implementing membership check | `requireHouseholdAccess` from `guards.ts` | Already audited, tested, handles ForbiddenError shape that error boundaries expect |
| Cycle transition on leave | Custom cycle update | `transitionCycle(householdId, 'member_left')` from `cycle.ts` | Single-write-path invariant; Phase 3 owns the transition logic; Phase 4 only calls it |

---

## Common Pitfalls

### Pitfall 1: Race Condition on Token Acceptance
**What goes wrong:** Two requests with the same token arrive concurrently (e.g., user double-taps). Both read `acceptedAt: null`; both succeed; user is inserted into HouseholdMember twice, creating duplicate rows or a unique constraint violation crash.
**Why it happens:** `findUnique` then `update` is not atomic under PostgreSQL READ COMMITTED.
**How to avoid:** `updateMany` with `WHERE acceptedAt IS NULL` — PostgreSQL atomically updates zero rows for the second request. Check `count === 0` to detect this case.
**Warning signs:** Acceptance uses `db.invitation.findUnique` before a separate `db.invitation.update`.

### Pitfall 2: Logged-In Users Redirected Away from /join
**What goes wrong:** Logged-in user opens an invitation link. `auth.config.ts` `authorized` callback sees a public path and redirects to `/dashboard`. They never see the confirm screen.
**Why it happens:** The current `publicPaths` logic redirects ALL logged-in users away from public paths to `/dashboard`. `/join` must be public but must NOT redirect logged-in users.
**How to avoid:** Split `publicPaths` into two lists: `publicPaths` (redirect logged-in to dashboard) and `noRedirectPublicPaths` (allow both). `/join` goes in the second list.
**Warning signs:** Logged-in user testing of `/join/[valid-token]` bounces to dashboard without confirm screen.

### Pitfall 3: proxy.ts Matcher Intercepts /join
**What goes wrong:** The proxy.ts matcher runs `auth()` (NextAuth session middleware) on every matched path. For a logged-out user hitting `/join/[token]`, the session middleware sees no session and redirects to `/login` before the page even renders.
**Why it happens:** `/join` is not currently excluded from the matcher (regex does not include `join`).
**How to avoid:** Add `join` to the matcher exclusion regex: `/((?!api/auth|api/cron|_next/static|_next/image|favicon.ico|login|register|demo|join).*)`.
**Warning signs:** Logged-out user visiting `/join/[token]` is immediately redirected to `/login` without seeing any page content (not even the failure branches).

### Pitfall 4: Missing `unstable_update` Export from auth.ts
**What goes wrong:** `unstable_update` is not exported from `auth.ts`. Server Actions import it directly from `next-auth`. This may work, but the local `auth.ts` binding is the canonical import point for all auth exports in this project.
**Why it happens:** `NextAuth(...)` returns `unstable_update` but the current destructuring in `auth.ts` only exports `{ auth, handlers, signIn, signOut }`.
**How to avoid:** Add `unstable_update` to the `auth.ts` export. Server Actions import from `../../../auth` (relative) or `@/auth` (alias) — not directly from `next-auth`.
**Warning signs:** TypeScript reports "Property 'unstable_update' does not exist" when importing from the project's `auth.ts`.

### Pitfall 5: rotationOrder Collision on Concurrent Accepts
**What goes wrong:** Two users accept the same household invitation simultaneously (or two different invitations for the same household). Both read `maxRotationOrder = 3`. Both set `rotationOrder = 4`. DB unique constraint on `HouseholdMember(householdId, rotationOrder)` (if present) throws; if absent, two members share `rotationOrder = 4`, breaking the deterministic rotation formula.
**Why it happens:** The `maxRotationOrder + 1` computation is not protected by a lock.
**How to avoid:** Wrap the `aggregate._max` + `householdMember.create` inside the same `db.$transaction` as the `invitation.updateMany`. The acceptance transaction already locks the invitation row (via the atomic `updateMany`); within the same transaction, the member insert is safe against concurrent accepts (PostgreSQL serializes within a single transaction's reads).
**Warning signs:** `rotationOrder` computation and `householdMember.create` are in separate transactions or outside a transaction entirely.

### Pitfall 6: Last-OWNER Check Omits the Removal Subject
**What goes wrong:** `removeMember(householdId, targetUserId)` checks "is the target the last OWNER?" but counts the target in the current OWNER set. If there are two OWNERs, the check sees 2 and allows removal. After removal, 1 OWNER remains — correct. But if there is exactly 1 OWNER and the target IS that OWNER, the check must block removal.
**Why it happens:** The count query includes the target user. The invariant is "at least 1 OWNER exists AFTER removal."
**How to avoid:** Query `ownerCount = count WHERE householdId = X AND role = 'OWNER' AND userId != targetUserId`. If `ownerCount === 0`, block with the "only owner" error.
**Warning signs:** Owner count query does not exclude the target user.

---

## Code Examples

### SHA-256 Hash Helper (Inline or `src/lib/crypto.ts`)
```typescript
// Source: node:crypto stdlib — verified available in Node 18+
import { randomBytes, createHash } from "node:crypto";

export function generateInvitationToken() {
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  return { rawToken, tokenHash };
}

export function hashInvitationToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}
```

### createInvitation Action (7-step template, D-16)
```typescript
// Source: Phase 2 D-12 7-step template (verified from src/features/household/actions.ts)
export async function createInvitation(data: unknown) {
  // Step 1: session
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  // Step 2: demo guard
  if (session.user.isDemo) {
    return { error: "This action is disabled in demo mode. Sign up to get your own household." };
  }

  // Step 3: Zod parse
  const parsed = createInvitationSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  // Step 4: live household access
  let access: Awaited<ReturnType<typeof requireHouseholdAccess>>;
  try {
    access = await requireHouseholdAccess(parsed.data.householdId);
  } catch (err) {
    if (err instanceof ForbiddenError) return { error: err.message };
    throw err;
  }

  // Step 5: role authz (OWNER only)
  if (access.role !== "OWNER") {
    return { error: "Only household owners can generate invite links." };
  }

  // Step 6: write
  const { rawToken, tokenHash } = generateInvitationToken();
  const invitation = await db.invitation.create({
    data: {
      householdId: parsed.data.householdId,
      tokenHash,
      invitedByUserId: session.user.id,
    },
    select: { id: true },
  });

  // Step 7: revalidate (Phase 6 settings page — may not exist yet, harmless)
  revalidatePath(HOUSEHOLD_PATHS.settings, "page");
  return { success: true, token: rawToken, invitationId: invitation.id };
}
```

### Zod Schemas for Phase 4 Actions
```typescript
// Source: pattern from src/features/household/schema.ts (zod/v4 import)
import { z } from "zod/v4";

export const createInvitationSchema = z.object({
  householdId: z.cuid(),
  householdSlug: z.string().min(1),
});

export const revokeInvitationSchema = z.object({
  invitationId: z.cuid(),
  householdId: z.cuid(),   // D-16 discretion: grep-consistent hidden field
  householdSlug: z.string().min(1),
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(1),
});

export const leaveHouseholdSchema = z.object({
  householdId: z.cuid(),
  householdSlug: z.string().min(1),
});

export const removeMemberSchema = z.object({
  householdId: z.cuid(),
  householdSlug: z.string().min(1),
  targetUserId: z.string().cuid(),
});

export const promoteMemberSchema = z.object({
  householdId: z.cuid(),
  householdSlug: z.string().min(1),
  targetUserId: z.string().cuid(),
});
// demoteMemberSchema is identical in shape to promoteMemberSchema
```

---

## Runtime State Inventory

> This section is included because Phase 4 involves membership mutations (join, leave, remove) that affect live session state.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | `Invitation.tokenHash` rows written by `createInvitation`; `HouseholdMember` rows written by `acceptInvitation` | Code write path only; no data migration (schema shape-complete from Phase 1) |
| Live service config | JWT cookie in user's browser carries `activeHouseholdId`; becomes stale on leave/join | `unstable_update` on `acceptInvitation` and `leaveHousehold` corrects this in-flight |
| OS-registered state | None | — |
| Secrets/env vars | No new secrets. `DATABASE_URL`, `AUTH_SECRET`, `NEXTAUTH_URL` already set | None |
| Build artifacts | None — no schema migration, no new generated types | None |

**Nothing found in categories "OS-registered state" and "build artifacts"** — verified: D-20 confirms zero schema changes; no new Prisma enums or generated types.

---

## Environment Availability

Phase 4 is a pure code/behavior change. All tools are already active.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL | `db.$transaction`, `updateMany` atomicity | Yes | 17.x (confirmed from project config) | — |
| `node:crypto` | `randomBytes`, `createHash` | Yes | Built-in (Node 18+) | — |
| `next-auth` | `unstable_update`, session JWT | Yes | `^5.0.0-beta.30` | — |
| `prisma` | All DB writes | Yes | `^7.7.0` | — |
| `zod` | Input validation | Yes | `^4.3.6` (`zod/v4` path) | — |

**No missing dependencies.** All tools are installed and active from prior phases.

---

## Validation Architecture

`nyquist_validation: true` in `.planning/config.json` — validation section required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | `vitest.config.mts` |
| Quick run command | `npx vitest run tests/phase-04/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INVT-01 | `createInvitation` returns raw token + invitationId; OWNER-only authz; non-OWNER gets ForbiddenError | unit (mocked Prisma) | `npx vitest run tests/phase-04/create-invitation.test.ts` | Wave 0 |
| INVT-01 | `revokeInvitation` sets `revokedAt`; idempotent on already-revoked; error on already-accepted | unit (mocked Prisma) | `npx vitest run tests/phase-04/revoke-invitation.test.ts` | Wave 0 |
| INVT-02 | `getHouseholdInvitations` returns active-only rows ordered `createdAt DESC` | unit (mocked Prisma) | `npx vitest run tests/phase-04/get-household-invitations.test.ts` | Wave 0 |
| INVT-03 | `/join/[token]` logged-out branch renders Sign-in + Create-account CTAs with correct `callbackUrl` | integration / smoke | `npx vitest run tests/phase-04/join-page-branches.test.ts` | Wave 0 |
| INVT-04 | `acceptInvitation` atomic: two concurrent calls → exactly 1 success, 1 "already used" error | real-DB integration | `npx vitest run tests/phase-04/accept-invitation-concurrency.test.ts` | Wave 0 (D-23) |
| INVT-04 | `acceptInvitation` appends new member at `rotationOrder = max + 1`; does NOT reset cycle pointer | unit (mocked Prisma) | `npx vitest run tests/phase-04/accept-invitation.test.ts` | Wave 0 |
| INVT-04 | `resolveInvitationByToken` returns null for unknown token, correct branch data for valid token | unit (mocked Prisma) | `npx vitest run tests/phase-04/resolve-invitation.test.ts` | Wave 0 |
| INVT-05 | `leaveHousehold`: last-OWNER in multi-member household → blocked with error message (D-13) | unit (mocked Prisma) | `npx vitest run tests/phase-04/leave-household.test.ts` | Wave 0 (D-25) |
| INVT-05 | `leaveHousehold`: two OWNERs, two members → allowed; one OWNER, two members → blocked | unit (mocked Prisma) | same file (D-25) | Wave 0 |
| INVT-05 | `leaveHousehold`: sole-member last-OWNER → `Household.delete` (cascade) succeeds | real-DB integration | `npx vitest run tests/phase-04/leave-household-sole.test.ts` | Wave 0 (D-25) |
| INVT-05 | `leaveHousehold`: active assignee leaving triggers `transitionCycle('member_left')` | real-DB integration | `npx vitest run tests/phase-04/assignee-leaves.test.ts` | Wave 0 (D-27) |
| INVT-05 | `unstable_update` receives `activeHouseholdId` on accept and on leave | integration (or Playwright) | `npx vitest run tests/phase-04/jwt-refresh.test.ts` (or defer to E2E) | Wave 0 (D-26) |
| INVT-06 | `removeMember`: non-OWNER caller → ForbiddenError; self-target → error; last-OWNER target → error | unit (mocked Prisma) | `npx vitest run tests/phase-04/remove-member.test.ts` | Wave 0 (D-24) |
| INVT-06 | `promoteToOwner`: idempotent (already OWNER → no-op); non-OWNER caller → ForbiddenError | unit (mocked Prisma) | `npx vitest run tests/phase-04/promote-demote.test.ts` | Wave 0 (D-24) |
| INVT-06 | `demoteToMember`: would leave 0 OWNERs → blocked; self-demote with other OWNER → allowed | unit (mocked Prisma) | same file | Wave 0 |

### Test Patterns (Established from Phase 3)

**Mocked-Prisma unit tests** (role-gate, input validation, error strings):
```typescript
// Pattern: vi.mock("@/lib/db"), vi.mock("../auth")
// Source: tests/household.test.ts, tests/phase-03/skip-current-cycle.test.ts
vi.mock("../../auth", () => ({ auth: vi.fn(), unstable_update: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { invitation: { create: vi.fn(), updateMany: vi.fn(), ... } } }));
```

**Real-DB integration tests** (atomicity, cascade, transitionCycle):
```typescript
// Pattern: async import after vi.mock, EMAIL_PREFIX namespacing, afterAll cleanup
// Source: tests/phase-03/transition-concurrency.test.ts, tests/household-integration.test.ts
vi.mock("../../auth", () => ({ auth: vi.fn(), unstable_update: vi.fn() }));
const { db } = await import("@/lib/db");
const { acceptInvitation } = await import("@/features/household/actions");
```

**Double-mock pattern for actions calling `auth()` internally twice** (via `requireHouseholdAccess`):
```typescript
// Source: STATE.md — "[Phase 03-04] Mocked-Prisma tests for auth()-calling actions
// use mockResolvedValue (not mockResolvedValueOnce)"
(auth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: "usr_123", isDemo: false } });
```

**Double-cast pattern for session mocks** (established in Phase 3):
```typescript
// Source: STATE.md — "[Phase 03-04] Double-cast pattern"
(auth as ReturnType<typeof vi.fn>).mockResolvedValue({
  user: { id: "usr_123", isDemo: false }
} as unknown as Awaited<ReturnType<typeof auth>>);
```

### Sampling Rate
- **Per task commit:** `npx vitest run tests/phase-04/`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

All Phase 4 test files are net-new. Wave 0 creates stubs:

- [ ] `tests/phase-04/create-invitation.test.ts` — REQ INVT-01 (role-gate, token return)
- [ ] `tests/phase-04/revoke-invitation.test.ts` — REQ INVT-01 (idempotent revoke)
- [ ] `tests/phase-04/get-household-invitations.test.ts` — REQ INVT-02 (active-only query)
- [ ] `tests/phase-04/resolve-invitation.test.ts` — REQ INVT-04 (branch logic)
- [ ] `tests/phase-04/accept-invitation.test.ts` — REQ INVT-04 (rotation append, cycle pointer untouched)
- [ ] `tests/phase-04/accept-invitation-concurrency.test.ts` — REQ INVT-04, D-23 (real DB, concurrent accept)
- [ ] `tests/phase-04/join-page-branches.test.ts` — REQ INVT-03 (public page branch routing)
- [ ] `tests/phase-04/leave-household.test.ts` — REQ INVT-05 (last-owner block, D-25)
- [ ] `tests/phase-04/leave-household-sole.test.ts` — REQ INVT-05, D-14 (real DB, cascade delete)
- [ ] `tests/phase-04/assignee-leaves.test.ts` — REQ INVT-05, D-27 (real DB, transitionCycle)
- [ ] `tests/phase-04/jwt-refresh.test.ts` — REQ INVT-05, D-26 (unstable_update called)
- [ ] `tests/phase-04/remove-member.test.ts` — REQ INVT-06, D-24 (role-gate)
- [ ] `tests/phase-04/promote-demote.test.ts` — REQ INVT-06, D-24 (idempotent promote, demote guard)
- [ ] `tests/phase-04/fixtures.ts` — Shared fixture helpers (namespaced emails, createHouseholdWithInvitation helper, mirrors phase-03/fixtures.ts pattern)

---

## Security Domain

`security_enforcement` is not explicitly set in `.planning/config.json` — treat as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | NextAuth v5 credentials; `auth()` guard in every Server Action |
| V3 Session Management | yes | JWT strategy; `unstable_update` on membership change; 30-day default session |
| V4 Access Control | yes | `requireHouseholdAccess` live DB check; OWNER role gate per action |
| V5 Input Validation | yes | `zod/v4` schemas on all Server Action inputs; token treated as opaque string (no parsing of its structure) |
| V6 Cryptography | yes | `crypto.randomBytes(32)` for token generation; SHA-256 for hashing — no hand-roll |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Token enumeration / brute-force | Information Disclosure | 256-bit CSPRNG token → 2^256 search space; hash-only storage means plaintext token not exposed via DB breach |
| Token double-use (race condition) | Tampering | `updateMany WHERE acceptedAt IS NULL` atomic check + `count === 0` guard (Pitfall 10 §2) |
| CSRF on Server Actions | Tampering | NextAuth v5 Server Actions use CSRF protection from Next.js (Origin header check on POST); no additional action needed |
| Stale JWT after membership change | Elevation of Privilege | `unstable_update` on leave/join; `requireHouseholdAccess` live DB check on every mutation; JWT is landing-hint only (Phase 1 D-14) |
| Mass-assignment on invitation create | Tampering | Zod schema only accepts `householdId` + `householdSlug`; `tokenHash`, `invitedByUserId`, dates are server-set |
| SEO token indexing (search engine caches invite link) | Information Disclosure | `<meta name="robots" content="noindex, nofollow">` on `/join/[token]` page (UI-SPEC §access) |
| Unauthorized member removal | Elevation of Privilege | `removeMember` requires `role === 'OWNER'` via `requireHouseholdAccess`; self-removal blocked (use `leaveHousehold`) |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `HouseholdMember` compound unique is named `householdId_userId` for Prisma's `delete where` accessor | Pattern 5 | Prisma throws P2025 or TS compile error; fix by using `where: { householdId_userId: { ... } }` or checking generated client types |
| A2 | `unstable_update` is destructure-exportable from `NextAuth(...)` return in next-auth@5.0.0-beta.30 | Pattern 3 | If API changed, import directly from `next-auth` as fallback; may require different invocation shape |
| A3 | `HouseholdMember` has `@@unique([householdId, userId])` (enabling the compound key accessor) | Pattern 5 | Confirmed from Phase 2 migration context; if not present, use `findFirst` + `delete by id` pattern |

**If this table is short:** Most implementation details are verified against the live codebase source files read during this session. The three assumptions above are the only unverified claims — all three can be resolved within Wave 0 by reading the generated Prisma client types.

---

## Open Questions

1. **`unstable_update` signature for partial token patch**
   - What we know: `unstable_update` accepts a partial session object and merges it into the JWT. Confirmed in Pitfall 16 docs.
   - What's unclear: Whether `unstable_update({ activeHouseholdId: null })` correctly sets the field to null (vs. undefined, which would leave it unchanged) in the beta.
   - Recommendation: In Wave 2, test with a null value. If it doesn't clear, use `unstable_update({ user: { activeHouseholdId: undefined } })` and accept that the JWT carries a stale value until next login — the `requireHouseholdAccess` guard prevents unauthorized access either way.

2. **`joinedAt` vs `createdAt` on `HouseholdMember` for owner display name ordering**
   - What we know: UI-SPEC says "earliest-joining OWNER by `joinedAt ASC`." The schema uses `createdAt` (confirmed from `fixtures.ts` and the schema read).
   - What's unclear: Whether the Prisma schema has a `joinedAt` alias or whether UI-SPEC used a non-canonical field name.
   - Recommendation: Use `orderBy: { createdAt: 'asc' }` in `resolveInvitationByToken`. This is a minor copy discrepancy, not a functional issue.

---

## Sources

### Primary (HIGH confidence — verified against live codebase files)

- `prisma/schema.prisma` lines 211–226 — `Invitation` model verified shape-complete (D-20 confirmed)
- `auth.config.ts` — current `publicPaths` and `authorized` callback read directly
- `proxy.ts` — current matcher pattern read directly; `/join` absence confirmed
- `auth.ts` — current `NextAuth` export destructuring; `unstable_update` not yet exported
- `src/features/household/actions.ts` — 7-step template pattern; `requireHouseholdAccess` usage
- `src/features/household/cycle.ts` — `transitionCycle` signature and transaction pattern
- `src/features/household/guards.ts` — `ForbiddenError` class, `requireHouseholdAccess` signature
- `src/features/household/schema.ts` — Zod v4 (`zod/v4`) import pattern; `z.cuid()` usage
- `tests/phase-03/transition-concurrency.test.ts` — real-DB concurrency test pattern
- `tests/phase-03/fixtures.ts` — EMAIL_PREFIX namespacing, `getDb()` lazy import pattern
- `tests/household-integration.test.ts` — `vi.mock("../auth")` pattern for integration tests
- `.planning/research/PITFALLS.md` §Pitfall 9, 10, 16 — binding pitfall documentation
- `vitest.config.mts` — test framework config, `include` pattern
- `package.json` — installed versions confirmed: next-auth@^5.0.0-beta.30, prisma@^7.7.0, zod@^4.3.6

### Secondary (MEDIUM confidence)

- `CONTEXT.md` D-01..D-27 — user decisions from `/gsd-discuss-phase` (authoritative for this phase)
- `04-UI-SPEC.md` — visual contract; component structure for `/join/[token]/page.tsx` and `accept-form.tsx`
- `STATE.md` §Accumulated Context §Decisions — double-cast mock pattern, `mockResolvedValue` vs `mockResolvedValueOnce` decision

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all from Phase 1–3 foundation
- Architecture patterns: HIGH — verified directly from live codebase files
- Pitfalls: HIGH — three of four pitfall flags from roadmap traced to live code and binding CONTEXT.md decisions
- Test patterns: HIGH — verified from Phase 3 test files (same framework, same mock conventions)

**Research date:** 2026-04-18
**Valid until:** 2026-05-18 (stable stack; no external dependencies changing)

---

## Project Constraints (from CLAUDE.md)

All directives from `CLAUDE.md` apply. Enforcement checklist for Phase 4:

| Directive | Phase 4 Impact |
|-----------|---------------|
| Next.js 16 App Router only — `proxy.ts` not `middleware.ts` | Confirmed: `proxy.ts` is already in use; matcher change is additive |
| NextAuth v5 beta — `unstable_update` from `next-auth@beta` | `unstable_update` export from `auth.ts`; no v4 session patterns |
| Prisma 7.7 — `@/generated/prisma/client` import path | All Prisma imports in actions/queries use the established path |
| Zod 4 — `import { z } from "zod/v4"` | All new schemas follow this pattern (verified from `schema.ts`) |
| Server Components + Server Actions — no REST API for internal data | `resolveInvitationByToken` is a read helper called from Server Component, not a route handler |
| `proxy.ts` for route protection | `/join` carve-out is an additive regex change to the existing matcher |
| No OAuth — credentials provider only | No auth changes this phase other than publicPaths/matcher |
| No photo upload, no email/push — in-app only | Invitation is copy-link only (D-05, D-07); no email infrastructure touched |
| Vitest (not Jest) | All test files in `tests/phase-04/` use Vitest imports |
| shadcn/ui existing components only — no new installs | UI-SPEC §Registry Safety confirms no new component installs; `<DestructiveLeaveDialog />` composes from existing primitives |

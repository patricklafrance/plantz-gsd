# Phase 4: Invitation System - Context

**Gathered:** 2026-04-18
**Status:** Ready for planning
**Workstream:** `household`

<domain>
## Phase Boundary

Deliver CSPRNG-token shareable join links (generate, revoke, list), the public `/join/[token]` accept flow that survives the auth redirect, and the membership-mutation actions that plug into already-shipped foundations: `acceptInvitation` appends to the rotation and calls `unstable_update` to refresh the JWT; `leaveHousehold` and `removeMember` call Phase 3's `transitionCycle(..., reason: 'member_left')` when the leaver/removed user is the active assignee; `transferOwnership` promotes a member to `OWNER` without demoting the caller (co-owner model).

**Explicitly not in this phase:** Settings UI for the invite-link generator, the confirm-join page styling beyond minimal fields, member-list UI, rotation reorder controls, cycle banner — all Phase 6. App-sent email invitation — deferred milestone. Observer role, per-plant assignment — deferred. Demo-mode invitation seeding — Phase 7 handles demo coverage.

</domain>

<decisions>
## Implementation Decisions

### Invitation token & lifecycle

- **D-01:** Token generation: `crypto.randomBytes(32).toString('hex')` (256 bits of entropy). Only the SHA-256 hash is persisted in `Invitation.tokenHash` (column already exists from Phase 1 schema). The full token is returned to the caller at generation time only and composed into the shareable URL `https://<host>/join/<rawToken>`. Pitfall 10 §1 binding.
- **D-02:** **Unlimited concurrent active invitations per household.** Each `createInvitation` call writes a new `Invitation` row. `revokeInvitation(invitationId)` is per-row; generating a new link never auto-revokes prior links. Matches INVT-02's plural wording ("view all active invitation links and revoke any"). Query shape: `where: { householdId, revokedAt: null, acceptedAt: null }`.
- **D-03:** No expiry. `Invitation` row lives until revoked or accepted. Schema has no `expiresAt` column — not adding one. Owner revocation is the only time-based invalidation path. STATE decision binding.
- **D-04:** Atomic acceptance via `UPDATE Invitation SET acceptedAt = NOW(), acceptedByUserId = $userId WHERE tokenHash = $hashed AND acceptedAt IS NULL AND revokedAt IS NULL`, then read the returned row count. Zero rows → token was already used or revoked between lookup and update. Pitfall 10 §2 binding. Implemented with `db.invitation.updateMany` + `count === 0` check inside the accept transaction.
- **D-05:** `invitedEmail` is always null in v1. No input field on the generate form; column stays dormant. Pure copy-link flow matches the project-level "no app-sent email" constraint. Pitfall 10 §3's wrong-user-warning path is inactive this milestone.

### /join/[token] accept flow

- **D-06:** `/join/[token]` is a **public route** (added to `authConfig.publicPaths` in `auth.config.ts`) and excluded from `proxy.ts` matcher. Page renders for both logged-in and logged-out visitors.
- **D-07:** Logged-out flow uses **NextAuth's native `callbackUrl` mechanism** (no cookie, no DB pending-row). The page shows a household preview + two buttons: "Sign in" (href `/login?callbackUrl=/join/<token>`) and "Create account" (href `/register?callbackUrl=/join/<token>`). `/login` and `/register` already honor `callbackUrl` via NextAuth; they redirect back to `/join/<token>` on success. Token stays in the URL the whole time; no additional state mechanism. Matches WorkOS/Notion join-link pattern.
- **D-08:** Logged-in confirm screen shows **household name, owner display name, and member count only**. One page, not a two-route confirm→accept split. The page's Accept button submits a Server Action on the same page; Cancel is a link back to the user's default-household dashboard. Matches INVT-04 literally.
- **D-09:** `/join/[token]` failure-mode UX has **four distinct branches**:
  1. Unknown/invalid token (no matching `tokenHash` row) → "This invite link isn't valid."
  2. `revokedAt IS NOT NULL` → "This invite was revoked by the household owner."
  3. `acceptedAt IS NOT NULL` → "This invite has already been used."
  4. Token valid AND caller is already a member of that household → "You're already in [Household Name]." with a link to `/h/[slug]/dashboard`.

  Branch (4) is detected at page render time: after locating the row, query `householdMember.findFirst({ where: { householdId, userId: session.user.id } })`.

### Co-owner model (INVT-05 / INVT-06)

- **D-10:** **A household can have multiple `OWNER`s.** User-selected deviation from the prior "single-owner transfer" framing — role field on `HouseholdMember` is reused (`OWNER` / `MEMBER`); no schema change.
- **D-11:** **Any `OWNER` can promote a `MEMBER` to `OWNER`** via `promoteToOwner(householdId, targetUserId)`. Uses the 7-step template; authz = caller role === `OWNER` via `requireHouseholdAccess`. Idempotent (promoting an existing `OWNER` is a no-op, not an error).
- **D-12:** **Any `OWNER` can demote another `OWNER` to `MEMBER`** via `demoteToMember(householdId, targetUserId)`. Authz = caller role === `OWNER`. Self-demote allowed as long as at least one other `OWNER` exists after the change (enforced by pre-check inside the transaction).
- **D-13:** **Removing or leaving is blocked when the caller is the last `OWNER`** in a multi-member household. `leaveHousehold(householdId)` and `removeMember(householdId, memberId)` each pre-check: if the subject user has role `OWNER` and would be the last `OWNER` in a household that still has other members after removal, reject with `"You're the only owner. Promote another member to owner first, then try again."`. No auto-promotion magic.
- **D-14:** **Sole member who is also the last owner** is the INVT-05 terminal case: `leaveHousehold` proceeds, the `Household` row is deleted, and the cascade wipes all plants / rooms / watering logs / notes / reminders / cycles / availabilities / invitations / household notifications via existing `onDelete: Cascade`. Destructive-confirm dialog gates the client-side invocation. Demo-mode guard still rejects first.
- **D-15:** There is no "founding owner" concept. The OWNER set is flat; the auto-signup-created OWNER is indistinguishable from a promoted OWNER.

### Server Actions shipped (all under `src/features/household/actions.ts`)

- **D-16:** All six actions follow the Phase 2 D-12 seven-step template: `auth()` → demo-mode guard → Zod parse → `requireHouseholdAccess(householdId)` → role/entity-owner authz → write → `revalidatePath('/h/[slug]/settings')` (or `/dashboard` where relevant). Actions:
  1. `createInvitation(householdId)` — authz: `role === 'OWNER'`. Writes `Invitation` row with `tokenHash` only; returns `{ token: rawToken, invitationId }` for the UI to compose the URL.
  2. `revokeInvitation(invitationId)` — authz: OWNER of the invitation's household. Sets `revokedAt = now()`; idempotent on already-revoked (no-op) and already-accepted (error `"Can't revoke an already-accepted invite"`).
  3. `acceptInvitation(token)` — authz: authenticated session (not OWNER-gated, not household-gated — that's the point). Rehashes token, runs the atomic `updateMany`, on success inserts a `HouseholdMember` with `role = 'MEMBER'` and `rotationOrder = maxRotationOrder + 1` (append to end — Pitfall 9 §B binding), then calls `unstable_update({ activeHouseholdId: <joinedHouseholdId> })` so the JWT reflects the new default landing (Pitfall 16 binding). Does NOT reset the current cycle pointer.
  4. `leaveHousehold(householdId)` — authz: caller is a member. Last-owner pre-check (D-13). If caller is current cycle assignee, calls `transitionCycle(tx, householdId, 'member_left')` (Phase 3 export) inside the same transaction. Cancels caller's future `Availability` rows (`startDate >= today`). Deletes the `HouseholdMember` row. Calls `unstable_update` to flip `activeHouseholdId` to another household the user belongs to, or to null if they have none left. Sole-member-and-last-owner branch triggers `db.household.delete` in place of the member delete.
  5. `removeMember(householdId, targetUserId)` — authz: caller role === `OWNER`. Rejects self-target (self-removal goes through `leaveHousehold` for the JWT-update semantics). Same assignee + availability + transition side effects as `leaveHousehold`. Does NOT call `unstable_update` for the removed user — their next request will hit `requireHouseholdAccess`, find no membership, and throw `ForbiddenError`; the 403 handler / error boundary routes them to a safe page.
  6. `promoteToOwner(householdId, targetUserId)` and `demoteToMember(householdId, targetUserId)` — per D-11 / D-12. `transferOwnership` is NOT a distinct action; promote + optional self-demote compose it.

### Queries shipped (all under `src/features/household/queries.ts`)

- **D-17:** `getHouseholdInvitations(householdId)` returns `where: { householdId, revokedAt: null, acceptedAt: null }` ordered by `createdAt DESC`. Returns the stored row as-is (no raw token) plus the inviter's display name via relation include. Active-only per Area 7 decision; no history surface this phase.
- **D-18:** `resolveInvitationByToken(rawToken)` — not a Server Action, a read helper used by the public `/join/[token]` page. Hashes the raw token, `findUnique({ where: { tokenHash } })` with `include: { household: { include: { _count: { select: { members: true } } } }, invitedBy }`. Returns `{ invitation, household, ownerName, memberCount } | null`. No auth check — anyone with the token gets the preview. Used by the page to decide which of the four D-09 branches to render.
- **D-19:** `getHouseholdMembers(householdId)` — lightweight read for the Phase 6 member-list UI to consume. Returns members with `{ userId, userName, userEmail, role, rotationOrder, joinedAt }`. Authz = any household member (via `requireHouseholdAccess`, role check not needed for read). Existing Phase 2 `getCurrentHousehold` chokepoint handles cross-household isolation.

### Schema changes this phase

- **D-20:** **Zero Prisma schema changes.** `Invitation` model is already shape-complete from Phase 1 (confirmed: `tokenHash @unique`, `invitedByUserId`, `invitedEmail`, `revokedAt`, `acceptedAt`, `acceptedByUserId`, `createdAt`, `@@index([householdId])`). `HouseholdMember.role` is already a string with `OWNER` / `MEMBER` values. No new columns, no migration, no data backfill. Planner should not generate a `prisma migrate` step.

### Routing & auth config

- **D-21:** `authConfig.publicPaths` (in `auth.config.ts`) gains `/join` (prefix match). `proxy.ts` matcher excludes `/join/:path*`. Logged-in users hitting `/join/[token]` stay on the page (no auto-redirect to dashboard) so the confirm-join flow is reachable — this is a behavior change from the current `authConfig.authorized` callback which redirects logged-in users away from all public paths. Planner inventories how to carve `/join` out of that redirect.
- **D-22:** Post-accept redirect target: `/h/[newlyJoinedHouseholdSlug]/dashboard`. On accept success, the action returns `{ redirectTo }` and the page's form uses Next.js `redirect()` server-side.

### Test strategy

- **D-23:** `acceptInvitation` atomicity test: real Prisma test DB, two concurrent calls with the same token, assert exactly one succeeds and one returns the "already used" error. Pitfall 10 §2 acceptance gate.
- **D-24:** Role-gate tests for every OWNER-gated action (`createInvitation`, `revokeInvitation`, `removeMember`, `promoteToOwner`, `demoteToMember`): non-OWNER member gets `ForbiddenError`. Mocked Prisma unit tests per Phase 2 D-17 pattern.
- **D-25:** Last-owner-blocks-leave test: set up a two-OWNER two-member household; assert leave fails. Reduce to one-OWNER; assert leave still fails while other members exist. Reduce to sole-member-sole-OWNER; assert leave succeeds AND the `Household` row is deleted.
- **D-26:** `unstable_update` JWT refresh: verify the callback receives `activeHouseholdId` on accept and on leave. Integration-adjacent; may land as a Playwright E2E step if unit-mocking NextAuth's `unstable_update` is fragile.
- **D-27:** Assignee-leaves triggers `transitionCycle`: integration test — build a household with an active cycle whose `assignedUserId` is the leaver; invoke `leaveHousehold`; assert a new `active` Cycle exists with a different assignee AND the outgoing cycle has `transitionReason = 'member_left'`.

### Claude's Discretion

- File organization inside `src/features/household/`: whether invitation actions live alongside cycle/availability in `actions.ts` or in a dedicated `invitations.ts`. Both fit the Phase 3 D-20 convention ("all household server code in one feature folder"). Recommend: consolidate in `actions.ts` if file stays under ~500 lines, split otherwise.
- Exact shape of the return envelope from `createInvitation` — `{ token, invitationId, url }` vs `{ token, invitationId }` with the UI composing the URL. Planner decides based on whether the generate UI lives in this phase (no) or Phase 6 (yes).
- Client-side destructive-confirm dialog component for the sole-member leave path. Existing `ResponsiveDialog` component is the pattern; no new primitive needed.
- Whether `promoteToOwner` / `demoteToMember` are separate actions or one `setMemberRole(householdId, userId, role)`. Either works; separate actions are more grep-friendly.
- Exact copy strings for the four D-09 failure branches and INVT-04 confirm page. Content-only; no planning implication.
- Handling of the edge where `unstable_update` fails but the DB write succeeded. Current v1 approach: let the next page load correct via live membership check; don't compensate. Acceptable per Pitfall 16's reliance on guard-based authz.
- Whether `revokeInvitation` also takes `householdId` as a hidden field (matches Phase 2 D-04 convention of passing householdId to every mutating action) or derives it from the invitation row. Recommend: hidden field for grep-consistency, even though it's redundant.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope
- `.planning/workstreams/household/ROADMAP.md` §Phase 4 — Goal, success criteria, pitfall flags (9, 10, 16); `/join/[token]` publicPaths + proxy.ts exclusion mandate
- `.planning/workstreams/household/REQUIREMENTS.md` §Membership & invitations — INVT-01..06

### Pitfalls (binding)
- `.planning/research/PITFALLS.md` §Pitfall 9 §B — `acceptInvitation` appends to rotation end; no cycle-pointer reset; drives D-16 acceptInvitation
- `.planning/research/PITFALLS.md` §Pitfall 10 — CSPRNG tokens (§1), atomic UPDATE acceptance (§2), wrong-user warning (§3) — drives D-01, D-04; §3 path explicitly inactive per D-05
- `.planning/research/PITFALLS.md` §Pitfall 16 — JWT staleness + `unstable_update` on membership change — drives D-16 acceptInvitation / leaveHousehold

### Prior phase binding decisions (foundation this phase builds on)
- `.planning/workstreams/household/phases/01-schema-foundation-data-migration/01-CONTEXT.md` §D-16..D-20 — `requireHouseholdAccess` guard contract; `ForbiddenError`; rich `{ household, member, role }` return — consumed by every action this phase
- `.planning/workstreams/household/phases/01-schema-foundation-data-migration/01-CONTEXT.md` §D-08 — `registerUser` transactional hook (no amendment this phase)
- `.planning/workstreams/household/phases/02-query-action-layer-update/02-CONTEXT.md` §D-03 — `/h/[householdSlug]/layout.tsx` chokepoint + `getCurrentHousehold()` cached helper
- `.planning/workstreams/household/phases/02-query-action-layer-update/02-CONTEXT.md` §D-04 — hidden-field `householdId` form pattern; applies to all mutating actions this phase
- `.planning/workstreams/household/phases/02-query-action-layer-update/02-CONTEXT.md` §D-12 — 7-step Server Action template (binding for D-16)
- `.planning/workstreams/household/phases/03-rotation-engine-availability/03-CONTEXT.md` §D-03 — Cycle status state machine; `member_left` transitionReason already defined
- `.planning/workstreams/household/phases/03-rotation-engine-availability/03-CONTEXT.md` §D-04 — `transitionReason` column domain; `member_left` value already shipped
- `.planning/workstreams/household/phases/03-rotation-engine-availability/03-CONTEXT.md` §D-18 — `HouseholdNotification.type = cycle_reassigned_member_left` emitted by the Phase 3 transition function when the leaver was the active assignee (no new notification type needed this phase)
- `.planning/workstreams/household/phases/03-rotation-engine-availability/03-CONTEXT.md` §D-20 — `src/features/household/` is the single feature folder; no `src/features/invitations/` split

### Project & tech stack
- `.planning/PROJECT.md` §Current Milestone — Household and Rotation; "shareable join-link invitations (no app-sent email; token-based, expirable, resendable); non-destructive leave"
- `CLAUDE.md` §Technology Stack — Next.js 16 App Router, NextAuth v5 beta (`unstable_update`), Prisma 7, Zod v4
- `CLAUDE.md` §Stack Patterns — Server Actions + Zod + Prisma writes; `proxy.ts` edge-session-only

### FEATURES / ARCHITECTURE research
- `.planning/research/FEATURES.md` §Category 2 — Membership invitation patterns from Notion, Figma, WorkOS; drives the public-preview + callbackUrl approach
- `.planning/research/ARCHITECTURE.md` §5 Invitation State Machine — flow diagram for GET /join/[token] (D-06..D-09 alignment)
- `.planning/research/ARCHITECTURE.md` §Anti-Pattern 4 — `invitedEmail` must NOT gate acceptance; drives D-05

### Existing codebase anchor points
- `prisma/schema.prisma` §`model Invitation` (lines 211–226) — shape-complete; zero migration this phase (D-20)
- `src/features/household/actions.ts` — extended with six new actions (D-16); consumes `requireHouseholdAccess` and `transitionCycle`
- `src/features/household/queries.ts` — extended with `getHouseholdInvitations`, `resolveInvitationByToken`, `getHouseholdMembers` (D-17, D-18, D-19)
- `src/features/household/schema.ts` — Zod schemas added for createInvitation / revokeInvitation / acceptInvitation / leaveHousehold / removeMember / promoteToOwner / demoteToMember
- `src/features/household/cycle.ts` — `transitionCycle` imported for the assignee-leaves path (Phase 3 export)
- `src/features/household/guards.ts` — `requireHouseholdAccess`, `ForbiddenError` consumed unchanged
- `auth.config.ts` — `publicPaths` gains `/join`; `authorized` callback carves `/join` out of the logged-in-redirect-to-dashboard branch (D-21)
- `proxy.ts` — matcher excludes `/join/:path*` (D-21)
- `auth.ts` — no change; JWT callback already handles `activeHouseholdId` per Phase 1 D-13; `unstable_update` calls are made from Server Actions
- `src/app/join/[token]/page.tsx` — new public Server Component page (D-06..D-09 render logic)
- `src/lib/crypto.ts` or inline — SHA-256 hash helper for `tokenHash`; `node:crypto` stdlib only

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Phase 1 guard (`src/features/household/guards.ts`)** — `requireHouseholdAccess` returns `{ household, member, role }`; OWNER-role actions use `role === 'OWNER'` check against the returned object.
- **Phase 1 slug helper (`src/features/household/queries.ts` — `resolveHouseholdBySlug`)** — the accept-success redirect path resolves a slug if needed (usually the invitation row already carries `householdId` and the `Household` include gives the slug).
- **Phase 3 transition function (`src/features/household/cycle.ts` — `transitionCycle`)** — exported specifically so Phase 4's leave/remove can call it with `reason: 'member_left'` (Pitfall 9 §A binding; Phase 3 §D-03 writeup).
- **`db.$transaction` pattern** — every multi-write action this phase uses a transaction (accept + insert member; leave + transition + availability cancel; promote + demote self-atomic).
- **`revalidatePath` pattern** — used on `/h/[slug]/settings` (invite list) and `/h/[slug]/dashboard` (assignee banner) as applicable.
- **Demo-mode guard (`if (session.user.isDemo) return { error }`)** — carried verbatim (Phase 2 D-12 step 2).
- **Zod v4 schemas (`src/features/household/schema.ts`)** — pattern to extend with new invitation + membership schemas.
- **`ResponsiveDialog` component** — existing ui primitive used for the destructive-confirm on sole-member leave (not net-new).

### Established Patterns
- **Server Actions: 7-step template** (Phase 2 D-12) — every new action conforms.
- **Hidden-field `householdId` convention** (Phase 2 D-04) — every mutating form carries `<input type="hidden" name="householdId">`; `revokeInvitation` also takes it via hidden field for grep-consistency (D-16 discretion).
- **String role/status columns** (not Prisma enums) — `HouseholdMember.role`, `Cycle.status`, `Cycle.transitionReason` all strings. No enum changes this phase.
- **Feature-folder pattern** — `src/features/household/` absorbs all Phase 4 server code; no new feature folder (Phase 3 D-20 binding).
- **NextAuth v5 `unstable_update`** — called from Server Actions after membership writes to refresh the JWT (Pitfall 16 binding).

### Integration Points
- **`src/app/join/[token]/page.tsx`** — new public Server Component. Renders the four D-09 branches + the INVT-04 confirm UI. Calls `resolveInvitationByToken` and `requireHouseholdAccess`-lite (just session read).
- **`auth.config.ts`** — `publicPaths` and `authorized` callback both need updates per D-21. This is the surgical change to the auth layer.
- **`proxy.ts`** — matcher carves out `/join/:path*` so the edge session-check doesn't interfere with logged-out token-hits.
- **Phase 6 consumer interface**: `createInvitation`, `revokeInvitation`, `getHouseholdInvitations`, `getHouseholdMembers`, `promoteToOwner`, `demoteToMember`, `removeMember`, `leaveHousehold` — all consumed by Phase 6's settings page + member list + invite link UI. Signatures locked this phase.
- **Phase 7 consumer interface**: demo seed must reflect the co-owner possibility — Phase 7 will either seed a single OWNER or a dual-OWNER household; Phase 4 leaves that to demo-authoring.

</code_context>

<specifics>
## Specific Ideas

- **Co-owner model adopted** (D-10..D-15). User-selected deviation from the originally-framed "single-owner transfer" reading of INVT-05/06. The framing is now: `OWNER` is a role a member holds, multiple members can hold it, and `transferOwnership` decomposes into `promoteToOwner` (+ optional self-demote). Downstream REQUIREMENTS.md wording doesn't need to change — INVT-05's "sole owner and last member" still reads cleanly as "last OWNER and last member"; INVT-06's "remove any non-owner" and "transfer ownership" both resolve under the promote/demote primitives.
- **Public join page + callbackUrl** (D-07). No cookie, no PendingInvite DB row. The NextAuth-native mechanism is sufficient because the token lives in a URL path segment, not a query string — surviving through two redirects is all it needs to do, which `?callbackUrl=` already handles. This keeps the auth surface exactly as shipped in v1.0 Phase 2.
- **Unlimited concurrent invites** (D-02). The wording "view all active invitation links and revoke any" in INVT-02 is the user's explicit preference; don't simplify to one-link-per-household at planning time.
- **No schema migration this phase** (D-20). `Invitation` was shipped shape-complete in Phase 1 specifically so Phase 4 could ship behavior only. Planner must not generate a `prisma migrate` Wave.

</specifics>

<deferred>
## Deferred Ideas

- **QR code for invite link** — FEATURES.md P3; trigger condition documented as "user feedback that copy-link is not enough." Not in Phase 4.
- **App-sent invitation email** — explicitly deferred milestone. Phase 4 owner copies link via their own channel (WhatsApp, iMessage, etc.).
- **Invite link expiry** — rejected in ROADMAP pitfall flag + STATE. Revoke is the only invalidation path.
- **`invitedEmail` match-gate at accept time** — rejected per ARCHITECTURE.md Anti-Pattern 4; column stays unused in v1 (D-05).
- **Display-only `invitedEmail` hint on confirm-join** — considered in Area 6, rejected in favor of D-05 (always null).
- **One-active-link-per-household simplification** — considered in Area 2, rejected (D-02).
- **Two-route confirm → accept split** — considered in Area 3, rejected in favor of single-page accept (D-08).
- **Atomic promote-and-leave transferOwnership** — considered in Area 4, rejected in favor of the co-owner decomposition (D-10..D-15).
- **Auto-promote oldest MEMBER on last-OWNER leave** — considered in the co-owner follow-up, rejected in favor of blocking leave until an explicit promotion happens (D-13).
- **"Founding owner" special role** — considered in the co-owner follow-up, rejected (D-15).
- **Block leave while member is inside an active availability window** — considered in Area 5, rejected. Cancel future availability rows only; historical rows stay for audit (D-16 leaveHousehold).
- **Revoked/accepted invitation history surface** — considered in Area 7, rejected in favor of active-only query (D-17). Add a history view later if audit needs arise.
- **Generic single failure page for /join** — considered in Area 8, rejected in favor of four distinct branches (D-09).
- **Observer role** — `MEMBX-01`, deferred milestone.
- **Bulk member removal** — `MEMBX-02`, deferred milestone.
- **Inter-household plant transfer on leave** — `MEMBX-03`, deferred milestone. v1 semantics: sole-member leave deletes the household + cascade.
- **Rotation reorder controls (ROTA-01)** — Phase 6. Phase 4 only appends new members to the rotation end.

</deferred>

---

*Phase: 04-invitation-system*
*Workstream: household*
*Context gathered: 2026-04-18*

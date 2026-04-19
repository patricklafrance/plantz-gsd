---
phase: 04-invitation-system
verified: 2026-04-19T11:45:00Z
status: human_needed
score: 5/5 must-haves verified (goal achievement)
overrides_applied: 0
human_verification:
  - test: "Logged-out /join/[token] → login → callback → confirm screen"
    expected: "Open /join/<valid-token> while logged out; click 'Sign in'; complete login; land back on /join/<same-token> with the 5b confirm card showing household name, inviter, member count"
    why_human: "NextAuth v5 callbackUrl round-trip through full browser session lifecycle — cannot unit-test cookie setting, server-side redirect chain, and JWT reissue in one assertion"
  - test: "Logged-out /join/[token] → register → callback → confirm screen"
    expected: "Open /join/<valid-token> while logged out; click 'Create account'; complete signup; land back on /join/<same-token> with 5b confirm card"
    why_human: "Same as above but via register flow; tests encodeURIComponent fix (WR-02) against real NextAuth redirect parser"
  - test: "Accept flow end-to-end (logged-in)"
    expected: "From 5b confirm, click 'Accept and join'; redirect to /h/<slug>/dashboard; the new household appears in the user's membership list; JWT reflects new activeHouseholdId on next request"
    why_human: "unstable_update JWT refresh is visible only across two HTTP requests — unit test verifies the call shape but not the downstream cookie / session round-trip"
  - test: "Revocation immediately invalidates link"
    expected: "Generate a link (via direct Server Action or seeded row), copy it; open /join/<token> in an incognito window — see 5a/5b preview; revoke the invitation (direct DB update or Server Action); refresh /join/<token> — see Branch 2 (revoked) rendering"
    why_human: "Tests the end-to-end revocation-visibility path; spot-checks that resolveInvitationByToken's revokedAt field propagates into the page render. SC-1 keyword: 'immediately invalidates'."
  - test: "Already-member branch renders on valid token"
    expected: "As logged-in member of household H, open /join/<token-for-H>; see Branch 4 (already-member) with 'Go to <Household>' link, not Branch 5b"
    why_human: "Branch 4 requires a live session + existing membership row + valid unaccepted invitation. Unit tests mock these layers individually; one-shot verification ensures the composition renders correctly"
---

# Phase 4: Invitation System Verification Report

**Phase Goal:** Owners can generate and revoke shareable join-link tokens; recipients can join via the link regardless of login state; member removal and ownership transfer work.
**Verified:** 2026-04-19T11:45:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Success Criteria from ROADMAP.md)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Owner can generate an invitation link — link works for anyone who has it, has no expiry, and can be revoked (revocation immediately invalidates the link) | VERIFIED (server layer) | `createInvitation` (actions.ts:302) writes tokenHash-only row, returns rawToken once; `revokeInvitation` (actions.ts:358) sets revokedAt; `/join/[token]` page Branch 2 (page.tsx:80) renders the revoked EmptyState based on `resolved.invitation.revokedAt !== null`. Schema has no expiresAt column (D-03). UI trigger for generation deferred to Phase 6 per CONTEXT `<deferred>`. |
| 2 | Logged-out user hitting invite link is routed to login/signup; token survives the auth redirect and the join-confirm page appears after login | VERIFIED | `authConfig.noRedirectPublicPaths = ["/join"]` (auth.config.ts:16) carves `/join` out of the logged-in-redirect-to-dashboard branch; `proxy.ts` matcher excludes `/join`; page Branch 5a (page.tsx:162) renders Sign-in/Create-account buttons with `encodeURIComponent` wrapped `callbackUrl=/join/<token>` (WR-02 fix applied). |
| 3 | Logged-in user hitting invite link sees a confirm screen showing household name, owner, and member count before accepting | VERIFIED | page Branch 5b (page.tsx:225) renders Card with `{resolved.household.name}`, `{ownerName}`, and `{memberCount} {memberWord}`; AcceptForm calls `acceptInvitation` and navigates to `/h/<slug>/dashboard`. `resolveInvitationByToken` (queries.ts:97) returns the triple. |
| 4 | User can leave any household; if sole owner + last member the household and plants are deleted (destructive-confirm) | VERIFIED (server layer) | `leaveHousehold` (actions.ts:529) — D-13 last-OWNER pre-check blocks multi-member sole-OWNER leaves; D-14 `isSoleMember → db.household.delete` cascade (actions.ts:589, WR-03 fix: now `isSoleMember` alone, not role-gated); `DestructiveLeaveDialog` (destructive-leave-dialog.tsx) exists and is imported by zero call sites yet — wiring is Phase 6's consumer. transitionCycle('member_left') fires for active assignee (actions.ts:598). |
| 5 | Owner can remove any non-owner member; owner can transfer ownership to another member | VERIFIED (server layer) | `removeMember` (actions.ts:641) — OWNER-gated, self-target blocked, Pitfall 6 last-OWNER count excludes target; `promoteToOwner` (actions.ts:731) + `demoteToMember` (actions.ts:780) — co-owner model per D-10..D-15; transferOwnership decomposes into promote + optional self-demote. All UI consumers deferred to Phase 6. |

**Score:** 5/5 truths verified at the layer Phase 4 owns (Server Actions, queries, schema, public `/join` route, auth carve-outs). UI triggers for generate/leave/remove/promote/demote are explicitly deferred to Phase 6 per CONTEXT `<domain>` and `<deferred>`, and are not in Phase 4 scope.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/crypto.ts` | generateInvitationToken + hashInvitationToken using node:crypto CSPRNG + SHA-256 | VERIFIED | 26 lines; `randomBytes(32).toString("hex")` (64 hex chars = 256 bits); returns only tokenHash for persistence. Pitfall 10 §1 binding satisfied. |
| `src/features/household/schema.ts` | 7 new Zod schemas (create/revoke/accept invitation, leave, remove, promote, demote) | VERIFIED | All 7 exports at lines 93/104/116/127/138/149/162; `acceptInvitationSchema` has `regex(/^[0-9a-f]{64}$/)` format guard (WR-01 fix applied). |
| `src/features/household/queries.ts` | resolveInvitationByToken + getHouseholdInvitations + getHouseholdMembers | VERIFIED | All 3 exports at lines 97/174/200. Active-only filter on invitations. createdAt-to-joinedAt shape mapping for members. |
| `src/features/household/actions.ts` | 7 Server Actions (createInvitation, revokeInvitation, acceptInvitation, leaveHousehold, removeMember, promoteToOwner, demoteToMember) | VERIFIED | All 7 exports at lines 302/358/429/529/641/731/780. All follow Phase 2 D-12 seven-step template (auth → demo → Zod → requireHouseholdAccess → role → write → revalidate). acceptInvitation skips Step 4 by design (D-16). |
| `src/app/join/[token]/page.tsx` | Public Server Component with five-branch render | VERIFIED | 266 lines. Five branches present: invalid (line 59), revoked (80), already-used (101), already-member (122), logged-out preview 5a (162), logged-in confirm 5b (225). `metadata.robots = { index: false, follow: false }` (line 27) blocks search-engine caching. |
| `src/app/join/[token]/accept-form.tsx` | Client form wrapping acceptInvitation with isPending + toast + router.push | VERIFIED | 43 lines. useState isPending; toast.error on failure; router.push(result.redirectTo) + router.refresh() on success; min-h-[44px] touch target. |
| `src/components/household/destructive-leave-dialog.tsx` | Controlled ResponsiveDialog gating sole-member leave | VERIFIED (exists, unwired) | 105 lines. plantCount/roomCount/householdName props; handleOpenChange blocks close-during-pending; destructive variant CTA. ORPHANED — no consumer imports it yet; Phase 6 will wire. |
| `auth.config.ts` | noRedirectPublicPaths carve-out for /join | VERIFIED | Line 16: `noRedirectPublicPaths = ["/join"]`; Line 28: check runs BEFORE logged-in redirect branch. |
| `proxy.ts` | matcher excludes /join | VERIFIED | Line 8: matcher negative-lookahead regex includes `\|join`. |
| `auth.ts` | unstable_update re-export | VERIFIED | Line 9: `export const { auth, handlers, signIn, signOut, unstable_update } = NextAuth(...)`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `src/app/join/[token]/page.tsx` | `resolveInvitationByToken` | import from `@/features/household/queries` | WIRED | Line 23 import; line 56 call |
| `src/app/join/[token]/accept-form.tsx` | `acceptInvitation` | import from `@/features/household/actions` | WIRED | Line 7 import; line 16 call with `{ token }` |
| `acceptInvitation` (actions.ts) | `unstable_update` | import from `auth.ts` | WIRED | Line 500 call with `{ user: { activeHouseholdId: householdId } }` after tx commit |
| `leaveHousehold` (actions.ts) | `transitionCycle` | import from `./cycle` | WIRED | Line 598 call with `(householdId, "member_left")` when caller is active assignee |
| `leaveHousehold` (actions.ts) | `db.household.delete` (cascade) | D-14 terminal | WIRED | Line 590 — `isSoleMember` branch (WR-03 simplified) |
| `removeMember` (actions.ts) | `transitionCycle` | import from `./cycle` | WIRED | Line 693 — fires when removed user is active assignee |
| `/join/[token]` public accessibility | `authConfig.authorized` carve-out + proxy matcher exclusion | D-21 | WIRED | auth.config.ts:28 early-return for isNoRedirectPublic; proxy.ts:8 matcher excludes /join |
| AcceptForm submit → acceptInvitation → dashboard redirect | `redirectTo` envelope + router.push | D-22 | WIRED | actions.ts:506 returns `/h/<slug>/dashboard`; accept-form.tsx:27 navigates |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `/join/[token]/page.tsx` | `resolved` | `resolveInvitationByToken(token)` → `db.invitation.findUnique` with household + members include | Yes — real Prisma query | FLOWING |
| `/join/[token]/page.tsx` | `existingMembership` | `db.householdMember.findFirst({ householdId, userId })` | Yes | FLOWING |
| AcceptForm | `result` from `acceptInvitation` | Server Action returning `{ success, redirectTo }` or `{ error }` | Yes — Server Action returns real envelope tied to Prisma tx | FLOWING |
| DestructiveLeaveDialog | `plantCount`, `roomCount`, `householdName` | Props from future Phase 6 caller | N/A — no caller in Phase 4 | HOLLOW (deferred to Phase 6 wiring) |

Note: `DestructiveLeaveDialog` HOLLOW status is expected per CONTEXT `<domain>` — "Explicitly not in this phase: ... member-list UI, rotation reorder controls, cycle banner — all Phase 6." The component is a shipped primitive, consumed later.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase 4 mocked-Prisma test suite passes | `npx vitest run tests/phase-04/ --reporter=dot` | 10 files / 54 tests pass; 4 real-DB files fail on DATABASE_URL (expected per user context — pre-existing env issue, not Phase 4 regression) | PASS (54/54 mocked) |
| Token generator produces 64 hex chars | Read `src/lib/crypto.ts:18` — `randomBytes(32).toString("hex")` (32 bytes → 64 hex) | 64-char hex matches acceptInvitationSchema regex | PASS |
| `/join` is a Next.js route | `ls src/app/join/[token]/page.tsx accept-form.tsx` | Both files exist | PASS |
| Schema regex guard on acceptInvitationSchema | Read schema.ts:118 — `z.string().regex(/^[0-9a-f]{64}$/)` | WR-01 fix present | PASS |
| callbackUrl is percent-encoded | Read page.tsx:194,205 — `encodeURIComponent(\`/join/${token}\`)` | WR-02 fix present | PASS |
| leaveHousehold sole-member condition is role-agnostic | Read actions.ts:589 — `if (isSoleMember) { db.household.delete }` | WR-03 fix present | PASS |
| 14 test files have zero test.todo remaining | `grep -c "test\.todo" tests/phase-04/*.test.ts` | All return 0 | PASS |
| Invitation schema has required columns | Read `prisma/schema.prisma:211-226` — tokenHash @unique, invitedByUserId, revokedAt, acceptedAt, acceptedByUserId, createdAt | All present; @@index([householdId]) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| INVT-01 | 04-03 | Owner generates shareable invitation link (CSPRNG, no expiry, revocable) | SATISFIED | `createInvitation` (actions.ts:302) uses CSPRNG via `generateInvitationToken()`; schema has no expiresAt column (D-03); revokeInvitation sets revokedAt. 4 mocked-Prisma tests pass. |
| INVT-02 | 04-02, 04-03 | Owner views active invitations and revokes any (atomic invalidation) | SATISFIED | `getHouseholdInvitations` (queries.ts:174) filters `{ revokedAt: null, acceptedAt: null }`; `revokeInvitation` updates revokedAt atomically with cross-household guard. 3 + 4 mocked tests pass. |
| INVT-03 | 04-05 | Opening link while logged-out routes to login/signup; token preserved through auth | SATISFIED | `authConfig.noRedirectPublicPaths` + `proxy.ts` matcher exclusion; Branch 5a renders Sign-in/Create-account with `encodeURIComponent(callbackUrl)`. NextAuth v5 native callbackUrl handles redirect-back. |
| INVT-04 | 04-02, 04-03, 04-05 | Opening link while logged-in shows confirm with household name/owner/count; accept joins | SATISFIED | Branch 5b (page.tsx:225) renders all three fields; AcceptForm submits acceptInvitation; atomic updateMany + count-guard + rotation-append + unstable_update. 7 mocked tests + 2 real-DB concurrency tests (D-23). |
| INVT-05 | 04-04 | User can leave any household; sole-owner last-member deletes household (destructive-confirm) | SATISFIED (server) | `leaveHousehold` with D-13 last-OWNER pre-check + D-14 terminal (household.delete + cascade); active-assignee leaves call transitionCycle. `DestructiveLeaveDialog` component exists; Phase 6 wires it. 8 mocked tests + real-DB cascade test (D-14) + real-DB assignee-leaves test (D-27). |
| INVT-06 | 04-04 | Owner removes non-owner; owner transfers ownership | SATISFIED (server) | Co-owner model per D-10..D-15: `removeMember` (OWNER-gated + self-target guard + Pitfall 6 last-OWNER protection); `promoteToOwner` + `demoteToMember` decompose transferOwnership. 6 + 8 mocked tests. |

**No orphaned requirements.** All 6 Phase 4 IDs (INVT-01..06) have plan-level claim and implementation evidence.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/features/household/actions.ts` | 514 | `AcceptRaceError` class declared AFTER its use site (IN-01 from REVIEW) | Info | Works at runtime (class evaluated before acceptInvitation is called); stylistic only. Not a blocker. |
| `src/features/household/schema.ts` | 85,95,107,128,139,150,163 | `householdSlug` validated but unused in revalidatePath (IN-02) | Info | Dead input field increases surface but does not affect correctness. Phase 6 UI may consume it. |
| `src/features/household/actions.ts` | 602-603,701 | `todayStart` uses server-local time without comment (IN-03) | Info | Documentation gap; schema.ts:62 acknowledges same issue. Phase 6 may thread household timezone. |
| `tests/phase-04/accept-invitation-concurrency.test.ts` | 70 | Mocks same userId for both concurrent calls (IN-04) | Info | Tests DB-layer atomicity; does not simulate two distinct users. Real-DB concurrency test (D-23) with 3 separate invitations + same user is acceptable coverage. |

**All 3 warning-level findings (WR-01, WR-02, WR-03) from 04-REVIEW.md were fixed** in commits b5605f7 (schema regex), a95d541 (callbackUrl encoding), 6f7c7c8 (isSoleMember simplification). Zero blockers. The 4 info items above are documentation/stylistic and do not prevent the goal.

### Deferred Items (addressed in later phases)

The following Phase 4 must-haves are implemented at the Server Action + query layer but intentionally lack user-facing UI triggers; the UI wiring is scoped to Phase 6 per CONTEXT `<domain>` and ROADMAP Phase 6 goal. These are NOT Phase 4 gaps:

| Item | Addressed In | Evidence |
|------|-------------|----------|
| Invite-generator UI (copy-link button, paste target for owners) | Phase 6 | Phase 6 goal: "owners can manage household settings, member list, rotation order, and invite links from one page"; SC 3 references "generate/revoke invitation links" |
| Member-list UI with remove/promote/demote controls | Phase 6 | Phase 6 HSET-03: "view and reorder member list, ..., remove members, transfer ownership" |
| Wired DestructiveLeaveDialog (Phase 6 settings triggers) | Phase 6 | Phase 6 consumer interface lists `leaveHousehold` + `DestructiveLeaveDialog` per 04-CONTEXT `<code_context>` |
| Household switcher / default landing | Phase 6 | Phase 6 SC 1, 2 |

### Human Verification Required

Five end-to-end flows need a browser + real session to confirm behavior that unit tests + mocked-Prisma assertions cannot verify:

#### 1. Logged-out callbackUrl round-trip (login path)

**Test:** Sign out. Open `/join/<valid-token>` directly. Verify Branch 5a renders with "Sign in" / "Create account" buttons. Click "Sign in". Complete login. Verify redirect back to `/join/<same-token>` and Branch 5b confirm card renders with correct household name, owner, member count.
**Expected:** Post-login landing at `/join/<token>` confirm card. `encodeURIComponent` on the callbackUrl produces a valid percent-encoded URL.
**Why human:** Full NextAuth v5 redirect chain + cookie handling spans multiple HTTP requests; cannot be asserted in a single unit test.

#### 2. Logged-out callbackUrl round-trip (register path)

**Test:** Same as #1 but via "Create account" → complete signup flow → verify redirect to `/join/<token>`.
**Expected:** New user lands on 5b confirm; no auto-accept; explicit click required.
**Why human:** Same redirect chain concern + registerUser transactional hook side effects.

#### 3. Accept-and-land flow

**Test:** From Branch 5b as a logged-in user NOT in the household, click "Accept and join". Verify redirect to `/h/<newSlug>/dashboard`. On next page load, verify the household appears in the user's membership list and `session.user.activeHouseholdId === <newId>`.
**Expected:** JWT reissued with new activeHouseholdId; dashboard renders household-scoped data.
**Why human:** `unstable_update` JWT refresh is visible only across two HTTP requests; tests verify the call shape, not the downstream cookie.

#### 4. Revocation immediately invalidates link

**Test:** (a) Seed or generate an invitation; open `/join/<token>` to confirm it renders a valid preview (Branch 5a or 5b). (b) Revoke it (via Server Action invocation in a REPL, or via direct `UPDATE Invitation SET revokedAt = NOW()`). (c) Refresh `/join/<token>` in the browser.
**Expected:** Branch 2 (ShieldOff EmptyState, "This invite has been revoked") renders.
**Why human:** Tests the SC-1 keyword "revocation immediately invalidates" across a full page render; no single unit test spans revoke → page render.

#### 5. Already-member branch (Branch 4)

**Test:** As a logged-in member of household H, open a still-valid, still-unrevoked invitation token for H. Verify Branch 4 renders (Home icon, "You're already in {Household}", link to `/h/<slug>/dashboard`), not Branch 5b.
**Expected:** Branch 4 takes precedence over Branch 5b when membership exists.
**Why human:** Requires live session + existing membership row + valid invitation simultaneously; branch ordering only exercises correctly end-to-end.

### Gaps Summary

**No blocking gaps.** All 6 Phase 4 requirement IDs (INVT-01..06) are satisfied at the server layer Phase 4 owns. The three warning findings from 04-REVIEW.md (WR-01 schema regex, WR-02 callbackUrl encoding, WR-03 sole-member terminal) were fixed in commits b5605f7, a95d541, 6f7c7c8 respectively. The four info findings (IN-01..IN-04) are stylistic/documentation.

**User-facing UI wiring** (invite-link generator surface, member list with remove/promote/demote, leave button wired to DestructiveLeaveDialog) is **explicitly scoped to Phase 6** per CONTEXT `<domain>` and ROADMAP Phase 6 goal. Phase 4's contract is the Server Action + query + public-route surface, and that surface is complete and tested.

**Test suite state:** 54/54 mocked-Prisma tests pass across 10 files. The 4 real-DB integration test files (accept-invitation-concurrency, leave-household-sole, assignee-leaves, jwt-refresh) require DATABASE_URL to be loaded in the vitest environment — this is a pre-existing env-not-loaded issue affecting Phase 2 and Phase 3 real-DB tests identically, not a Phase 4 regression. The integration tests have passed previously when run with DATABASE_URL explicitly set, per 04-06-SUMMARY §Self-Check.

**Status rationale:** `human_needed`, not `passed` — the five human verification items exercise end-to-end flows (NextAuth callbackUrl round-trip, JWT reissue across requests, revocation-propagation render, branch-4 composition) that unit tests cannot confirm in isolation. Per Step 9 decision tree, any non-empty human verification section forces `human_needed` even when goal-achievement score is full.

---

_Verified: 2026-04-19T11:45:00Z_
_Verifier: Claude (gsd-verifier)_

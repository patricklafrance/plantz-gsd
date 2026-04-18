# Phase 4: Invitation System - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `04-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-04-18
**Phase:** 04-invitation-system
**Workstream:** `household`
**Areas discussed:** all (1. Token flow, 2. Link capacity, 3. Confirm UX, 4. Ownership transfer, 5. Leave guards, 6. invitedEmail, 7. Invite list, 8. /join fail UX)

---

## Area 1 — Logged-out token preservation

| Option | Description | Selected |
|--------|-------------|----------|
| Public /join page + callbackUrl | /join/[token] public; NextAuth-native callbackUrl threads through /login /register back to /join. No cookie, no DB row. WorkOS/Notion pattern. | ✓ |
| HTTP-only cookie | Cookie set on /join hit; consumed post-auth by a hook. More moving parts. | |
| DB PendingInvite row | Sessionless pending-invite table keyed by client id. Durable but overkill for v1. | |

**User's choice:** Public /join page + callbackUrl (Recommended).
**Notes:** Matches Area 6 direction of "no additional state machinery" — token lives in URL the whole time.

---

## Area 2 — Link capacity and revocation model

| Option | Description | Selected |
|--------|-------------|----------|
| Unlimited concurrent active links | Multiple open invites; owner revokes any individually. Query where revokedAt IS NULL AND acceptedAt IS NULL. Matches INVT-02 plural wording. | ✓ |
| One active link per household | Regenerate auto-revokes previous. Simpler UX; contradicts INVT-02 wording. | |
| One reusable link (no acceptedAt terminal) | Token accepted by N users; revoke is the only terminal state. Loses Pitfall 10 §2 one-time-use guarantee. | |

**User's choice:** Unlimited concurrent active links (Recommended).
**Notes:** Aligned with the REQUIREMENTS.md phrase "view all active invitation links and revoke any."

---

## Area 3 — Confirm-join page UX

| Option | Description | Selected |
|--------|-------------|----------|
| Household name + owner + member count | Single-page confirm matching INVT-04 literally. Accept is a Server Action on that page. | ✓ |
| Above + plant count + room count | Adds light context; nice-to-have, not in INVT-04. | |
| Two-route confirm → /accept | Preview page + separate accept route. Extra surface for no UX gain. | |

**User's choice:** Household name + owner + member count (Recommended).
**Notes:** Matches INVT-04 spec; keeps surface small.

---

## Area 4 — Ownership transfer flow

| Option | Description | Selected |
|--------|-------------|----------|
| Two separate actions (transferOwnership + optional leave) | Promote successor + self-demote atomically; single OWNER survives. | |
| Atomic promote-and-leave | One action; couples promotion and caller removal. | |
| Co-owner model (multiple OWNERs) | Transfer decomposes into promote/demote primitives; household can have N OWNERs. | ✓ |

**User's choice:** Co-owner model (multiple OWNERs).
**Notes:** Deviation from recommended. Triggered the co-owner semantics follow-up below. Decomposes INVT-06 "transfer ownership" into `promoteToOwner` + optional `demoteToMember`.

---

## Area 4 follow-up — Co-owner semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Any OWNER promotes/demotes; block last-owner leave | Symmetric role changes; force explicit successor promotion before last owner leaves; sole-member-and-last-owner still deletes household. | ✓ |
| Any OWNER promotes; only self-demote; auto-promote on leave | Avoids dead-end UX; hides role changes. | |
| Founding-owner-only promotion | Preserves principal-owner concept; complicates REQUIREMENTS. | |

**User's choice:** Any OWNER promotes/demotes; block last-owner leave (Recommended).
**Notes:** Explicit successor promotion before leave; no auto-promotion magic.

---

## Area 5 — Leave/remove edge guards

| Option | Description | Selected |
|--------|-------------|----------|
| Cancel leaver's future availabilities; keep historical | Delete Availability rows with startDate >= today; audit rows (WateringLog/Note) stay via createdByUserId SetNull. Demo blocked. | ✓ |
| Above + block leave while inside active availability window | Forces ending the away period before leaving. Friction without clear benefit. | |
| Minimum guards only | Only the already-decided two cases. Stale rows linger (harmless). | |

**User's choice:** Cancel leaver's future availabilities; keep historical rows (Recommended).
**Notes:** Balances cleanliness (dead future rows removed) with audit preservation (past rows intact).

---

## Area 6 — invitedEmail field usage in v1

| Option | Description | Selected |
|--------|-------------|----------|
| Always null in v1 | No input field; column stays dormant. Matches no-email project constraint. | ✓ |
| Optional input, display-only on confirm-join | Soft identity hint. Pitfall 10 §3 behavior. | |
| Optional input, enforced match at accept | Stronger gate; contradicts ARCHITECTURE.md Anti-Pattern 4. | |

**User's choice:** Always null in v1 (Recommended).
**Notes:** Column stays in schema for future milestones.

---

## Area 7 — Owner's invite list visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Active only (pending + unrevoked) | Filter: acceptedAt IS NULL AND revokedAt IS NULL. Matches INVT-01/02 literally. | ✓ |
| Active + recent revoked (last 30 days) | Adds revoked badge in UI; recall aid. | |
| All rows with status badge | Full history in settings; UI complexity for three states. | |

**User's choice:** Active only (Recommended).
**Notes:** Smallest useful surface; history view deferrable if audit demands arise.

---

## Area 8 — /join/[token] failure-mode UX

| Option | Description | Selected |
|--------|-------------|----------|
| Distinct copy per failure mode | Four branches: invalid / revoked / already-used / already-member. Legible state machine. | ✓ |
| One generic invalid page | Single "not valid" copy for all failures. Minimal but opaque. | |
| Three branches (collapse already-member + accepted) | Saves one branch; loses nuance between "someone else used this" and "you already joined". | |

**User's choice:** Distinct copy per failure mode (Recommended).
**Notes:** Aligned with FEATURES.md state-machine framing.

---

## Claude's Discretion

- File organization inside `src/features/household/`: invitation actions in `actions.ts` vs a new `invitations.ts`.
- Return envelope of `createInvitation`: `{ token, invitationId }` vs `{ token, invitationId, url }`.
- Whether `promoteToOwner` / `demoteToMember` are split actions or one `setMemberRole`.
- Exact copy strings for the four D-09 failure branches and INVT-04 confirm page.
- Failure handling of `unstable_update` post-commit (current approach: next-request correction via live membership check, no compensating write).
- Whether `revokeInvitation` takes a redundant `householdId` hidden field for grep-consistency with Phase 2 D-04.

## Deferred Ideas

See `04-CONTEXT.md §deferred` — all 16 deferred items captured there (QR code, app-sent email, expiry, email-gate, link-count simplifications, auto-promote, founding-owner, availability-block-leave, history surface, observer role, bulk removal, plant transfer on leave, rotation reorder, generic failure page).

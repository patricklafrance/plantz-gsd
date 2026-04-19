---
phase: 04-invitation-system
fixed_at: 2026-04-18T00:00:00Z
review_path: .planning/workstreams/household/phases/04-invitation-system/04-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 4: Code Review Fix Report

**Fixed at:** 2026-04-18
**Source review:** .planning/workstreams/household/phases/04-invitation-system/04-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (WR-01, WR-02, WR-03 — Critical+Warning scope, no critical findings)
- Fixed: 3
- Skipped: 0

## Fixed Issues

### WR-01: `acceptInvitationSchema` accepts tokens of any length — no format guard

**Files modified:** `src/features/household/schema.ts`
**Commit:** b5605f7
**Applied fix:** Replaced `z.string().min(1)` with `z.string().regex(/^[0-9a-f]{64}$/, "Invalid invitation token format.")` in `acceptInvitationSchema`. Added an inline comment documenting that the token is always 64 hex chars from `randomBytes(32).toString("hex")`. This eliminates DB round-trips for trivially malformed tokens and makes the schema self-documenting about the expected format.

---

### WR-02: `callbackUrl` in join page uses unencoded token in query parameter

**Files modified:** `src/app/join/[token]/page.tsx`
**Commit:** a95d541
**Applied fix:** Wrapped both `callbackUrl` query parameter values in `encodeURIComponent(...)` — one for the `/login` href and one for the `/register` href in Branch 5a (logged-out preview). The `/join/${token}` path now becomes `encodeURIComponent(\`/join/${token}\`)` in both cases, ensuring the path separator `/` inside the token path is percent-encoded when embedded as a query parameter value.

---

### WR-03: `leaveHousehold` orphans a household when the sole non-owner member leaves

**Files modified:** `src/features/household/actions.ts`
**Commit:** 6f7c7c8
**Applied fix:** Simplified the terminal condition in `leaveHousehold` Step 6 from `isSoleMember && callerIsOwner && otherOwnerCount === 0` to simply `isSoleMember`. When only one member remains and they are leaving, the household must be deleted regardless of their role. The existing `wouldBeLastOwnerBlocked` pre-check above still correctly prevents a sole OWNER in a multi-member household from leaving without first promoting another member. Added a comment explaining the reasoning.

---

_Fixed: 2026-04-18_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

---
phase: 4
slug: invitation-system
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-18
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x |
| **Config file** | `vitest.config.ts` (established in Phase 2) |
| **Quick run command** | `npm test -- --run <pattern>` |
| **Full suite command** | `npm test -- --run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --run <pattern>` (scoped to the file touched)
- **After every plan wave:** Run `npm test -- --run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| *(populated by planner in Wave 0)* | | | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test stub files for every Server Action in Phase 4 (acceptInvitation, createInvitation, revokeInvitation, leaveHousehold, removeMember, transferOwnership)
- [ ] Fixtures for Invitation records (active, revoked, accepted) and Household with owner + members
- [ ] Existing vitest infrastructure covers all phase requirements — no new framework install

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| JWT reissue after `unstable_update` | INVT-05, INVT-06 | Requires a live session cookie roundtrip across two requests; cannot be exercised inside a unit test | Sign in as owner, remove a member via UI, immediately navigate to the removed member's view — confirm the removed member no longer sees the household on next request |
| `/join/[token]` auth-redirect preserves callbackUrl | INVT-02 | Full browser redirect flow with NextAuth callback chain | Open `/join/<token>` while logged out, complete signup, verify landing on `/join/<token>` confirm screen |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

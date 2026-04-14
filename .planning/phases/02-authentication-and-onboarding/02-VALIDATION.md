---
phase: 2
slug: authentication-and-onboarding
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-14
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.4 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | AUTH-01 | — | Registration creates user with hashed password | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | AUTH-02 | — | Login returns valid JWT session | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | AUTH-03 | — | Logout clears session and redirects | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 2 | AUTH-04 | — | Onboarding banner displays for new users | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 02-04-01 | 04 | 2 | AUTH-05 | — | Unauthenticated access redirects to login | unit | `npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/auth/` — test directory for auth unit tests
- [ ] Vitest config verified for Next.js App Router components
- [ ] Test helpers for mocking NextAuth sessions

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Session persists across browser refresh | AUTH-02 | Requires real browser session storage | Log in, close tab, reopen — session should persist |
| Onboarding banner visual appearance | AUTH-04 | Visual/layout verification | First login shows nature-themed banner at top of dashboard |
| Redirect after registration | AUTH-01 | Full Next.js redirect chain | Register new user, verify auto-login and dashboard redirect |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

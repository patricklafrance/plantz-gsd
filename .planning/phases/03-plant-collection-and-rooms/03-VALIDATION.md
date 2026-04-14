---
phase: 3
slug: plant-collection-and-rooms
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-14
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.4 |
| **Config file** | vitest.config.ts |
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
| 3-01-01 | 01 | 1 | PLNT-01 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 3-01-02 | 01 | 1 | PLNT-02 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 3-01-03 | 01 | 1 | PLNT-03 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 3-01-04 | 01 | 1 | PLNT-04 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 3-01-05 | 01 | 1 | PLNT-05 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 3-01-06 | 01 | 1 | PLNT-06 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 3-01-07 | 01 | 1 | PLNT-07 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 3-01-08 | 01 | 1 | PLNT-08 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 3-02-01 | 02 | 1 | ROOM-01 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 3-02-02 | 02 | 1 | ROOM-02 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 3-02-03 | 02 | 1 | ROOM-03 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 3-02-04 | 02 | 1 | ROOM-04 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 3-02-05 | 02 | 1 | ROOM-05 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test stubs for plant CRUD operations (PLNT-01 through PLNT-08)
- [ ] Test stubs for room CRUD operations (ROOM-01 through ROOM-05)
- [ ] Shared fixtures for authenticated user session and test database

*Existing vitest infrastructure from Phase 2 covers framework setup.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Two-step modal flow (catalog select → form fill) | PLNT-01 | Client-side modal step transitions require visual verification | Open add plant modal, select from catalog, verify form pre-fills, submit |
| Plant detail page layout | PLNT-06 | Visual layout and information hierarchy | Navigate to plant detail, verify all sections render correctly |
| Room filter in collection view | ROOM-04 | URL-based filter with UI state sync | Select room filter, verify URL updates and collection re-renders |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

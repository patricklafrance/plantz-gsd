---
phase: 5
slug: notes-search-and-filters
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-14
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.4 |
| **Config file** | `vitest.config.mts` |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-00-01 | 00 | 0 | NOTE-01 | — | N/A | unit | `npm test -- --reporter=verbose 2>&1 \| grep notes` | ❌ W0 | ⬜ pending |
| 05-00-02 | 00 | 0 | NOTE-03 | — | N/A | unit | `npm test` | ❌ W0 | ⬜ pending |
| 05-00-03 | 00 | 0 | SRCH-01 | — | N/A | unit | `npm test` | ❌ W0 | ⬜ pending |
| 05-00-04 | 00 | 0 | SRCH-02 | — | N/A | unit | `npm test` | ❌ W0 | ⬜ pending |
| 05-00-05 | 00 | 0 | SRCH-03 | — | N/A | unit | `npm test` | ❌ W0 | ⬜ pending |
| 05-00-06 | 00 | 0 | NOTE-02 | — | N/A | unit | `npm test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/notes.test.ts` — stubs for NOTE-01, NOTE-03 (schema validation + action tests for createNote, updateNote, deleteNote)
- [ ] `tests/timeline.test.ts` — stubs for NOTE-02 (timeline merge/sort logic)
- [ ] `tests/plants-search.test.ts` — stubs for SRCH-01, SRCH-02, SRCH-03 (getPlants search, filter, sort)

*Existing infrastructure covers test framework. Only test files need creation.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Inline note add UX (type + Enter) | NOTE-01 | UI interaction pattern | Type note text in timeline input, press Enter, verify note appears |
| Instant search filtering | SRCH-01 | Debounced URL param updates need browser | Type in search bar, verify grid filters within 300ms |
| Status filter pills compose with room | SRCH-02 | URL param composition in browser | Select room pill, then status pill, verify grid shows intersection |
| Sort dropdown changes order | SRCH-03 | Client-side URL navigation | Select each sort option, verify plant grid order changes |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

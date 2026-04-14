---
phase: 1
slug: scaffold-and-foundations
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-13
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.4 + Playwright 1.59.1 |
| **Config file** | `vitest.config.mts` (create in Wave 0), `playwright.config.ts` (create in Wave 0) |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npx vitest run && npx playwright test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npx vitest run && npx playwright test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | SC-1 | — | N/A | E2E smoke | `npx playwright test e2e/smoke.spec.ts` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | SC-2 | — | TIMESTAMPTZ on all DateTime columns | Manual | `npx prisma migrate dev` + inspect | ❌ W0 | ⬜ pending |
| 1-01-03 | 01 | 1 | SC-3 | — | Singleton prevents pool exhaustion | Unit | `npx vitest run tests/db.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-04 | 01 | 1 | SC-4 | T-1-01 | Auth rejects unauthenticated requests | Unit | `npx vitest run tests/auth.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-05 | 01 | 1 | SC-5 | — | N/A | Both | `npx vitest run && npx playwright test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.mts` — Vitest framework config
- [ ] `playwright.config.ts` — Playwright framework config
- [ ] `tests/page.test.tsx` — covers SC-5 (Vitest smoke)
- [ ] `e2e/smoke.spec.ts` — covers SC-1, SC-5 (Playwright smoke)
- [ ] `tests/db.test.ts` — covers SC-3 (singleton module shape)
- [ ] `tests/auth.test.ts` — covers SC-4 (auth exports shape)
- [ ] Framework install: `npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom vite-tsconfig-paths` and `npx playwright install --with-deps chromium`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Prisma schema applied with TIMESTAMPTZ | SC-2 | Requires running database; column type verification via `prisma studio` or psql | Run `npx prisma migrate dev`, then verify columns via `\d "Plant"` in psql or Prisma Studio |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

---

*Phase: 01-scaffold-and-foundations*
*Validation strategy created: 2026-04-13*

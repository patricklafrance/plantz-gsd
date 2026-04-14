---
phase: 01-scaffold-and-foundations
plan: 03
subsystem: testing
tags: [vitest, playwright, shadcn, tailwind, prisma, testing, e2e]

# Dependency graph
requires:
  - phase: 01-01
    provides: Next.js 16 scaffold, Prisma schema, db singleton, globals.css with @theme tokens
  - phase: 01-02
    provides: NextAuth v5 Credentials/JWT auth, proxy.ts route protection, auth.config.ts

provides:
  - Vitest 4.1.4 configured with jsdom environment and tsconfigPaths
  - Playwright 1.59.1 configured with chromium and webServer auto-start
  - 4 test files covering all Phase 1 success criteria (page, db, auth, e2e smoke)
  - shadcn/ui 7 base components (button, card, input, label, separator, skeleton, badge)
  - cn() utility at src/lib/utils.ts
  - components.json in project root
  - Test scripts: test, test:watch, test:e2e in package.json

affects: [all phases - test harness used throughout; phase-02 uses shadcn/ui components]

# Tech tracking
tech-stack:
  added:
    - vitest@4.1.4 (unit test runner)
    - "@vitejs/plugin-react" (JSX transform for Vitest)
    - jsdom (DOM environment for Vitest)
    - "@testing-library/react" + "@testing-library/dom" (React test utilities)
    - vite-tsconfig-paths (path alias resolution)
    - "@playwright/test@1.59.1" (E2E test runner)
  patterns:
    - Source-level validation pattern for modules that cannot be instantiated without external services (db, auth)
    - Vitest include scope limited to tests/ to prevent Playwright spec conflicts

key-files:
  created:
    - vitest.config.mts
    - playwright.config.ts
    - tests/page.test.tsx
    - tests/db.test.ts
    - tests/auth.test.ts
    - e2e/smoke.spec.ts
  modified:
    - package.json (added test scripts and dev dependencies)

key-decisions:
  - "Limit Vitest include pattern to tests/ only to avoid Playwright spec files being picked up by Vitest runner"
  - "Source-level fs.readFileSync validation for auth and db modules avoids spinning up real DB/auth in unit tests"
  - "shadcn/ui components committed in plan 01-01; plan 03 verification confirms they are present and correct"

patterns-established:
  - "Pattern 1: Vitest unit tests go in tests/, Playwright E2E tests go in e2e/ - separation prevents runner conflicts"
  - "Pattern 2: Source-level validation for infrastructure modules (read the file, check for expected patterns) rather than instantiating them"

requirements-completed: []

# Metrics
duration: 15min
completed: 2026-04-14
---

# Phase 1 Plan 03: Test Harness and shadcn/ui Summary

**Vitest 4.1.4 + Playwright 1.59.1 test harness with 5 passing unit tests covering page rendering, db singleton shape, and auth configuration contracts; shadcn/ui base components and cn() utility confirmed for Phase 2 readiness**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-14T03:14:53Z
- **Completed:** 2026-04-14T03:30:00Z
- **Tasks:** 2 of 3 (Task 3 is a blocking checkpoint requiring PostgreSQL setup)
- **Files modified:** 8

## Accomplishments

- Installed Vitest 4.1.4 with jsdom, @testing-library/react, and vite-tsconfig-paths; all 5 unit tests pass
- Installed Playwright 1.59.1 with chromium-only project; E2E smoke test created covering home page load and heading render
- Confirmed shadcn/ui 7 base components (button, card, input, label, separator, skeleton, badge) are installed from plan 01-01
- Verified globals.css retains all UI-SPEC @theme tokens including `--color-accent: oklch(62% 0.10 155)`
- Added test/test:watch/test:e2e scripts to package.json

## Task Commits

Each task was committed atomically:

1. **Task 1: Install test frameworks and create validation tests** - `41d186e` (feat)
2. **Task 2: shadcn/ui components** - `58abfd4` (committed in plan 01-01, confirmed present)
3. **Task 3: Prisma schema push + E2E tests** - BLOCKED (awaiting PostgreSQL setup via checkpoint)

## Files Created/Modified

- `vitest.config.mts` - Vitest configuration with jsdom environment, React plugin, tsconfigPaths; include scoped to tests/
- `playwright.config.ts` - Playwright configuration with chromium project, localhost:3000 base URL, dev server auto-start
- `tests/page.test.tsx` - Vitest smoke test: home page renders h1 with "Plantz" text
- `tests/db.test.ts` - Source-level validation: db.ts exports db, uses PrismaPg, globalForPrisma, NODE_ENV guard
- `tests/auth.test.ts` - Source-level validation: auth.config.ts is edge-safe (no db/bcrypt imports), auth.ts has Credentials+Zod, proxy.ts exports auth as proxy
- `e2e/smoke.spec.ts` - Playwright E2E: home page loads without errors, displays "Plantz" heading
- `package.json` - Added test, test:watch, test:e2e scripts; new devDependencies for vitest, playwright, testing-library

## Decisions Made

- Scoped Vitest `include` to `tests/**` only: Vitest default glob picks up e2e/ causing Playwright test() call conflicts; explicit include pattern resolves this cleanly.
- Used source-level validation (fs.readFileSync + string matching) for db and auth modules: instantiating PrismaClient or NextAuth in unit tests requires real infrastructure. The source checks still validate the structural contracts without service dependencies.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Vitest picking up Playwright e2e specs**
- **Found during:** Task 1 (run npx vitest run verification)
- **Issue:** Vitest default include glob matched e2e/smoke.spec.ts; Playwright's test() function is not Vitest's — caused immediate failure
- **Fix:** Added `include: ["tests/**/*.{test,spec}.{ts,tsx}"]` to vitest.config.mts test configuration
- **Files modified:** vitest.config.mts
- **Verification:** npx vitest run exits 0 with 5 tests in 3 files
- **Committed in:** 41d186e (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary for correct test isolation. No scope creep.

## Issues Encountered

- `prisma.config.ts` requires `DATABASE_URL` environment variable which is not set (no `.env.local` file). `npx prisma db push` fails with "datasource.url property is required". This is the expected blocking condition for Task 3 checkpoint.

## Known Stubs

None - no stubs in the test harness or shadcn/ui components.

## Threat Flags

None - test files are in tests/ and e2e/ directories, outside the app/ bundle. No new network endpoints or auth paths introduced by this plan.

## User Setup Required

Task 3 requires PostgreSQL to be running and DATABASE_URL configured. See plan frontmatter `user_setup` section:

1. Install PostgreSQL (local) or use cloud provider (Neon/Supabase free tier)
2. Create a database named `plantz_dev`
3. Create `.env.local` in the project root:
   ```
   DATABASE_URL="postgresql://user:password@localhost:5432/plantz_dev"
   AUTH_SECRET="<generate with: openssl rand -base64 32>"
   NEXTAUTH_URL="http://localhost:3000"
   ```
4. Run `npx prisma db push` — should complete with "Your database is now in sync"
5. Run `npx playwright test` — smoke tests should pass

## Next Phase Readiness

- Vitest test harness is ready; run `npm test` to execute unit tests at any time
- Playwright E2E is configured; will run once PostgreSQL + dev server are available
- shadcn/ui base components ready for Phase 2 (button, card, input, label, separator, skeleton, badge)
- cn() utility available at `@/lib/utils`
- Phase 2 is blocked on Prisma schema push (Task 3 checkpoint)

---
*Phase: 01-scaffold-and-foundations*
*Completed: 2026-04-14 (partial — Task 3 pending user PostgreSQL setup)*

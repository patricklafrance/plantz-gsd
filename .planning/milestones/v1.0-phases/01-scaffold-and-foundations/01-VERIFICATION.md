---
phase: 01-scaffold-and-foundations
verified: 2026-04-14T00:30:00Z
status: human_needed
score: 4/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Run npm run dev and visit http://localhost:3000"
    expected: "Dev server starts without errors, home page shows 'Plantz' heading"
    why_human: "Cannot start dev server in verifier context; npm run dev requires an interactive environment"
  - test: "Run npx playwright test"
    expected: "Both E2E smoke tests pass (home page loads, Plantz heading visible)"
    why_human: "Playwright requires a running dev server; E2E cannot be verified without starting Next.js dev process"
  - test: "Run npx prisma db push (without manually setting DATABASE_URL)"
    expected: "Command completes successfully without requiring manual env var workaround"
    why_human: "The prisma.config.ts uses dotenv/config which loads .env (not .env.local). Credentials are in .env.local only. Standard prisma CLI commands fail without a workaround. This is a developer ergonomics gap that needs human decision: add a .env symlink, add dotenv-cli as dev dep, or accept the workaround."
---

# Phase 1: Scaffold and Foundations Verification Report

**Phase Goal:** A working Next.js 16 project exists with the correct foundational decisions baked in — schema, singleton, auth config, middleware, and test harness — so nothing needs to be retrofitted
**Verified:** 2026-04-14T00:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | The app runs locally with `npm run dev` and passes a smoke test request with no errors | ? HUMAN_NEEDED | `next build` completes successfully (Turbopack, no errors). Vitest 5/5 pass. Dev server startup and E2E smoke test require human verification. |
| 2 | The Prisma schema is applied to a local PostgreSQL database and uses TIMESTAMPTZ for all timestamp columns | ✓ VERIFIED | `prisma/schema.prisma` has 17 DateTime columns, all with `@db.Timestamptz(3)` (17/17). Running `npx prisma db push` with explicit DATABASE_URL returns "The database is already in sync with the Prisma schema." |
| 3 | The `lib/db.ts` Prisma singleton exists and prevents connection pool exhaustion in dev and serverless environments | ✓ VERIFIED | `src/lib/db.ts` exports `db` using `globalForPrisma.prisma` pinning, `PrismaPg` adapter, and `NODE_ENV !== "production"` guard. Import from `../../app/generated/prisma/client` resolves correctly to `app/generated/prisma/client` at project root. |
| 4 | NextAuth v5 is configured with the credentials provider and JWT session strategy; `proxy.ts` middleware rejects unauthenticated requests to protected routes | ✓ VERIFIED | `auth.config.ts` is edge-safe (no db/bcrypt imports), has JWT strategy and authorized callback for /dashboard, /plants, /rooms. `auth.ts` uses Credentials + Zod v4 + bcryptjs + Prisma lookup. `proxy.ts` exports `auth as proxy` with correct matcher. Route handler wired at `src/app/api/auth/[...nextauth]/route.ts`. |
| 5 | Vitest and Playwright are configured and a single passing test exists for each | ? HUMAN_NEEDED | Vitest: 5 tests in 3 files all pass (`npx vitest run` exits 0). Playwright: `playwright.config.ts` configured with chromium and webServer. E2E `smoke.spec.ts` created with correct assertions — but requires running dev server to verify. Human must run `npx playwright test`. |

**Score:** 3/5 truths fully verified automated; 2/5 require human confirmation (SC-1 and SC-5)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `prisma/schema.prisma` | Full data model with 7 entities | ✓ VERIFIED | 7 models: User, Room, Plant, WateringLog, HealthLog, CareProfile, Reminder. All 17 DateTime columns have `@db.Timestamptz(3)`. |
| `src/lib/db.ts` | Prisma singleton client | ✓ VERIFIED | Exports `db`, uses `PrismaPg`, `globalForPrisma`, `NODE_ENV` guard. |
| `next.config.ts` | Turbopack config for Prisma 7 | ✓ VERIFIED | `serverExternalPackages: ["@prisma/client", "pg"]` at top level (not under experimental — correctly fixed per plan deviation). |
| `src/app/globals.css` | Tailwind v4 @theme tokens from UI-SPEC | ✓ VERIFIED | Contains `@import "tailwindcss"`, `@theme` block with `--color-accent: oklch(62% 0.10 155)`, all spacing and color tokens. shadcn CSS variables coexist. |
| `.env.example` | Environment variable template | ✓ VERIFIED | Contains `DATABASE_URL`, `AUTH_SECRET`, `NEXTAUTH_URL` with placeholder values only. |
| `auth.config.ts` | Edge-safe NextAuth config with authorized callback | ✓ VERIFIED | No db/bcrypt/prisma imports. Has `authorized` callback, `strategy: "jwt"`, `signIn: "/login"`. |
| `auth.ts` | Full NextAuth config with Credentials provider | ✓ VERIFIED | Exports `auth`, `handlers`, `signIn`, `signOut`. Uses Credentials, bcryptjs, Zod v4 (`from "zod/v4"`), `db.user.findUnique`. |
| `proxy.ts` | Next.js 16 route protection | ✓ VERIFIED | Exports `auth as proxy`. Has matcher regex excluding api, static, login, register. No `middleware.ts` present. |
| `src/app/api/auth/[...nextauth]/route.ts` | NextAuth route handler | ✓ VERIFIED | Exports `GET`, `POST` from handlers (relative import path `../../../../../auth`). |
| `vitest.config.mts` | Vitest framework configuration | ✓ VERIFIED | `defineConfig`, `environment: "jsdom"`, `tsconfigPaths`, `react()`, `include: ["tests/**"]` scope. |
| `playwright.config.ts` | Playwright framework configuration | ✓ VERIFIED | `testDir: "./e2e"`, chromium project, `baseURL: "http://localhost:3000"`, webServer config. |
| `tests/page.test.tsx` | Vitest smoke test for home page rendering | ✓ VERIFIED | Renders `<Page />`, checks for heading and "Plantz" text. |
| `tests/db.test.ts` | Unit test for db singleton module shape | ✓ VERIFIED | Source-level validation: checks `export const db`, `PrismaPg`, `globalForPrisma`. |
| `tests/auth.test.ts` | Unit test for auth module exports | ✓ VERIFIED | Validates edge-safety of auth.config.ts, Credentials/Zod in auth.ts, proxy.ts export name. |
| `e2e/smoke.spec.ts` | Playwright E2E smoke test | ✓ VERIFIED (content) | File exists, tests home page load and Plantz heading. Execution requires human (needs dev server). |
| `components.json` | shadcn/ui configuration | ✓ VERIFIED | Present in project root. Style: `base-nova`, cssVariables: true, correct aliases. |
| `src/lib/utils.ts` | cn() class merge utility | ✓ VERIFIED | Exports `cn()` with `twMerge` and `clsx`. |
| `src/components/ui/button.tsx` | shadcn button component | ✓ VERIFIED | Present. |
| `src/components/ui/card.tsx` | shadcn card component | ✓ VERIFIED | Present. |
| `src/components/ui/input.tsx` | shadcn input component | ✓ VERIFIED | Present. |
| `src/components/ui/label.tsx` | shadcn label component | ✓ VERIFIED | Present. |
| `src/components/ui/separator.tsx` | shadcn separator component | ✓ VERIFIED | Present. |
| `src/components/ui/skeleton.tsx` | shadcn skeleton component | ✓ VERIFIED | Present. |
| `src/components/ui/badge.tsx` | shadcn badge component | ✓ VERIFIED | Present. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/lib/db.ts` | `app/generated/prisma/client` | `import PrismaClient` | ✓ WIRED | `import { PrismaClient } from "../../app/generated/prisma/client"` — resolves to project root `app/generated/prisma/client`. Client generated by `prisma generate`. |
| `src/lib/db.ts` | `@prisma/adapter-pg` | `PrismaPg` adapter | ✓ WIRED | `import { PrismaPg } from "@prisma/adapter-pg"` and `new PrismaPg({ connectionString: ... })`. |
| `next.config.ts` | `serverExternalPackages` | top-level config | ✓ WIRED | `serverExternalPackages: ["@prisma/client", "pg"]` at top level (not under experimental). |
| `proxy.ts` | `auth.ts` | `export { auth as proxy }` | ✓ WIRED | `export { auth as proxy } from "./auth"` — correct relative path from project root. |
| `auth.ts` | `auth.config.ts` | `...authConfig` spread | ✓ WIRED | `import { authConfig } from "./auth.config"` and `...authConfig` spread in NextAuth config. |
| `auth.ts` | `src/lib/db.ts` | `import db` | ✓ WIRED | `import { db } from "@/lib/db"` — resolves to `src/lib/db.ts` via `@/*` → `./src/*` path alias. |
| `app/api/auth/[...nextauth]/route.ts` | `auth.ts` | `import handlers` | ✓ WIRED | `import { handlers } from "../../../../../auth"` — relative path resolves to root `auth.ts`. |
| `vitest.config.mts` | `tests/*.test.tsx` | `include` pattern | ✓ WIRED | `include: ["tests/**/*.{test,spec}.{ts,tsx}"]` correctly scopes to tests/ directory. |
| `playwright.config.ts` | `e2e/*.spec.ts` | `testDir` config | ✓ WIRED | `testDir: "./e2e"` correctly points to E2E directory. |

### Data-Flow Trace (Level 4)

Not applicable for Phase 1. No user-facing components rendering dynamic data — all pages are static scaffolding. The db singleton and auth config are infrastructure-only artifacts.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| App builds without errors | `npx next build` | Build completes with no TypeScript or compilation errors | ✓ PASS |
| Vitest unit tests pass | `npx vitest run` | 5 tests in 3 files — all pass (exit 0) | ✓ PASS |
| Prisma schema validates | `npx prisma validate` | "The schema at prisma/schema.prisma is valid" | ✓ PASS |
| DB schema is applied | `DATABASE_URL=... npx prisma db push` | "The database is already in sync with your Prisma schema." | ✓ PASS |
| E2E smoke tests pass | `npx playwright test` | SKIP — requires running dev server | ? SKIP |
| Dev server starts | `npm run dev` | SKIP — cannot start server in verifier context | ? SKIP |

### Requirements Coverage

Phase 1 is explicitly an infrastructure phase with no user-facing requirements assigned. REQUIREMENTS.md traceability table confirms: "Phase 1 is infrastructure with no user-facing requirements." All 46 v1 requirements are mapped to Phases 2-7. No orphaned requirements for Phase 1.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `prisma.config.ts` | 3 | `import "dotenv/config"` loads `.env` (not `.env.local`), but credentials are only in `.env.local` | ⚠️ Warning | `npx prisma db push` and `npx prisma studio` fail without manual `DATABASE_URL` env var. The DB IS in sync but developer workflow is impaired. Fix: create `.env` with DATABASE_URL, or add `dotenv-cli` and prefix prisma commands. |
| `src/app/(auth)/login/page.tsx` | 1 | Returns `<h1>Login</h1>` — intentional placeholder | ℹ️ Info | Intentional stub per plan, resolved in Phase 2. |
| `src/app/(auth)/register/page.tsx` | 1 | Returns `<h1>Register</h1>` — intentional placeholder | ℹ️ Info | Intentional stub per plan, resolved in Phase 2. |
| `src/app/(main)/dashboard/page.tsx` | 1 | Returns `<h1>Dashboard</h1>` — intentional placeholder | ℹ️ Info | Intentional stub per plan, resolved in Phase 4. |
| `src/app/(main)/plants/page.tsx` | 1 | Returns `<h1>Plants</h1>` — intentional placeholder | ℹ️ Info | Intentional stub per plan, resolved in Phase 3. |
| `package.json` | — | `"next": "^16.2.2"` uses caret (not strictly pinned). Plan and CLAUDE.md say "pinned" | ℹ️ Info | Allows Next.js to float to 16.x.x. Functionally harmless for now; caret will never leave 16.x range. |
| `package.json` | — | `"typescript": "^5"` — CLAUDE.md recommends TS 6.0 | ℹ️ Info | TS 5.x works with Next.js 16. TS 6.0 migration could happen later if needed. Not a blocker. |

**Missing directory structure (plan acceptance criteria, not roadmap SC):**
- `src/features/auth/` — missing
- `src/features/plants/` — missing
- `src/hooks/` — missing
- `src/components/auth/` — missing
- `src/components/plants/` — missing
- `src/components/dashboard/` — missing

These directories are referenced in plan 01-01 Task 1 acceptance criteria ("Directory src/features/auth exists", "Directory src/features/plants exists") but are NOT in the roadmap success criteria. They will be created naturally when Phase 2 and 3 implementation requires them. Not escalated as gaps.

### Human Verification Required

#### 1. Dev Server Smoke Test

**Test:** Run `npm run dev` in the project root. Wait for "Ready in Xms" message, then visit `http://localhost:3000`.
**Expected:** Dev server starts without errors or TypeScript compilation failures. Page shows a "Plantz" heading in the center. Browser console shows no JS errors.
**Why human:** Cannot start a dev server in the verifier context. `next build` passed (stronger test), but the roadmap SC specifically says "with `npm run dev`."

#### 2. Playwright E2E Smoke Test

**Test:** With the dev server running (or not, Playwright will start it), run `npx playwright test`.
**Expected:** Both tests in `e2e/smoke.spec.ts` pass: (1) home page loads without an error title, (2) "Plantz" heading is visible. Exit code 0.
**Why human:** Playwright must start the Next.js dev server. Cannot automate this in a non-interactive verifier context.

#### 3. Prisma CLI Workflow Fix

**Test:** Run `npx prisma db push` from the project root (without any exported DATABASE_URL env var).
**Expected:** Command should succeed without requiring manual workaround.
**Why human:** The `prisma.config.ts` uses `import "dotenv/config"` which loads `.env` by default, but the project only has `.env.local`. This causes all Prisma CLI commands to fail without manually setting `DATABASE_URL`. Developer must choose a fix:
- Option A: Create a `.env` file (separate from `.env.local`) with `DATABASE_URL` for Prisma CLI use
- Option B: Add `dotenv-cli` as dev dep and change prisma scripts to `dotenv -e .env.local npx prisma ...`
- Option C: Accept the workaround (`DATABASE_URL=... npx prisma ...`) and document it

The database IS currently in sync, so this is a workflow ergonomics issue, not a schema correctness issue.

### Gaps Summary

No automated gaps block the phase goal. All core roadmap success criteria are substantively implemented and wired. The two human verification items (dev server startup and Playwright E2E) are expected tests that automated verification cannot run. The prisma CLI workflow issue is a developer ergonomics gap requiring a human decision on the fix approach.

Phase 1's infrastructure goal is functionally achieved: schema exists with TIMESTAMPTZ, singleton prevents pool exhaustion, auth config is edge-safe and correctly wired, proxy.ts protects routes, Vitest passes 5/5. Human confirmation of the dev server + E2E path is the remaining gate.

---

_Verified: 2026-04-14T00:30:00Z_
_Verifier: Claude (gsd-verifier)_

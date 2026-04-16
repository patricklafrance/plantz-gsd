# Project Research Summary

**Project:** Plant Minder
**Domain:** Indoor plant care and watering tracking web app
**Researched:** 2026-04-13
**Confidence:** HIGH

## Executive Summary

Plant Minder is a personal care-tracking web app in a market dominated by native mobile apps with paywalled core features. The central product insight from research: no major competitor is a web app, and every major competitor (Greg, Planta, Vera) gates reminders or key features behind payment. A fully functional, free, web-first app with an urgency-first dashboard addresses the most common complaints across app store reviews.

The technical approach is conventional and well-documented — Next.js 16 App Router with React Server Components for data fetching, Server Actions for mutations, Prisma + PostgreSQL for persistence, and NextAuth v5 for credentials-based auth. The architecture follows a server-first model: RSC pages fetch data directly from the database through a typed query layer, client components are limited to interactive islands (watering log button, forms, modals), and all mutations go through Server Actions with Zod validation. No separate API layer is needed.

The highest-risk areas are not architectural complexity but operational correctness: timezone-naive date storage will silently break overdue calculations; NextAuth credentials provider requires explicit JWT session strategy; and Next.js App Router cache requires explicit `revalidatePath()` calls in every Server Action or the dashboard shows stale data. These are all day-one decisions — retrofitting them is expensive.

## Key Findings

### Recommended Stack

The stack is constrained by PROJECT.md and research confirms all choices are sound for April 2026. Next.js 16.2.2 LTS is the correct target — it ships with React 19.2, uses Turbopack as the stable bundler, and replaces `middleware.ts` with `proxy.ts`. Tailwind CSS v4 (CSS-first config, no `tailwind.config.js`) and shadcn/ui have full mutual support since February 2025. Prisma 7 dropped its Rust binary for faster cold starts. NextAuth v5 beta is the only valid choice for App Router. Zod v4 uses `zod/v4` import path (not the default `zod` import).

**Core technologies:**
- Next.js 16.2.2 LTS: full-stack framework with App Router, Turbopack default
- TypeScript 6.0: stable March 2026, greenfield target
- Tailwind CSS v4: CSS-first config via `@theme`, no `tailwind.config.js`
- shadcn/ui: copy-paste components on Radix primitives, full v4 + React 19 support
- Prisma 7.7.0: schema-first ORM, Rust-free, TypedSQL for typed raw queries
- PostgreSQL 17: interval arithmetic, JSONB flexibility
- NextAuth v5 beta: credentials provider with JWT strategy (only viable App Router option)
- Zod v4 (`zod/v4` import path): 14x faster parsing vs v3
- date-fns v4: watering countdown math (`differenceInDays`, `addDays`, `isAfter`)
- Vitest 4.1.4 + Playwright 1.59.1: unit and E2E testing

### Expected Features

Research covered 10+ live competitor apps (Greg, Planta, Vera, Gardenia, Plant Daddy).

**Must have (table stakes):**
- Plant collection (add/edit/archive/delete) — root of the dependency graph
- Per-plant watering interval with automatic next-due recalculation
- Urgency-first dashboard (overdue / due today / upcoming / recently watered)
- One-tap watering log from dashboard (1-2 taps max)
- Watering history per plant
- In-app reminder center
- Seeded plant catalog (~30-50 common houseplants)
- User auth (email/password)
- Mobile-responsive UI

**Should have (competitive advantage):**
- Room-based organization with presets
- Guest/demo mode with real sample data — no competitor has this
- Timestamped health notes
- Minimal onboarding (< 2 minutes to first value)
- Calm, guilt-free language
- Retroactive watering log support
- Seasonal snooze
- Accessible by default (WCAG AA)

**Defer (v2+):**
- AI plant identification via photo
- Weather-aware scheduling
- Social/community features — competitor users explicitly complained about these
- Native mobile app

### Architecture Approach

Server-first monolith: RSC pages fetch data directly from Postgres via Prisma; Client Components handle only interactive islands. Server Actions replace API routes for all mutations. Route groups separate public, auth, and authenticated app. Watering schedule logic lives as pure functions separated from DB and view layers.

**Major components:**
1. `proxy.ts` (middleware) — session gate; redirects unauthenticated users
2. Route groups `(public)/(auth)/(app)` — separate layout trees
3. React Server Components — async data fetching directly from `lib/queries/`
4. Server Actions (`features/*/actions.ts`) — all mutations with Zod validation + `revalidatePath()`
5. Data Access Layer (`lib/queries/`) — typed, centralized DB reads
6. `features/watering/schedule.ts` — pure domain logic: `nextWateringDate()`, `isOverdue()`, `urgencyCategory()`
7. `lib/db.ts` — Prisma singleton; prevents connection pool exhaustion
8. PostgreSQL + Prisma schema — `TIMESTAMPTZ` everywhere; composite index on `(plantId, wateredAt DESC)`

### Critical Pitfalls

1. **Timezone-naive date storage** — store all timestamps as `TIMESTAMPTZ` from day one; compute "due today" from user's local date, not server `new Date()`
2. **NextAuth credentials + database sessions** — explicitly set `session: { strategy: "jwt" }`; default causes `getServerSession()` to return null
3. **Stale dashboard after watering** — every Server Action must call `revalidatePath()` on affected routes; App Router caches aggressively
4. **Prisma connection pool exhaustion** — use global singleton pattern in `lib/db.ts` from first commit
5. **Demo mode data bleed (IDOR)** — verify `session.user.id === plant.userId` on every mutation; demo sessions must be isolated from user tables
6. **Retroactive logs break schedules** — use `MAX(wateredAt)` not `MAX(loggedAt)` for schedule recalculation; debounce log button 3-5 seconds

## Implications for Roadmap

### Phase 0: Scaffold and Foundations
**Rationale:** Prisma-generated types, auth config, DB singleton, and middleware gate are hard dependencies for everything. These are "never retrofit" decisions.
**Delivers:** Working Next.js 16 project; Prisma schema with `TIMESTAMPTZ`; `lib/db.ts` singleton; NextAuth v5 with JWT strategy; `proxy.ts` middleware; route group scaffolding; Zod setup; Vitest + Playwright configured.
**Avoids:** Connection pool exhaustion, silent session failures, timezone bugs in production data.

### Phase 1: Authentication and User Accounts
**Rationale:** Every feature requires a working session. Ownership check pattern established here.
**Delivers:** Login, register, onboarding (2-3 screens), session persistence, protected route gate.
**Avoids:** Pitfall — NextAuth credentials JWT constraint.

### Phase 2: Plant Collection and Catalog
**Rationale:** Plant entity is root of dependency graph. Dashboard has nothing to compute without plants.
**Delivers:** Add/edit/archive/delete plants; plant detail page; room organization with presets; seeded catalog (~30-50 species); care profile defaults.

### Phase 3: Dashboard and Watering Core Loop
**Rationale:** The urgency-first dashboard + one-tap log IS the product. Highest complexity phase.
**Delivers:** Urgency-first dashboard; one-tap watering log; automatic next-due recalculation; watering history; retroactive log support; debounced log button with undo toast.
**Avoids:** Stale dashboard (revalidatePath), retroactive log schedule bugs, N+1 queries.

### Phase 4: Reminders and Notification Center
**Rationale:** Depends on watering schedule logic (Phase 3) and plant collection (Phase 2). Derived state — no external service needed.
**Delivers:** In-app notification center; per-plant reminder preferences; dashboard badge count.

### Phase 5: Demo Mode and Public Landing
**Rationale:** Requires working catalog and dashboard. Differentiator — no competitor has this.
**Delivers:** Guest/demo mode with pre-loaded sample plants; ephemeral session; public landing page; "Sign up to save" conversion prompt.
**Avoids:** Demo data bleed (IDOR) — tested explicitly.

### Phase 6: Polish, Accessibility, and Quality
**Rationale:** WCAG AA and guilt-free copy are explicit product features, not afterthoughts.
**Delivers:** Full keyboard navigation; WCAG AA contrast; screen reader labels; mobile touch audit; load test with 100 plants; seasonal snooze; copy/tone audit.

### Phase Ordering Rationale

- Scaffold before auth, auth before features — Prisma types and `session.user.id` are hard dependencies
- Plant collection before dashboard — dashboard has nothing to compute without plants
- Dashboard phase is largest and highest risk — give it the most planning and test coverage
- Demo mode last among features — depends on catalog, working dashboard, and proven auth boundary
- Polish phase is explicit — accessibility and tone are product features in this app's positioning

### Research Flags

**Phases needing deeper research:**
- **Phase 3:** Next.js 16 caching behavior (`revalidatePath` vs `revalidateTag` vs `updateTag`) — recommend `/gsd-research-phase` before implementation
- **Phase 1:** NextAuth v5 beta configuration — validate against current Auth.js v5 docs

**Phases with standard patterns (skip research):**
- Phase 0: `create-next-app` + Prisma init + singleton — copy-paste documented
- Phase 2: Standard CRUD with Server Actions against Prisma
- Phase 4: Read-only RSC query derived from watering schedule
- Phase 5: Design decision, not technical unknown
- Phase 6: Standard WCAG testing tooling (axe-core, Playwright accessibility)

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified against official sources and npm as of April 2026 |
| Features | HIGH | Competitive analysis of 10+ live apps with user review data |
| Architecture | HIGH | Based on Next.js 16 and Prisma official docs |
| Pitfalls | HIGH | Documented bugs with official GitHub issues and blog posts |

**Overall confidence:** HIGH

### Gaps to Address

- **NextAuth v5 beta stability:** Pin version in `package.json` and test after any upgrade
- **"Due today" timezone UX:** Decide pattern during Phase 3 planning — pass user's local date via URL param, header, or compute client-side
- **Prisma connection strategy:** Serverless (Vercel) requires `connection_limit=1` or PgBouncer/Prisma Accelerate — confirm before Phase 0

## Sources

### Primary (HIGH confidence)
- Next.js 16 official docs and release blog — version, App Router patterns, proxy.ts, caching
- Prisma ORM official docs and v7 announcement — Rust-free rewrite, TypedSQL
- shadcn/ui official Tailwind v4 docs — compatibility confirmed
- Auth.js v5 migration guide — credentials provider JWT strategy requirement
- Zod v4 official release notes — `zod/v4` import path
- NextAuth GitHub issues #12858, #3970 — database session + credentials incompatibility

### Secondary (MEDIUM confidence)
- Competitor app reviews (Greg, Planta, Vera, Gardenia, Plant Daddy) — feature landscape, user complaints
- DEV Community: Next.js App Router patterns 2026 — project structure
- PostgreSQL timestamp best practices — TIMESTAMPTZ rationale

---
*Research completed: 2026-04-13*
*Ready for roadmap: yes*

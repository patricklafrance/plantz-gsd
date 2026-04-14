# Stack Research

**Domain:** Indoor plant care tracking web app
**Researched:** 2026-04-13
**Confidence:** HIGH (core stack is fixed by PROJECT.md constraints; versions verified against official sources and npm)

## Context Note

The core stack for this project is **not a recommendation — it is a constraint** (see PROJECT.md). Next.js + TypeScript + Prisma + PostgreSQL + NextAuth.js + Tailwind + shadcn/ui + Zod + Vitest + Playwright are fixed decisions. This research verifies current versions, surfaces version-specific gotchas, recommends supporting libraries, and flags what NOT to use alongside this stack.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Next.js | **16.2.2 LTS** (current as of April 2026) | Full-stack React framework, App Router | 16.x is the current LTS. Turbopack is now the default bundler (stable). Breaking changes from 15: async params/searchParams, middleware renamed to proxy.ts, `use cache` directive replaces implicit caching. New project should target 16 directly to avoid a mid-build migration. |
| React | **19.2** (bundled with Next.js 16) | UI rendering | Ships with Next.js 16. View Transitions, useEffectEvent, Activity component available. |
| TypeScript | **6.0** (stable March 2026) | Type safety | TS 6 is the stable release as of project start. Next.js 16 requires TS 5.1+, so 6.0 works. Last JS-based TypeScript release before Go rewrite in 7.0. No breaking changes that affect a greenfield project. |
| Tailwind CSS | **4.x** (v4.0 stable since Jan 2025) | Utility-first styling | v4 is a major rewrite: CSS-first config (`@theme` directive), no `tailwind.config.js`, automatic content detection, Lightning CSS engine. shadcn/ui has full v4 support since February 2025 with OKLCH color system. New project should use v4 only. |
| shadcn/ui | **latest CLI** (March 2025 updated for v4) | Component library | Copy-paste components using Radix primitives. Full Tailwind v4 + React 19 support. Components now have `data-slot` attributes for granular styling. Not a versioned npm package — CLI pulls latest components. |
| Prisma ORM | **7.7.0** (current as of April 2026) | Database ORM | v7 is Rust-free; client rebuilt in TypeScript for faster cold starts and smaller Docker images. TypedSQL for raw queries with generated types. Production-ready for PostgreSQL. Requires `@prisma/adapter-pg` for serverless/edge environments. |
| PostgreSQL | **17.x** | Relational database | Interval-based watering math is trivial in SQL. Date arithmetic, timezone support, and JSONB for flexible care profile data are first-class. |
| NextAuth.js (Auth.js) | **5.0.0-beta.30** (`next-auth@beta`) | Authentication | v5 remains in beta but is actively used in production with Next.js 15/16. Stable v4 (4.24.13) does NOT support App Router natively. For an App Router project on Next.js 16, v5 beta is the correct choice — v4 is dead-end for this stack. Credentials provider (email/password) is fully functional in v5. |
| Zod | **4.x** (`zod/v4` import path) | Schema validation | v4 stable (2025): 14x faster string parsing, 7x faster array parsing vs v3. ~20M weekly downloads. New import path `zod/v4` for v4 schemas alongside v3 compat. `@zod/mini` available for bundle-sensitive code. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `react-hook-form` | **7.72.x** | Form state management | All forms (plant add/edit, onboarding, auth). Pairs with `@hookform/resolvers` + Zod. Minimal re-renders, uncontrolled components, no external state manager needed. shadcn/ui's form primitives are built for this. |
| `@hookform/resolvers` | **^3.x** | Zod integration for react-hook-form | Required to connect Zod schemas to RHF's `useForm`. |
| `date-fns` | **^4.x** | Date arithmetic | Watering countdown math: `differenceInDays`, `addDays`, `isAfter`. Functional, tree-shakable, no timezone complexity needed for local date comparisons. Choose date-fns over dayjs because the Next.js + Prisma ecosystem examples predominantly use it and it has better TypeScript types. |
| `@prisma/adapter-pg` | **^7.x** | Prisma PostgreSQL adapter | Required for production PostgreSQL connections, especially if deploying on Vercel (serverless). |
| `lucide-react` | **latest** | Icon set | shadcn/ui ships with Lucide as its icon system. Consistent, tree-shakable SVG icons for plant types, water drops, alerts. |
| `clsx` + `tailwind-merge` | **latest** | Conditional className utility | Standard shadcn/ui pattern: `cn()` helper merges Tailwind classes without specificity conflicts. Ships with every shadcn/ui project. |
| `@tanstack/react-virtual` | **^3.x** | List virtualization | Only needed if supporting 100+ plant collections (identified edge case in PROJECT.md). Defer until performance testing shows it's needed. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vitest | **4.1.4** — Unit and integration tests | Requires Vite >= 6, Node >= 20. Browser Mode is now stable in v4. Replaces Jest entirely for this stack. |
| `@playwright/test` | **1.59.1** — E2E tests | Stable current version. Used for critical user flows: login, add plant, log watering, dashboard display. |
| ESLint | **9.x** (flat config) | Linting | Next.js 16 removed `next lint` command — run ESLint directly. The `@next/eslint-plugin-next` now defaults to flat config format. |
| Prettier | **^3.x** | Code formatting | Standard companion to ESLint for consistent formatting. |
| `prisma` CLI | **7.7.0** | Database migrations, schema management | `npx prisma migrate dev` for local, `prisma migrate deploy` for production. |

---

## Installation

```bash
# Bootstrap (Next.js 16 with App Router, TypeScript, Tailwind v4, ESLint)
npx create-next-app@latest plant-minder \
  --typescript \
  --tailwind \
  --app \
  --src-dir \
  --import-alias "@/*"

# Database (Prisma v7 + PostgreSQL adapter)
npm install prisma @prisma/client @prisma/adapter-pg
npx prisma init

# Auth (v5 beta — required for App Router)
npm install next-auth@beta

# Validation
npm install zod

# Forms
npm install react-hook-form @hookform/resolvers

# Date arithmetic
npm install date-fns

# shadcn/ui (initializes components and installs Radix, clsx, tailwind-merge, lucide)
npx shadcn@latest init

# Testing (dev)
npm install -D vitest @vitest/ui @playwright/test
npx playwright install
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Next.js 16 App Router | Next.js 15 (Pages Router) | Never — Pages Router is legacy. App Router is the only forward path. |
| Prisma 7 | Drizzle ORM | Drizzle if you want raw SQL control and zero magic. Prisma wins for convention-heavy apps where schema-first with migrations is preferred. Drizzle is slightly better at edge/serverless cold starts, but Prisma 7 closed that gap significantly. |
| NextAuth v5 beta | Clerk | Clerk if you want zero auth implementation work and don't mind vendor lock-in + per-MAU cost. PROJECT.md explicitly chose NextAuth for full control and no OAuth requirement. |
| date-fns | dayjs | dayjs if bundle size is critical (6KB vs ~30KB). date-fns has better TypeScript types and better shadcn/ui ecosystem alignment. |
| Vitest | Jest | Never for this stack. Jest requires extra config for ESM/TypeScript. Vitest is the standard for Vite-based tooling, and this project uses the same Vite-compatible toolchain. |
| shadcn/ui | Mantine, Chakra UI, Ant Design | Those libraries if you need prebuilt, fully managed components. shadcn/ui gives copy-paste ownership, which is critical for a design-specific app like this. |
| Tailwind CSS v4 | Tailwind CSS v3 | v3 only if migrating an existing v3 project. Greenfield must use v4 — shadcn/ui's new components target v4 defaults (OKLCH colors). |
| PostgreSQL | SQLite (via Turso) | SQLite + Turso if this were a hobby project with zero infra ops. PostgreSQL is correct for this app's data relationships and date arithmetic needs. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| NextAuth v4 (`next-auth@latest` stable) | Does NOT support App Router natively. Sessions and callbacks are designed for Pages Router. Breaks route handlers and server components pattern. | `next-auth@beta` (v5) |
| Moment.js | Deprecated since 2020, mutable, no tree-shaking, 67KB bundle. | date-fns |
| Next.js Pages Router (`/pages/`) | Legacy routing model. App Router is the current standard and where all Next.js 16 features land. | App Router (`/app/`) |
| Redux / Zustand for server state | Over-engineered for this app. Prisma + Server Actions handle server state. React context for UI state (theme, open panels) is sufficient. | React context for UI state, Server Actions for mutations |
| `middleware.ts` (deprecated in Next.js 16) | Renamed to `proxy.ts` in Next.js 16. `middleware.ts` still works but is deprecated and will be removed. | `proxy.ts` for route protection and redirects |
| `tailwind.config.js` (Tailwind v3 pattern) | Not supported in Tailwind v4. All configuration moves to `@theme` in CSS. | CSS-first `@theme` directive |
| Zod v3 (`import { z } from "zod"`) | v4 is available at `zod/v4`. v3 compat import still works but misses 14x performance improvements and new features. | `import { z } from "zod/v4"` |
| Photo upload infrastructure (S3, Cloudinary) | Explicitly out of scope per PROJECT.md. Placeholder icons cover v1. | Plant icons from Lucide or emoji |
| Email/push notification services (Resend, SendGrid) | Explicitly out of scope per PROJECT.md. In-app reminder center only. | DB-stored reminders, queried on dashboard load |

---

## Stack Patterns by Variant

**For server-side data fetching (dashboard, plant detail):**
- Use Server Components with direct Prisma queries
- No API layer needed for read operations
- Because: App Router Server Components make REST endpoints unnecessary for internal data

**For mutations (log watering, add plant, update settings):**
- Use Server Actions with Zod validation + Prisma writes
- Because: Server Actions are type-safe, eliminate API boilerplate, and integrate with RHF's `action` prop

**For auth-protected routes:**
- Use `proxy.ts` (Next.js 16) with NextAuth session check
- Because: `middleware.ts` is deprecated in Next.js 16; `proxy.ts` is the replacement

**For the urgency-first dashboard:**
- Compute watering status (overdue, due today, upcoming, recently watered) server-side in the Server Component
- Pass pre-sorted data to client components for display
- Because: Date arithmetic in SQL/Prisma is faster than client-side JS, and avoids hydration mismatches with date rendering

**For guest/demo mode:**
- Seed a demo user in the database with sample plants + watering history
- Use a session cookie for guest state, converting on sign-up
- Because: Avoids in-memory demo state that breaks on page refresh

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `next@16.x` | `react@19.2`, `react-dom@19.2` | React 19.2 ships with Next.js 16; install via `npm install next@latest react@latest react-dom@latest` |
| `next-auth@beta` (v5) | `next@14+`, `next@15`, `next@16` | v5 is confirmed working with Next.js 16 in community guides as of 2026 |
| `prisma@7.x` | Node.js >= 18, PostgreSQL 12-17 | Prisma 7 dropped Rust binary; significantly faster cold starts |
| `vitest@4.x` | `vite@6+`, Node.js >= 20 | Node 20 is the minimum for Next.js 16 anyway; no conflict |
| `tailwindcss@4.x` | `shadcn/ui` (Feb 2025+ CLI) | shadcn/ui CLI v4 support confirmed; run `npx shadcn@latest init` for v4-compatible setup |
| `zod/v4` | Any TypeScript project | Import as `zod/v4` subpath; v3 compat path remains available but not recommended for new code |
| `typescript@6.0` | `next@16` (requires TS 5.1+) | TS 6 satisfies Next.js 16's minimum requirement; greenfield should use 6.0 |

---

## Sources

- [Next.js 16 release blog](https://nextjs.org/blog/next-16) — Version confirmed stable October 2025; 16.2.2 LTS as of April 2026 (HIGH confidence, official source)
- [Next.js 16.1 blog](https://nextjs.org/blog/next-16-1) — Minor release details
- [Prisma 7 release announcement](https://www.prisma.io/blog/announcing-prisma-orm-7-0-0) — Rust-free rewrite confirmed stable November 2025; 7.7.0 current (HIGH confidence, official source)
- [Prisma 7.2.0 release](https://www.prisma.io/blog/announcing-prisma-orm-7-2-0) — CLI improvements
- [shadcn/ui Tailwind v4 docs](https://ui.shadcn.com/docs/tailwind-v4) — Full v4 + React 19 support confirmed (HIGH confidence, official source)
- [shadcn/ui February 2025 changelog](https://ui.shadcn.com/docs/changelog/2025-02-tailwind-v4) — v4 migration details
- [Tailwind CSS v4.0 release blog](https://tailwindcss.com/blog/tailwindcss-v4) — Stable January 22, 2025 (HIGH confidence, official source)
- [Auth.js v5 migration guide](https://authjs.dev/getting-started/migrating-to-v5) — Confirmed beta production use with App Router (MEDIUM confidence; beta tag is real)
- [next-auth npm page](https://www.npmjs.com/package/next-auth) — v4.24.13 stable, v5.0.0-beta.30 beta (HIGH confidence, npm)
- [Zod v4 release notes](https://zod.dev/v4) — Stable release 2025, `zod/v4` import path (HIGH confidence, official source)
- [Vitest 4.0 announcement](https://voidzero.dev/posts/announcing-vitest-4) — Browser Mode stable, October 2025; current 4.1.4 (HIGH confidence)
- [Playwright npm](https://www.npmjs.com/package/@playwright/test) — 1.59.1 current stable (HIGH confidence, npm)
- [TypeScript 6.0 announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/) — Stable March 2026 (HIGH confidence, official source)
- [react-hook-form GitHub releases](https://github.com/react-hook-form/react-hook-form/releases) — 7.72.x current (HIGH confidence)

---

*Stack research for: Plant Minder (indoor plant care tracking web app)*
*Researched: 2026-04-13*

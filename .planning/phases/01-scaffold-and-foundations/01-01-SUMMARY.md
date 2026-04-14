---
phase: 01-scaffold-and-foundations
plan: 01
subsystem: foundation
tags: [next.js, prisma, tailwind, shadcn, scaffold]
dependency_graph:
  requires: []
  provides:
    - next.js-16-project
    - prisma-7-schema
    - db-singleton
    - tailwind-v4-design-tokens
    - shadcn-ui-components
  affects:
    - all subsequent phases
tech_stack:
  added:
    - next@16.2.2
    - react@19.2
    - typescript@5.x
    - tailwindcss@4.x
    - prisma@7.7.0
    - "@prisma/client@7.7.0"
    - "@prisma/adapter-pg@7.7.0"
    - next-auth@beta (v5.0.0-beta.30)
    - bcryptjs@3.x
    - zod@4.x
    - react-hook-form@7.x
    - "@hookform/resolvers@3.x"
    - date-fns@4.x
    - shadcn/ui (components: button, card, input, label, separator, skeleton, badge)
    - lucide-react
    - clsx + tailwind-merge
  patterns:
    - Prisma 7 schema-less datasource URL (managed via prisma.config.ts)
    - globalThis-pinned PrismaClient singleton with @prisma/adapter-pg
    - Tailwind v4 CSS-first @theme directive (no tailwind.config.js)
    - Next.js App Router with src-dir layout (src/app/)
    - Route groups: (auth) and (main) per D-03
key_files:
  created:
    - prisma/schema.prisma
    - prisma.config.ts
    - src/lib/db.ts
    - src/lib/utils.ts
    - src/app/globals.css
    - src/app/layout.tsx
    - src/app/page.tsx
    - src/app/(auth)/layout.tsx
    - src/app/(auth)/login/page.tsx
    - src/app/(auth)/register/page.tsx
    - src/app/(main)/layout.tsx
    - src/app/(main)/dashboard/page.tsx
    - src/app/(main)/plants/page.tsx
    - src/components/ui/button.tsx
    - src/components/ui/card.tsx
    - src/components/ui/input.tsx
    - src/components/ui/label.tsx
    - src/components/ui/separator.tsx
    - src/components/ui/skeleton.tsx
    - src/components/ui/badge.tsx
    - components.json
    - .env.example
    - .gitignore
  modified:
    - next.config.ts
    - package.json
    - tsconfig.json
decisions:
  - "Prisma 7 removed url from datasource schema — connection string managed via prisma.config.ts"
  - "serverExternalPackages is top-level config in Next.js 16 (not under experimental)"
  - "shadcn/ui initialized with base-nova style and neutral base color (--defaults flag)"
  - "app/generated/prisma gitignored — generated client not committed"
metrics:
  duration_seconds: 574
  completed_date: "2026-04-14"
  tasks_completed: 3
  files_created: 24
---

# Phase 1 Plan 1: Scaffold and Foundations Summary

**One-liner:** Next.js 16.2.2 bootstrapped with Prisma 7 TIMESTAMPTZ schema, PrismaPg singleton, Tailwind v4 OKLCH design tokens, and shadcn/ui component scaffold.

## What Was Built

A complete project foundation that all 7 phases build on:

1. **Next.js 16.2.2 with App Router** — TypeScript, Tailwind v4, ESLint, src-dir layout. All production dependencies pinned per CLAUDE.md stack spec.

2. **Prisma 7 schema** — 7 entities (User, Room, Plant, WateringLog, HealthLog, CareProfile, Reminder) with `@db.Timestamptz(3)` on every `DateTime` column. Generated client at `app/generated/prisma/` (gitignored). Datasource URL managed via `prisma.config.ts` (Prisma 7 breaking change).

3. **db singleton** (`src/lib/db.ts`) — globalThis-pinned `PrismaClient` using `@prisma/adapter-pg` to prevent connection pool exhaustion during hot reload.

4. **Tailwind v4 design tokens** — OKLCH color system, spacing scale, and dark mode via `@theme` directive in `globals.css`. No `tailwind.config.js`.

5. **Route group layouts** — `(auth)` and `(main)` route groups with placeholder pages for login, register, dashboard, plants.

6. **shadcn/ui scaffold** — Initialized with Zinc/neutral base, CSS variables. Initial components installed: button, card, input, label, separator, skeleton, badge.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Prisma 7 removed `url` from datasource schema**
- **Found during:** Task 2 (prisma validate)
- **Issue:** Prisma 7.x removed `url = env("DATABASE_URL")` from schema `datasource` block. Connection URL now managed exclusively via `prisma.config.ts`.
- **Fix:** Removed `url` line from `datasource db {}` block in `prisma/schema.prisma`.
- **Files modified:** `prisma/schema.prisma`
- **Commit:** 6fd2ac0

**2. [Rule 1 - Bug] `serverExternalPackages` is not under `experimental` in Next.js 16**
- **Found during:** Task 3 (next build)
- **Issue:** Build failed with TypeScript error: `'serverExternalPackages' does not exist in type 'ExperimentalConfig'`. In Next.js 16, `serverExternalPackages` is a top-level `NextConfig` property.
- **Fix:** Moved `serverExternalPackages` from `experimental: {}` to top-level config.
- **Files modified:** `next.config.ts`
- **Commit:** 2518d77

**3. [Rule 2 - Missing Critical Functionality] Added shadcn/ui initialization per UI-SPEC**
- **Found during:** Task 3 review of `01-UI-SPEC.md`
- **Issue:** UI-SPEC states "Phase 1 must run `npx shadcn@latest init`" and "Confirm `components.json` exists in the project root before the phase is considered complete." The plan's 3 tasks did not explicitly include this step.
- **Fix:** Ran `npx shadcn@latest init --defaults` and installed initial components (button, card, input, label, separator, skeleton, badge) per Registry Safety section of UI-SPEC.
- **Files modified:** `globals.css`, `layout.tsx`, `src/lib/utils.ts`, `components.json`, all component files
- **Commit:** 2518d77, 58abfd4

## Verification Results

- `npx prisma validate` exits 0
- `app/generated/prisma/` directory exists with generated client
- `npx next build` completes without errors (Turbopack, Next.js 16.2.2)
- All directories from D-01 through D-04 exist
- All 7 Prisma models have `@db.Timestamptz(3)` on every DateTime column
- `components.json` exists in project root
- 8 shadcn/ui primitive components available for Phase 2

## Known Stubs

The following placeholder pages exist intentionally — they will be implemented by subsequent phases:

| File | Stub | Resolved In |
|------|------|-------------|
| `src/app/(auth)/login/page.tsx` | Returns `<h1>Login</h1>` | Phase 2 |
| `src/app/(auth)/register/page.tsx` | Returns `<h1>Register</h1>` | Phase 2 |
| `src/app/(main)/dashboard/page.tsx` | Returns `<h1>Dashboard</h1>` | Phase 4 |
| `src/app/(main)/plants/page.tsx` | Returns `<h1>Plants</h1>` | Phase 3 |

These stubs are intentional per the plan — they exist to validate route groups are wired correctly, not to deliver user-facing UI.

## Self-Check: PASSED

Files verified:
- FOUND: prisma/schema.prisma
- FOUND: src/lib/db.ts
- FOUND: src/app/globals.css
- FOUND: src/app/layout.tsx
- FOUND: src/app/(auth)/layout.tsx
- FOUND: src/app/(main)/layout.tsx
- FOUND: components.json
- FOUND: app/generated/prisma/client.ts

Commits verified:
- FOUND: 402bec5 (bootstrap)
- FOUND: 6fd2ac0 (Prisma schema)
- FOUND: 2518d77 (shadcn init)
- FOUND: 58abfd4 (design tokens + components)

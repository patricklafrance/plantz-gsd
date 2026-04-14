# Phase 1: Scaffold and Foundations - Research

**Researched:** 2026-04-13
**Domain:** Next.js 16 + Prisma 7 + NextAuth v5 + Vitest 4 + Playwright 1.59 — greenfield project scaffold
**Confidence:** HIGH (all major stack choices verified against official docs and live sources)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** `src/` directory alongside `app/` — `app/` contains routes only, all shared code lives in `src/components/`, `src/lib/`, `src/hooks/`

**D-02:** Feature-based component grouping — `src/components/plants/`, `src/components/dashboard/`, `src/components/auth/`, plus `src/components/ui/` for shadcn/ui primitives

**D-03:** Route groups separate auth from main app — `app/(auth)/login`, `app/(auth)/register` for public auth pages; `app/(main)/dashboard`, `app/(main)/plants` for protected pages, each group with its own layout

**D-04:** Server-side code co-located by feature — `src/features/plants/actions.ts`, `src/features/plants/queries.ts`, `src/features/plants/schema.ts` (each domain owns its server logic, queries, and Zod schemas)

### Claude's Discretion

- Database schema scope — how much of the full data model to define in Phase 1 vs later phases
- Auth & route protection details — proxy.ts configuration, session strategy, protected route patterns
- Dev environment setup — Docker Compose vs local PostgreSQL, seed script approach
- Path aliases, barrel export conventions, naming patterns
- Test harness configuration details (Vitest + Playwright setup)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

## Summary

Phase 1 establishes the unretrofittable foundation: a working Next.js 16 App Router project with the correct Prisma 7 schema (including TIMESTAMPTZ), a singleton db client, NextAuth v5 credentials/JWT auth wired to proxy.ts route protection, and passing Vitest + Playwright test harnesses.

The most significant non-obvious fact in this stack is that Prisma 7 mandates driver adapters — you **cannot** use `new PrismaClient()` without `@prisma/adapter-pg`. The client is generated to a custom path (`app/generated/prisma`) which requires a `serverExternalPackages` entry in `next.config.ts` to prevent Turbopack bundling errors. This is a day-one gotcha that breaks the dev server silently in some configurations.

The second important fact is that NextAuth v5's proxy.ts integration uses `export { auth as proxy }` — a named re-export pattern that satisfies Next.js 16's requirement for a named `proxy` export. The official Next.js learn course still shows older patterns; the Auth.js docs protecting guide has the canonical v16 pattern.

**Primary recommendation:** Scaffold with `create-next-app`, install and configure the full stack top-to-bottom before writing any application code — schema, adapter, auth, proxy.ts, test harness — in that order. Validate each layer before advancing.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.2.2 LTS | Framework, App Router, Turbopack | Pinned in CLAUDE.md; 16.x is current LTS as of Apr 2026 |
| react / react-dom | 19.2 | UI rendering | Ships with Next.js 16; do not install separately |
| typescript | 6.0 | Type safety | Stable Mar 2026; Next.js 16 requires TS 5.1+ |
| tailwindcss | 4.x | Utility-first CSS | CSS-first config via `@theme`; no tailwind.config.js |
| @prisma/client | 7.7.0 | Generated DB client | Pinned in CLAUDE.md; Rust-free, TypeScript client |
| prisma | 7.7.0 | CLI: migrate, generate, studio | Same version as client |
| @prisma/adapter-pg | ^7.x | PostgreSQL driver adapter | **Required** in Prisma 7; cannot use PrismaClient without it |
| pg | ^8.x | Node.js PostgreSQL driver | Required peer dep of @prisma/adapter-pg |
| next-auth | beta (v5.0.0-beta.30) | Auth: credentials + JWT sessions | v4 does not support App Router; v5 beta is production standard for Next.js 16 |
| bcryptjs | ^2.4.3 | Password hashing | Standard for credentials provider; use bcryptjs not bcrypt (native build issues in some envs) |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn/ui | latest CLI | Component primitives (Radix-based) | Run `npx shadcn@latest init` after Tailwind setup |
| lucide-react | latest | Icon set | Ships with shadcn/ui; plant, water, alert icons |
| clsx + tailwind-merge | latest | `cn()` className utility | Required by shadcn/ui; auto-installed by CLI |
| zod | 4.x | Schema validation | Import as `zod/v4`; used in auth.ts credentials validation |
| @hookform/resolvers | ^3.x | Zod + RHF bridge | Install now even if forms come later |
| react-hook-form | 7.72.x | Form state | Install now even if forms come in Phase 2 |
| date-fns | ^4.x | Date arithmetic | Install now; used in Phase 4 watering countdown |
| vite-tsconfig-paths | latest | Path alias resolution in Vitest | Required for `@/` imports to work in tests |

### Development Tools

| Tool | Version | Purpose |
|------|---------|---------|
| vitest | 4.1.4 | Unit + integration tests |
| @vitejs/plugin-react | latest | React support for Vitest |
| @testing-library/react | latest | Component testing utilities |
| @testing-library/dom | latest | DOM query utilities |
| jsdom | latest | Browser-like test environment |
| @playwright/test | 1.59.1 | E2E tests |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| bcryptjs | bcrypt | bcrypt requires native build tooling; bcryptjs is pure JS, easier CI/CD |
| `app/generated/prisma` output | default `@prisma/client` output | Default output avoids serverExternalPackages config but custom path gives clearer separation |

### Installation

```bash
# Bootstrap
npx create-next-app@latest plantz --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"

# Database (Prisma v7 + PostgreSQL adapter)
npm install prisma@7.7.0 @prisma/client@7.7.0 @prisma/adapter-pg pg
npm install -D prisma@7.7.0

# Auth (v5 beta)
npm install next-auth@beta bcryptjs
npm install -D @types/bcryptjs

# Validation + Forms
npm install zod@latest react-hook-form @hookform/resolvers

# Date utilities
npm install date-fns

# shadcn/ui (after Tailwind is configured)
npx shadcn@latest init

# Testing
npm install -D vitest@4.1.4 @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom vite-tsconfig-paths
npx playwright install --with-deps chromium
```

---

## Architecture Patterns

### Recommended Project Structure

```
plantz/
├── app/
│   ├── (auth)/
│   │   ├── layout.tsx           # Public auth layout (no nav)
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (main)/
│   │   ├── layout.tsx           # Protected main layout (with nav)
│   │   ├── dashboard/page.tsx
│   │   └── plants/
│   │       ├── page.tsx
│   │       └── [id]/page.tsx
│   ├── api/auth/[...nextauth]/route.ts  # NextAuth v5 route handler
│   ├── generated/prisma/               # Prisma 7 generated client output
│   ├── globals.css                     # Tailwind v4 @theme directive
│   └── layout.tsx                      # Root layout
├── src/
│   ├── components/
│   │   ├── ui/                   # shadcn/ui primitives
│   │   ├── auth/                 # Login form, etc. (Phase 2)
│   │   ├── plants/               # Plant cards, lists (Phase 3+)
│   │   └── dashboard/            # Dashboard sections (Phase 4+)
│   ├── features/
│   │   ├── plants/
│   │   │   ├── actions.ts        # Server Actions
│   │   │   ├── queries.ts        # Prisma read queries
│   │   │   └── schema.ts         # Zod schemas
│   │   └── auth/
│   │       ├── actions.ts
│   │       └── schema.ts
│   ├── lib/
│   │   └── db.ts                 # Prisma singleton (CRITICAL)
│   └── hooks/                    # Client-side hooks
├── prisma/
│   └── schema.prisma             # Data model
├── tests/                        # Vitest unit tests
│   └── page.test.tsx
├── e2e/                          # Playwright E2E tests
│   └── smoke.spec.ts
├── auth.ts                       # NextAuth v5 main config (root level)
├── auth.config.ts                # NextAuth v5 edge-safe config (root level)
├── proxy.ts                      # Next.js 16 route protection (replaces middleware.ts)
├── vitest.config.mts             # Vitest config
├── playwright.config.ts          # Playwright config
├── next.config.ts                # Must include serverExternalPackages for Prisma 7
└── tsconfig.json                 # Must include paths for @/*
```

### Pattern 1: Prisma 7 Singleton with Driver Adapter

**What:** A globalThis-pinned PrismaClient instance using @prisma/adapter-pg. Prevents multiple connections during hot reload in dev and across serverless invocations.
**When to use:** Always — this is the only correct way to use Prisma 7.

```typescript
// Source: https://www.prisma.io/docs/guides/frameworks/nextjs
// src/lib/db.ts
import { PrismaClient } from "../../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = global as unknown as {
  prisma: PrismaClient;
};

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

export const db =
  globalForPrisma.prisma ||
  new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

### Pattern 2: Prisma 7 Schema with TIMESTAMPTZ

**What:** All timestamp columns annotated with `@db.Timestamptz(3)` to store UTC with timezone offset — required by WATR-07.
**When to use:** Every DateTime column in the schema.

```prisma
// Source: https://www.prisma.io/docs/orm/reference/prisma-schema-reference
// prisma/schema.prisma
generator client {
  provider = "prisma-client"
  output   = "../app/generated/prisma"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String        @id @default(cuid())
  email         String        @unique
  passwordHash  String
  name          String?
  createdAt     DateTime      @default(now()) @db.Timestamptz(3)
  updatedAt     DateTime      @updatedAt @db.Timestamptz(3)
  plants        Plant[]
  rooms         Room[]
  reminders     Reminder[]
}

model Room {
  id        String    @id @default(cuid())
  name      String
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  plants    Plant[]
  createdAt DateTime  @default(now()) @db.Timestamptz(3)
  updatedAt DateTime  @updatedAt @db.Timestamptz(3)
}

model Plant {
  id               String         @id @default(cuid())
  nickname         String
  species          String?
  roomId           String?
  room             Room?          @relation(fields: [roomId], references: [id])
  userId           String
  user             User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  wateringInterval Int            // days
  lastWateredAt    DateTime?      @db.Timestamptz(3)
  nextWateringAt   DateTime?      @db.Timestamptz(3)
  archivedAt       DateTime?      @db.Timestamptz(3)
  careProfileId    String?
  careProfile      CareProfile?   @relation(fields: [careProfileId], references: [id])
  wateringLogs     WateringLog[]
  healthLogs       HealthLog[]
  reminders        Reminder[]
  createdAt        DateTime       @default(now()) @db.Timestamptz(3)
  updatedAt        DateTime       @updatedAt @db.Timestamptz(3)
}

model WateringLog {
  id        String   @id @default(cuid())
  plantId   String
  plant     Plant    @relation(fields: [plantId], references: [id], onDelete: Cascade)
  wateredAt DateTime @db.Timestamptz(3)
  note      String?
  createdAt DateTime @default(now()) @db.Timestamptz(3)
}

model HealthLog {
  id          String   @id @default(cuid())
  plantId     String
  plant       Plant    @relation(fields: [plantId], references: [id], onDelete: Cascade)
  observation String
  severity    String?
  loggedAt    DateTime @db.Timestamptz(3)
  createdAt   DateTime @default(now()) @db.Timestamptz(3)
}

model CareProfile {
  id               String   @id @default(cuid())
  name             String   @unique
  species          String
  wateringInterval Int      // days - suggested default
  lightRequirement String?
  notes            String?
  plants           Plant[]
  createdAt        DateTime @default(now()) @db.Timestamptz(3)
}

model Reminder {
  id         String    @id @default(cuid())
  plantId    String
  plant      Plant     @relation(fields: [plantId], references: [id], onDelete: Cascade)
  userId     String
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  enabled    Boolean   @default(true)
  snoozedUntil DateTime? @db.Timestamptz(3)
  createdAt  DateTime  @default(now()) @db.Timestamptz(3)
  updatedAt  DateTime  @updatedAt @db.Timestamptz(3)
}
```

**Schema scope decision (Claude's discretion):** Define all 7 entities in Phase 1. The Prisma migration is foundational — adding new models in later phases requires new migration files and re-generation. Better to define the full model now (with nullable/optional fields for unimplemented features) than retrofit.

### Pattern 3: NextAuth v5 Split Config (auth.config.ts + auth.ts)

**What:** Two-file pattern required for edge compatibility. `auth.config.ts` is edge-safe (no Node.js APIs). `auth.ts` imports the config and adds the Credentials provider with bcrypt.
**When to use:** Required when using proxy.ts for route protection (proxy runs on edge).

```typescript
// Source: https://authjs.dev/getting-started/session-management/protecting
// auth.config.ts — edge-safe, no Node.js APIs
import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnMainApp = nextUrl.pathname.startsWith("/dashboard") ||
                          nextUrl.pathname.startsWith("/plants") ||
                          nextUrl.pathname.startsWith("/rooms");
      if (isOnMainApp) {
        return isLoggedIn;
      }
      // Redirect logged-in users away from auth pages
      if (isLoggedIn && (nextUrl.pathname === "/login" || nextUrl.pathname === "/register")) {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }
      return true;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
```

```typescript
// Source: https://nextjs.org/learn/dashboard-app/adding-authentication
// auth.ts — main config with Credentials provider (Node.js APIs allowed here)
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcryptjs from "bcryptjs";
import { z } from "zod/v4";
import { authConfig } from "./auth.config";
import { db } from "@/lib/db";

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = z
          .object({ email: z.string().email(), password: z.string().min(6) })
          .safeParse(credentials);

        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const user = await db.user.findUnique({ where: { email } });
        if (!user) return null;

        const passwordsMatch = await bcryptjs.compare(password, user.passwordHash);
        if (!passwordsMatch) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
});
```

### Pattern 4: proxy.ts Route Protection

**What:** Named `proxy` re-export from auth.ts — the idiomatic Next.js 16 pattern. The `authorized` callback in auth.config.ts handles redirect logic.
**When to use:** Always — `middleware.ts` is deprecated in Next.js 16.

```typescript
// Source: https://authjs.dev/getting-started/session-management/protecting
// proxy.ts — root level (same level as app/ and src/)
export { auth as proxy } from "@/auth";

export const config = {
  matcher: [
    // Protect all routes except: api, static files, auth pages, favicon
    "/((?!api|_next/static|_next/image|favicon.ico|login|register).*)",
  ],
};
```

### Pattern 5: next.config.ts for Prisma 7 + Turbopack

**What:** Required configuration to prevent Turbopack from bundling the Prisma client (which uses custom generated output path).
**When to use:** Always when using Prisma 7 with Next.js 16 Turbopack.

```typescript
// Source: https://github.com/vercel/next.js/issues/76497 + community guides
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverExternalPackages: ["@prisma/client", "pg"],
  },
};

export default nextConfig;
```

### Pattern 6: NextAuth v5 Route Handler

```typescript
// Source: https://authjs.dev/getting-started/installation
// app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/auth";
export const { GET, POST } = handlers;
```

### Pattern 7: Vitest Configuration

```typescript
// Source: https://nextjs.org/docs/app/guides/testing/vitest
// vitest.config.mts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
  },
});
```

### Pattern 8: Playwright Configuration

```typescript
// Source: https://nextjs.org/docs/pages/guides/testing/playwright
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: "http://localhost:3000",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
});
```

### Anti-Patterns to Avoid

- **`import { z } from "zod"`:** Imports Zod v3. Use `import { z } from "zod/v4"` for v4's 14x performance improvement.
- **`middleware.ts` with `export function middleware()`:** Deprecated in Next.js 16. Use `proxy.ts` with `export { auth as proxy }`.
- **`new PrismaClient()` without adapter:** Prisma 7 throws at runtime. Always pass `{ adapter }` to the constructor.
- **`import { PrismaClient } from "@prisma/client"`:** Does not resolve in Prisma 7 when using custom output. Import from the generated path: `"../../app/generated/prisma/client"`.
- **`tailwind.config.js`:** Not supported in Tailwind v4. All config lives in `globals.css` via `@theme` directive.
- **Storing passwords in plaintext:** Always use `bcryptjs.hash(password, 12)` before saving; compare with `bcryptjs.compare()`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Prisma connection management | Custom pool logic | `src/lib/db.ts` singleton with globalThis | Hot reload creates 100s of connections without this |
| Auth session management | JWT encode/decode, cookie handling | NextAuth v5 `auth()` function | Session management edge cases are numerous; v5 handles JWT rotation, CSRF, etc. |
| Password hashing | Custom crypto | `bcryptjs` | bcrypt has the right cost factor properties; rolling your own fails OWASP standards |
| TypeScript path resolution in tests | Manual tsconfig parsing | `vite-tsconfig-paths` plugin | Vitest does not read tsconfig paths by default |
| Tailwind CSS merging | Custom className concat | `cn()` from shadcn/ui (`clsx` + `tailwind-merge`) | Naive string concat creates specificity conflicts |
| Route protection logic | Custom session cookies | `authorized` callback in auth.config.ts | NextAuth manages token refresh and edge-compatible session reads |

**Key insight:** The "foundational" layers (db singleton, auth config, route protection) have enough production edge cases that rolling custom solutions is a reliability risk — not a complexity one. Use the library patterns exactly as documented.

---

## Common Pitfalls

### Pitfall 1: Prisma 7 Client Import from Wrong Path

**What goes wrong:** `Module not found: Can't resolve '@prisma/client'` or `TypeError: Cannot find module` at runtime/build time.
**Why it happens:** Prisma 7 generates client to `app/generated/prisma` when configured with custom output. The standard `@prisma/client` import path doesn't automatically resolve there without alias configuration.
**How to avoid:** Always import from the generated path: `import { PrismaClient } from "../../app/generated/prisma/client"`. Add `serverExternalPackages: ['@prisma/client', 'pg']` to `next.config.ts`.
**Warning signs:** Build error mentioning `@prisma/client` not found; runtime error about missing module.

### Pitfall 2: Turbopack Bundling Prisma Client

**What goes wrong:** `TypeError: The "path" argument must be of type string. Received undefined` during `npm run dev`.
**Why it happens:** Turbopack (default in Next.js 16) tries to bundle `pg` and the Prisma client, but they require Node.js native modules and dynamic requires that can't be bundled.
**How to avoid:** Add to `next.config.ts`: `experimental: { serverExternalPackages: ['@prisma/client', 'pg'] }`.
**Warning signs:** Dev server starts but crashes on first Prisma query; error in Turbopack output mentioning `pg` or native modules.

### Pitfall 3: proxy.ts Export Name Mismatch

**What goes wrong:** Next.js throws `The file "./proxy.ts" must export a function, either as a default export or as a named "proxy" export.`
**Why it happens:** Exporting `middleware` instead of `proxy` (old Next.js 15 pattern), or using `default export` with a function named `middleware`.
**How to avoid:** Use exactly `export { auth as proxy } from "@/auth"` or `export function proxy(request) { ... }`.
**Warning signs:** Error message explicitly naming the export requirement; proxy not executing for any routes.

### Pitfall 4: auth.config.ts vs auth.ts Boundary Violation

**What goes wrong:** `Error: PrismaClient is not configured to run in Edge Runtime` or similar Node.js API-in-edge-runtime error.
**Why it happens:** Importing `db` from `src/lib/db.ts` into `auth.config.ts`. `auth.config.ts` is imported by `proxy.ts` which runs on the edge — it cannot use Node.js APIs (pg, bcryptjs, Prisma).
**How to avoid:** Keep `auth.config.ts` completely free of database/ORM imports. Only put the `authorized` callback and page routes there. All user lookups and password verification go in `auth.ts` only.
**Warning signs:** Runtime error in proxy.ts execution; mentions of edge runtime incompatibility.

### Pitfall 5: TIMESTAMPTZ Omission

**What goes wrong:** Dates stored without timezone awareness cause the "due today" logic (Phase 4) to break for users in non-UTC timezones.
**Why it happens:** Prisma defaults to `TIMESTAMP(3)` (no timezone). If you don't add `@db.Timestamptz(3)` in Phase 1, retrofitting requires a migration that modifies column types on data that already exists.
**How to avoid:** Add `@db.Timestamptz(3)` to every `DateTime` column in schema.prisma before running the first migration.
**Warning signs:** Date comparisons in SQL return wrong results; "due today" shows yesterday's plants as due tomorrow.

### Pitfall 6: AUTH_SECRET Not Set

**What goes wrong:** NextAuth v5 throws `MissingSecret: Please define a "secret"` in production (and sometimes dev).
**Why it happens:** AUTH_SECRET environment variable is required for NextAuth v5. Omitted from `.env.local`.
**How to avoid:** Generate with `openssl rand -base64 32` and set `AUTH_SECRET=<value>` in `.env.local`.
**Warning signs:** Auth operations throw `MissingSecret` error; login fails silently.

### Pitfall 7: PostgreSQL Not Running Locally

**What goes wrong:** Prisma migrate dev fails with `Can't reach database server` or connection refused on port 5432.
**Why it happens:** No PostgreSQL is installed or running. Docker and psql CLI are absent on this machine (confirmed in environment audit).
**How to avoid:** Install PostgreSQL via winget (`winget install PostgreSQL.PostgreSQL.17`) or use a cloud dev database (Neon, Supabase free tier). Document setup in README.
**Warning signs:** `ECONNREFUSED 127.0.0.1:5432` in any Prisma command output.

---

## Code Examples

### Route Handler for NextAuth v5

```typescript
// Source: https://authjs.dev/getting-started/installation
// app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/auth";
export const { GET, POST } = handlers;
```

### Prisma Migration Workflow

```bash
# Source: https://www.prisma.io/docs/guides/frameworks/nextjs
# After editing schema.prisma:
npx prisma migrate dev --name init
# This: creates migration SQL, runs it, regenerates client

# Generate client only (no migration):
npx prisma generate

# Inspect data:
npx prisma studio
```

### Environment Variables Template

```bash
# .env.local
DATABASE_URL="postgresql://postgres:password@localhost:5432/plantz_dev"
AUTH_SECRET="<generated-with-openssl-rand-base64-32>"
NEXTAUTH_URL="http://localhost:3000"
```

### Minimal Vitest Smoke Test

```typescript
// Source: https://nextjs.org/docs/app/guides/testing/vitest
// tests/page.test.tsx
import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import Page from "../app/page";

test("home page renders", () => {
  render(<Page />);
  expect(screen.getByRole("heading")).toBeDefined();
});
```

### Minimal Playwright Smoke Test

```typescript
// Source: https://nextjs.org/docs/pages/guides/testing/playwright
// e2e/smoke.spec.ts
import { test, expect } from "@playwright/test";

test("home page loads without errors", async ({ page }) => {
  await page.goto("/");
  await expect(page).not.toHaveTitle(/Error/);
  await expect(page.locator("body")).toBeVisible();
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` | `proxy.ts` | Next.js 16.0 | Rename required; export function name changes from `middleware` to `proxy` |
| `@prisma/client` direct (Prisma 6) | `@prisma/adapter-pg` required (Prisma 7) | Prisma 7.0 (Nov 2025) | Must install and configure adapter; import path changes |
| `tailwind.config.js` | CSS-first `@theme` directive | Tailwind v4 (Jan 2025) | No JS config file; all in globals.css |
| `import { z } from "zod"` | `import { z } from "zod/v4"` | Zod v4 (2025) | Old path still works but misses 14x perf improvement |
| NextAuth v4 `getServerSession()` | NextAuth v5 `auth()` universal | Auth.js v5 beta | Unified server/client/edge API |
| `next-auth@latest` stable | `next-auth@beta` (v5) | — | v4 stable does NOT support App Router; must use beta |
| Prisma client at `@prisma/client` | Generated to `app/generated/prisma` | Prisma 7 | Import path must change; serverExternalPackages needed |

**Deprecated/outdated:**
- `middleware.ts`: Still works in Next.js 16 but deprecated with explicit warning; will be removed in future version
- `prisma-client-js` generator provider: Replaced by `prisma-client` in Prisma 7
- NextAuth v4 (`next-auth` stable): Dead-end for App Router — do not use

---

## Open Questions

1. **Docker vs local PostgreSQL for dev setup**
   - What we know: Docker and Docker Compose are not installed on this machine. winget and choco are available. PostgreSQL 17 CLI (`psql`) is not present.
   - What's unclear: Whether the developer prefers installing PostgreSQL natively via winget, or using a cloud dev database (Neon, Supabase free tier, Railway). Both are viable.
   - Recommendation (Claude's discretion): Include a `docker-compose.yml` for teams/CI, and document winget install path for solo dev. The plan should include a Wave 0 task to establish the database connection before any Prisma work.

2. **Prisma generated client output path: `app/generated/prisma` vs default**
   - What we know: Prisma 7's official Next.js guide uses `app/generated/prisma` as the output path. This requires `serverExternalPackages` config in `next.config.ts`.
   - What's unclear: Whether there are any import path convenience tradeoffs worth reconsidering.
   - Recommendation: Use `app/generated/prisma` as the official Prisma guide recommends. The extra `next.config.ts` line is a small price for following the documented pattern.

3. **bcrypt vs bcryptjs**
   - What we know: `bcrypt` requires native build tools (node-gyp, Python). `bcryptjs` is pure JavaScript, slightly slower but no build dependency issues.
   - What's unclear: Whether the dev environment has native build tools available.
   - Recommendation: Use `bcryptjs` for this greenfield project to avoid CI/CD native toolchain complexity.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Everything | Yes | v24.13.0 | — |
| npm | Package management | Yes | 11.6.2 | — |
| PostgreSQL | Prisma migrations, dev server | No | — | Install via `winget install PostgreSQL.PostgreSQL.17` or use Neon free tier |
| Docker / Docker Compose | Optional dev DB | No | — | winget PostgreSQL or cloud dev DB |
| psql CLI | DB inspection | No | — | Use `npx prisma studio` instead |

**Missing dependencies with no fallback:**
- PostgreSQL: Required before `npx prisma migrate dev` can run. Plan must include a Wave 0 task to establish the database connection. The execution plan should provide two paths: (a) `winget install PostgreSQL.PostgreSQL.17` for local, and (b) a Neon/Supabase free-tier URL for cloud dev.

**Missing dependencies with fallback:**
- Docker / Docker Compose: Not available; use winget PostgreSQL or cloud DB instead.
- psql CLI: Not available; use `npx prisma studio` for data inspection.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 + Playwright 1.59.1 |
| Config file | `vitest.config.mts` (create in Wave 0), `playwright.config.ts` (create in Wave 0) |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run && npx playwright test` |

### Phase Requirements → Test Map

Phase 1 has no user-facing requirements (infrastructure only). Tests exist to validate the 5 success criteria.

| Success Criterion | Behavior | Test Type | Automated Command | File Exists? |
|---------|----------|-----------|-------------------|-------------|
| SC-1: App runs locally | Dev server starts, returns 200 | E2E smoke | `npx playwright test e2e/smoke.spec.ts` | No — Wave 0 |
| SC-2: Prisma schema applied with TIMESTAMPTZ | Migration runs, columns use timestamptz | Manual verification | `npx prisma migrate dev` + `npx prisma studio` | No — Wave 0 |
| SC-3: lib/db.ts singleton exists | Module exports a PrismaClient | Unit | `npx vitest run tests/db.test.ts` | No — Wave 0 |
| SC-4: NextAuth configured with JWT + proxy.ts | Auth module exports handlers; proxy.ts exports proxy fn | Unit (module shape) | `npx vitest run tests/auth.test.ts` | No — Wave 0 |
| SC-5: Vitest and Playwright each have one passing test | Test suites exit 0 | Both | `npx vitest run && npx playwright test` | No — Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run && npx playwright test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/page.test.tsx` — covers SC-5 (Vitest smoke)
- [ ] `e2e/smoke.spec.ts` — covers SC-1, SC-5 (Playwright smoke)
- [ ] `tests/db.test.ts` — covers SC-3 (singleton module shape)
- [ ] `tests/auth.test.ts` — covers SC-4 (auth exports shape)
- [ ] `vitest.config.mts` — Vitest framework config
- [ ] `playwright.config.ts` — Playwright framework config
- [ ] Framework install: `npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom vite-tsconfig-paths` and `npx playwright install --with-deps chromium`

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes (auth configured in this phase) | NextAuth v5 Credentials provider |
| V3 Session Management | Yes | NextAuth v5 JWT strategy (encrypted JWE by default) |
| V4 Access Control | Yes | `authorized` callback in auth.config.ts + proxy.ts matcher |
| V5 Input Validation | Yes | Zod v4 in Credentials `authorize()` |
| V6 Cryptography | Yes | bcryptjs for password hashing (OWASP-compliant cost factor) |

### Known Threat Patterns for this Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Password brute force | Elevation of Privilege | bcryptjs cost factor slows attacks; rate limiting deferred to Phase 2 UI |
| Session fixation | Elevation of Privilege | NextAuth v5 rotates JWT on session update |
| CSRF | Tampering | NextAuth v5 includes CSRF protection in handlers |
| SQL injection via Prisma queries | Tampering | Prisma uses parameterized queries by default; never use `$queryRawUnsafe` |
| Plaintext password storage | Info Disclosure | bcryptjs hash only; never store `passwordHash` from plaintext |
| Mass assignment via Server Actions | Tampering | Zod schema validation before any Prisma write |
| Unauthenticated access to protected routes | Elevation of Privilege | proxy.ts `authorized` callback redirects to /login |

**ASVS V2.1.1 note:** Credentials provider stores passwords as bcrypt hashes (cost factor 12 recommended). The schema column is named `passwordHash` — never `password` — to make intent explicit.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `bcryptjs` (pure JS) is preferred over `bcrypt` (native) for this project | Standard Stack | If native build tools are present, `bcrypt` performs ~3x faster at high concurrency — low risk for a single-tenant v1 app |
| A2 | Full schema (all 7 entities) should be defined in Phase 1 | Architecture Patterns | If schema changes are needed later, they require new migration files — no data loss risk in dev, but schema changes mid-project increase review surface |
| A3 | `app/generated/prisma` custom output path is preferred over default | Architecture Patterns | Default output avoids `serverExternalPackages` config; both approaches work; official Prisma/Next.js guide uses custom path |

---

## Sources

### Primary (HIGH confidence)
- [CITED: nextjs.org/docs/app/api-reference/file-conventions/proxy] — proxy.ts API reference, version 16.2.3, last updated 2026-04-10
- [CITED: nextjs.org/learn/dashboard-app/adding-authentication] — Auth.js v5 credentials setup with proxy.ts, official Next.js learn course
- [CITED: authjs.dev/getting-started/session-management/protecting] — `export { auth as proxy }` pattern for Next.js 16
- [CITED: nextjs.org/docs/app/guides/testing/vitest] — Vitest config for Next.js, version 16.2.3, last updated 2026-04-10
- [CITED: prisma.io/docs/guides/frameworks/nextjs] — Prisma 7 singleton pattern with @prisma/adapter-pg, official Prisma guide
- [CITED: prisma.io/docs/orm/reference/prisma-schema-reference] — @db.Timestamptz annotation documentation

### Secondary (MEDIUM confidence)
- [CITED: jb.desishub.com/blog/nextjs-with-prisma-7-and-postgres] — Prisma 7 + Next.js 16 setup guide with serverExternalPackages config (cross-verified with multiple community sources)
- [CITED: authjs.dev/getting-started/migrating-to-v5] — Auth.js v5 migration guide confirming auth.config.ts + auth.ts split pattern
- [CITED: ui.shadcn.com/docs/installation/next] — shadcn/ui CLI init for Next.js with Tailwind v4

### Tertiary (LOW confidence)
- WebSearch results confirming Next.js 16 proxy.ts rename from multiple community articles (consistent with official docs, marked as secondary confirmation only)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions pinned in CLAUDE.md, cross-verified with npm and official docs
- Architecture: HIGH — proxy.ts pattern verified against official Next.js 16 docs; Prisma 7 adapter pattern verified against Prisma official guide
- Pitfalls: HIGH — all critical pitfalls verified from official source or reproducible GitHub issues
- Test configuration: HIGH — Vitest setup from official Next.js docs; Playwright from official Next.js docs

**Research date:** 2026-04-13
**Valid until:** 2026-05-13 (stable stack; v5 beta pin may need refresh if new beta drops)

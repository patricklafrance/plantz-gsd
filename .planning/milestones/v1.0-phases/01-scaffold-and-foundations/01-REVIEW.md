---
phase: 01-scaffold-and-foundations
reviewed: 2026-04-13T12:00:00Z
depth: standard
files_reviewed: 35
files_reviewed_list:
  - auth.config.ts
  - auth.ts
  - components.json
  - e2e/smoke.spec.ts
  - eslint.config.mjs
  - next.config.ts
  - package.json
  - playwright.config.ts
  - postcss.config.mjs
  - prisma.config.ts
  - prisma/schema.prisma
  - proxy.ts
  - src/app/(auth)/layout.tsx
  - src/app/(auth)/login/page.tsx
  - src/app/(auth)/register/page.tsx
  - src/app/(main)/dashboard/page.tsx
  - src/app/(main)/layout.tsx
  - src/app/(main)/plants/page.tsx
  - src/app/api/auth/[...nextauth]/route.ts
  - src/app/globals.css
  - src/app/layout.tsx
  - src/app/page.tsx
  - src/components/ui/badge.tsx
  - src/components/ui/button.tsx
  - src/components/ui/card.tsx
  - src/components/ui/input.tsx
  - src/components/ui/label.tsx
  - src/components/ui/separator.tsx
  - src/components/ui/skeleton.tsx
  - src/lib/db.ts
  - src/lib/utils.ts
  - tests/auth.test.ts
  - tests/db.test.ts
  - tests/page.test.tsx
  - tsconfig.json
  - vitest.config.mts
findings:
  critical: 1
  warning: 4
  info: 2
  total: 7
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-04-13T12:00:00Z
**Depth:** standard
**Files Reviewed:** 35
**Status:** issues_found

## Summary

This is a scaffold/foundations phase establishing the project structure for a Next.js 16 + Prisma 7 + NextAuth v5 app. The overall structure is solid: auth is correctly split into edge-safe config (`auth.config.ts`) and Node-only auth logic (`auth.ts`), the Prisma schema is well-designed with proper cascade deletes and timestamptz columns, and the proxy.ts follows the Next.js 16 pattern correctly. UI components are standard shadcn/ui output.

Key concerns center around the Prisma client output path pointing outside the `src/` directory (likely a misconfiguration), a non-null assertion on the DATABASE_URL environment variable that will produce a cryptic error at runtime if unset, and missing database indexes on foreign key columns that will impact query performance as data grows.

## Critical Issues

### CR-01: Prisma client output path resolves outside src/, creating a shadow `app/` directory

**File:** `prisma/schema.prisma:3`
**Issue:** The generator output is set to `../app/generated/prisma`, which resolves to `<repo>/app/generated/prisma/` at the project root. However, the Next.js app directory is at `src/app/`. This creates a separate top-level `app/` directory that could confuse Next.js (which may try to treat it as an alternate app directory) and sits outside the `src/` boundary. The import in `src/lib/db.ts` uses `../../app/generated/prisma/client` (a relative path escaping `src/`), confirming this disconnect. If a developer runs `prisma generate`, a top-level `app/` directory will appear alongside `src/app/`, which is unexpected and could cause build issues.
**Fix:**
```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/app/generated/prisma"
}
```
And update the import in `src/lib/db.ts` accordingly:
```typescript
import { PrismaClient } from "@/app/generated/prisma/client";
```

## Warnings

### WR-01: Non-null assertion on DATABASE_URL with no runtime guard

**File:** `src/lib/db.ts:9`
**Issue:** `process.env.DATABASE_URL!` uses a non-null assertion. If DATABASE_URL is not set (e.g., missing `.env` file in development, misconfigured deployment), the PrismaPg adapter will receive `undefined` as the connection string. This will produce a cryptic error from the pg driver rather than a clear message about the missing environment variable.
**Fix:**
```typescript
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL environment variable is not set. " +
    "Create a .env file with DATABASE_URL=postgresql://..."
  );
}

const adapter = new PrismaPg({ connectionString });
```

### WR-02: Missing database indexes on foreign key columns

**File:** `prisma/schema.prisma:26-93`
**Issue:** Several foreign key columns lack explicit indexes: `Room.userId` (line 26), `Plant.userId` (line 39), `Plant.roomId` (line 37), `Plant.careProfileId` (line 44), `WateringLog.plantId` (line 56), `HealthLog.plantId` (line 64), `Reminder.plantId` (line 86), `Reminder.userId` (line 88). While PostgreSQL automatically creates indexes for unique constraints and primary keys, it does not automatically index foreign key columns. Queries filtering by these columns (e.g., "all plants for a user", "all watering logs for a plant") will require full table scans without indexes. This is technically a performance concern but also a correctness issue for the schema design -- foreign keys without indexes can also cause lock contention on cascading deletes.
**Fix:** Add `@@index` directives to each model. For example:
```prisma
model Plant {
  // ... existing fields ...
  @@index([userId])
  @@index([roomId])
  @@index([careProfileId])
}

model WateringLog {
  // ... existing fields ...
  @@index([plantId])
}

model HealthLog {
  // ... existing fields ...
  @@index([plantId])
}

model Room {
  // ... existing fields ...
  @@index([userId])
}

model Reminder {
  // ... existing fields ...
  @@index([plantId])
  @@index([userId])
}
```

### WR-03: Proxy matcher excludes auth API routes, but pattern may be too broad

**File:** `proxy.ts:4-7`
**Issue:** The matcher pattern `/((?!api|_next/static|_next/image|favicon.ico|login|register).*)` excludes any path containing `login` or `register` as a prefix. This means routes like `/login-history` or `/register-device` (if added in the future) would also bypass authentication. More importantly, the root path `/` is matched by the proxy but is not listed as a protected route in `auth.config.ts` (only `/dashboard`, `/plants`, `/rooms` are protected). This is not a bug today since the authorized callback returns `true` for unmatched routes, but it creates a coupling between two files that must stay in sync.
**Fix:** Consider using a more explicit pattern that matches only the known public paths, or add a comment documenting the coupling:
```typescript
export const config = {
  matcher: [
    // IMPORTANT: Keep in sync with auth.config.ts authorized callback.
    // Excludes: API routes, static assets, auth pages, favicon
    "/((?!api|_next/static|_next/image|favicon\\.ico|login|register).*)",
  ],
};
```

### WR-04: TypeScript version in package.json contradicts CLAUDE.md specification

**File:** `package.json:53`
**Issue:** The package.json specifies `"typescript": "^5"` but CLAUDE.md explicitly requires TypeScript 6.0. The `^5` range will resolve to 5.x and will never install 6.x. While TypeScript 5.x works fine with Next.js 16, this contradicts the project's documented technology decisions.
**Fix:**
```json
"typescript": "^6.0"
```

## Info

### IN-01: Package name is still the default template name

**File:** `package.json:2`
**Issue:** The package name is `"nextjs-temp"`, which is the default from `create-next-app`. This should be updated to reflect the project name.
**Fix:**
```json
"name": "plantz"
```

### IN-02: Tests validate source code via string matching rather than actual behavior

**File:** `tests/auth.test.ts:1-37`, `tests/db.test.ts:1-16`
**Issue:** The auth and db tests read source files as strings and assert on the presence of specific code patterns (e.g., `expect(configSource).toContain('from "bcryptjs"')`). These tests verify that code contains certain strings but do not test actual runtime behavior. They are brittle -- any refactoring (renaming imports, changing string formatting) would break them without any actual regression. This is understandable for a scaffold phase where the database is not available in CI, but should be noted for replacement with proper integration tests in a later phase.
**Fix:** No immediate action needed. Replace with proper unit/integration tests when implementing the auth flow in a subsequent phase. For example, test the `authorize` function directly with mock Prisma client and bcrypt.

---

_Reviewed: 2026-04-13T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

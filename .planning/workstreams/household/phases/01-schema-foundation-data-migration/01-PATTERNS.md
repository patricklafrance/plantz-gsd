# Phase 1: Schema Foundation + Data Migration - Pattern Map

**Mapped:** 2026-04-16
**Files analyzed:** 8 new/modified files
**Analogs found:** 8 / 8

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `prisma/schema.prisma` | schema | CRUD | `prisma/schema.prisma` (existing) | exact — extend in place |
| `auth.ts` | mutator (JWT enrichment) | request-response | `auth.ts` lines 13-31 (`isDemo` pattern) | exact |
| `src/types/next-auth.d.ts` | type-augmentation | — | `src/types/next-auth.d.ts` lines 1-17 (existing) | exact — extend in place |
| `src/features/auth/actions.ts` | mutator (Server Action) | CRUD + transaction | `src/features/auth/actions.ts` lines 11-58 (`registerUser`) | exact — wrap in place |
| `src/features/household/guards.ts` | guard | request-response | `src/features/plants/actions.ts` lines 9-11 (auth+ownership check pattern) | role-match |
| `src/features/household/queries.ts` | reader | request-response | `src/features/rooms/queries.ts` lines 1-9 | role-match |
| `src/features/household/schema.ts` | schema (Zod) | — | `src/features/auth/schemas.ts` lines 1-29 | exact |
| `src/lib/slug.ts` | utility | — | `src/lib/utils.ts` (utility module pattern) | role-match |

---

## Pattern Assignments

### `prisma/schema.prisma` (schema, CRUD)

**Analog:** `prisma/schema.prisma` (existing file — extend in place)

**Primary key pattern** (lines 11, 27, 36):
```prisma
id  String  @id @default(cuid())
```
All 5 new models (`Household`, `HouseholdMember`, `Cycle`, `Availability`, `Invitation`) must use this pattern. No UUID, no auto-increment.

**Timestamp pattern** (lines 15-16, 32-33):
```prisma
createdAt  DateTime  @default(now()) @db.Timestamptz(3)
updatedAt  DateTime  @updatedAt @db.Timestamptz(3)
```
Every new model with `createdAt`/`updatedAt` must include the `@db.Timestamptz(3)` annotation. Models without mutations (e.g., `HouseholdMember` tracking join date only) omit `updatedAt`.

**Cascade pattern — ownership (lines 30, 43):**
```prisma
-- Current (to be replaced on Plant/Room):
user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)

-- New ownership relation (Plant→Household, Room→Household):
household  Household  @relation(fields: [householdId], references: [id], onDelete: Cascade)

-- New audit relation (Plant.createdByUserId, Room.createdByUserId):
createdBy  User?  @relation(fields: [createdByUserId], references: [id], onDelete: SetNull)
```

**Index pattern** (line 75-76 in `Note` model):
```prisma
@@index([plantId])
```
New composite indexes follow this same `@@index([col1, col2])` syntax. The `@@unique` constraint on `HouseholdMember` follows the `Reminder` model's `@@unique([plantId, userId])` at line 111.

**Existing `@@unique` pattern** (lines 110-111):
```prisma
  @@unique([plantId, userId])
```
`HouseholdMember` gets `@@unique([householdId, userId])` using this same syntax.

---

### `auth.ts` — JWT + session callbacks (mutator, request-response)

**Analog:** `auth.ts` lines 13-31

**Existing JWT callback pattern** (lines 13-24):
```typescript
async jwt({ token, user }) {
  if (user) {
    token.id = user.id;
    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: { email: true },
    });
    token.isDemo = dbUser?.email === DEMO_EMAIL;
  }
  return token;
},
```
Add `activeHouseholdId` inside the same `if (user)` block — identical DB query pattern, fires only at sign-in. Do NOT add a query outside `if (user)` (that would run on every request).

**Existing session callback pattern** (lines 25-30):
```typescript
async session({ session, token }) {
  if (token.id) {
    session.user.id = token.id as string;
    session.user.isDemo = token.isDemo === true;
  }
  return session;
},
```
Add `session.user.activeHouseholdId = token.activeHouseholdId as string | undefined;` inside the same `if (token.id)` block.

**Import pattern** (lines 1-7):
```typescript
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcryptjs from "bcryptjs";
import { z } from "zod/v4";
import { authConfig } from "./auth.config";
import { db } from "@/lib/db";
import { DEMO_EMAIL } from "@/features/demo/seed-data";
```
No new imports needed for the JWT extension — `db` is already imported.

---

### `src/types/next-auth.d.ts` (type-augmentation)

**Analog:** `src/types/next-auth.d.ts` lines 1-17 (extend in place)

**Existing file** (full, lines 1-17):
```typescript
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      isDemo: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    isDemo?: boolean;
  }
}
```
Add `activeHouseholdId?: string;` to the `Session.user` interface and `activeHouseholdId?: string | null;` to the `JWT` interface. No new imports needed — the file already imports `DefaultSession`.

---

### `src/features/auth/actions.ts` — `registerUser` transaction wrap (mutator, CRUD + transaction)

**Analog:** `src/features/auth/actions.ts` lines 11-58 (modify in place)

**Existing registerUser structure** (lines 11-58):
```typescript
"use server";

import { auth, signIn } from "../../../auth";
import { db } from "@/lib/db";
import bcryptjs from "bcryptjs";
import { registerSchema } from "./schemas";
import { onboardingSchema } from "./schemas";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { revalidatePath } from "next/cache";

export async function registerUser(data: {
  email: string;
  password: string;
  confirmPassword: string;
}) {
  const parsed = registerSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid input." };
  }

  try {
    const existingUser = await db.user.findUnique({
      where: { email: parsed.data.email },
    });
    if (existingUser) {
      return { error: "An account with this email already exists. Sign in instead?" };
    }

    const passwordHash = await bcryptjs.hash(parsed.data.password, 12);

    await db.user.create({
      data: { email: parsed.data.email, passwordHash },
    });

    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return { error: "Something went wrong. Please try again in a moment." };
  }
}
```

**What changes:** Replace `db.user.create({ ... })` (line 38-42) with `db.$transaction(async (tx) => { ... })` containing `tx.user.create`, `tx.household.create`, and `tx.householdMember.create` in sequence. The `signIn` call and `isRedirectError` catch remain unchanged. The function signature gains an optional `timezone?: string` field (from D-12 browser detection).

**New import to add:**
```typescript
import { generateHouseholdSlug } from "@/lib/slug";
```

**Error handling pattern** (lines 52-57) — unchanged:
```typescript
} catch (error) {
  if (isRedirectError(error)) throw error;
  return { error: "Something went wrong. Please try again in a moment." };
}
```
The `isRedirectError` re-throw is critical — `signIn` throws a redirect error on success. This pattern must be preserved exactly.

---

### `src/features/household/guards.ts` (guard, request-response) — NEW

**Analog:** `src/features/plants/actions.ts` (auth check + ownership check pattern)

**Auth guard pattern** (plants/actions.ts lines 9-12, repeated in every action):
```typescript
const session = await auth();
if (!session?.user?.id) return { error: "Not authenticated." };
if (session.user.isDemo) return { error: "Demo mode — sign up to save your changes." };
```
The guard adapts this pattern to throw instead of return, matching D-19. The `auth()` import path in feature folders is always `"../../../auth"` (three levels up from `src/features/{domain}/`).

**Ownership check pattern** (plants/actions.ts lines 52-55):
```typescript
const existing = await db.plant.findFirst({
  where: { id: parsed.data.id, userId: session.user.id },
});
if (!existing) return { error: "Plant not found." };
```
The guard replaces `return { error: ... }` with `throw new ForbiddenError(...)` and uses `db.householdMember.findFirst` with `include: { household: true }` to fetch the full membership record in one query (enabling the rich return per D-20).

**Import pattern** (plants/actions.ts lines 1-3):
```typescript
"use server";

import { auth } from "../../../auth";
import { db } from "@/lib/db";
```
The guard file is not a Server Action (no `"use server"`) but uses the same import paths for `auth` and `db`.

**ForbiddenError class — no analog exists.** This is the project's first custom error class. Shape per RESEARCH.md Pattern 3: extend `Error`, add `readonly name = "ForbiddenError" as const`, add `readonly statusCode = 403 as const`, call `Object.setPrototypeOf(this, ForbiddenError.prototype)` in constructor.

---

### `src/features/household/queries.ts` (reader, request-response) — NEW

**Analog:** `src/features/rooms/queries.ts` lines 1-9

**Reader function pattern** (rooms/queries.ts lines 1-9):
```typescript
import { db } from "@/lib/db";

export async function getRooms(userId: string) {
  return db.room.findMany({
    where: { userId },
    include: { _count: { select: { plants: true } } },
    orderBy: { createdAt: "asc" },
  });
}
```
`resolveHouseholdBySlug` follows the same shape: `import { db }`, export an `async function`, single `db.<model>.findUnique` call, typed return (implicit). No `auth()` call — the caller is responsible for authentication; queries receive pre-validated identifiers.

**Select pattern for slug resolver** (rooms/queries.ts line 25-29):
```typescript
return db.room.findMany({
  where: { userId },
  select: { id: true, name: true },
  orderBy: { createdAt: "asc" },
});
```
`resolveHouseholdBySlug` uses `select: { id: true, name: true }` (minimal projection — only what the guard and Server Actions need from the slug lookup).

---

### `src/features/household/schema.ts` (Zod schema, —) — NEW

**Analog:** `src/features/auth/schemas.ts` lines 1-29

**Zod v4 import pattern** (auth/schemas.ts line 1):
```typescript
import { z } from "zod/v4";
```
All Zod schemas must use `zod/v4` import path, not `"zod"`. This is a hard project constraint.

**Schema + type export pattern** (auth/schemas.ts lines 3-30):
```typescript
export const loginSchema = z.object({
  email: z.email("Please enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

export type LoginInput = z.infer<typeof loginSchema>;
```
Every schema file exports both the schema constant and the inferred TypeScript type. `household/schema.ts` exports schemas for household inputs that Phase 2+ will use for creation/update actions (e.g., `createHouseholdSchema`, `updateHouseholdSchema`). Phase 1 scopes this to the `registerUser` timezone field augmentation and any schemas needed by the guard/queries.

**Enum pattern** (auth/schemas.ts lines 19-25):
```typescript
export const onboardingSchema = z.object({
  plantCountRange: z.enum([
    "1-5 plants",
    "6-15 plants",
    ...
  ]),
});
```
`HouseholdMember` role enum and `rotationStrategy` enum in the household schema follow `z.enum([...])` with string literals.

---

### `src/lib/slug.ts` (utility, —) — NEW

**Analog:** `src/lib/utils.ts` (utility module — pure functions, no DB, no auth)

**Utility module pattern** (`src/lib/utils.ts` — project convention):
```typescript
// Pure function, no side effects, importable everywhere
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```
`slug.ts` follows the same shape: pure function export, no imports from `@/lib/db` or `auth`, uses Node built-in `crypto` only. No `"use server"` directive — this is a pure utility.

**Node crypto import pattern** — no existing project analog uses `crypto` directly. Use:
```typescript
import { randomBytes } from "crypto";
```
This is a Node built-in; no install needed. Compatible with Next.js 16 App Router server-side code.

---

## Shared Patterns

### Authentication / Session Check
**Source:** `src/features/plants/actions.ts` lines 9-11
**Apply to:** `src/features/household/guards.ts`
```typescript
const session = await auth();
if (!session?.user?.id) return { error: "Not authenticated." };
```
The guard throws `ForbiddenError` instead of returning, but the session acquisition pattern is identical. Import `auth` from `"../../../auth"` in all feature-folder files.

### Zod v4 Import
**Source:** `src/features/auth/schemas.ts` line 1
**Apply to:** `src/features/household/schema.ts`, and any Zod usage in `src/features/auth/actions.ts` extension
```typescript
import { z } from "zod/v4";
```

### Prisma Singleton
**Source:** `src/lib/db.ts` line 19
**Apply to:** `src/features/household/guards.ts`, `src/features/household/queries.ts`
```typescript
import { db } from "@/lib/db";
```
Always import from `@/lib/db` (path alias), never instantiate `PrismaClient` directly in feature files.

### `isRedirectError` Re-throw
**Source:** `src/features/auth/actions.ts` lines 52-55
**Apply to:** `src/features/auth/actions.ts` (extended `registerUser`) — preserve existing pattern exactly
```typescript
} catch (error) {
  if (isRedirectError(error)) throw error;
  return { error: "Something went wrong. Please try again in a moment." };
}
```
`signIn(...)` throws a redirect error on success. This catch block must always re-throw redirect errors before handling actual failures.

### `@db.Timestamptz(3)` Annotation
**Source:** `prisma/schema.prisma` lines 15-16
**Apply to:** All 5 new Prisma models (`Household`, `HouseholdMember`, `Cycle`, `Availability`, `Invitation`)
```prisma
createdAt  DateTime  @default(now()) @db.Timestamptz(3)
updatedAt  DateTime  @updatedAt @db.Timestamptz(3)
```

### Test File Structure
**Source:** `tests/plants.test.ts` and `tests/rooms.test.ts`
**Apply to:** `tests/household.test.ts` (new test file)

Schema validation tests run immediately with `async import`. Server Action / guard behavior tests that need DB are stubbed as `test.todo` until implementation:
```typescript
import { expect, test, describe } from "vitest";

describe("household schema validation", () => {
  test("createHouseholdSchema accepts valid input", async () => {
    const { createHouseholdSchema } = await import("@/features/household/schema");
    // ...
  });
});

describe("requireHouseholdAccess guard (HSLD-06)", () => {
  test.todo("returns { household, member, role } for valid member");
  test.todo("throws ForbiddenError for non-member");
  test.todo("throws ForbiddenError for unauthenticated session");
});
```

---

## No Analog Found

All 8 files have analogs. Two capabilities have no direct codebase match for their specific implementation — use RESEARCH.md patterns directly:

| File | Capability | Reason | Use Instead |
|------|-----------|--------|-------------|
| `src/features/household/guards.ts` | `ForbiddenError` class | No custom error classes exist in the codebase yet | RESEARCH.md Pattern 3 — `Object.setPrototypeOf` constructor pattern |
| `src/lib/slug.ts` | Custom unambiguous-alphabet slug generation | No slug generation or `crypto` usage in codebase | RESEARCH.md Pattern 4 — custom alphabet rejection-sampling implementation |
| `prisma/schema.prisma` | WateringLog functional unique index | Prisma does not support functional indexes; cannot be expressed in schema.prisma | RESEARCH.md Pattern 5 — append raw SQL to `--create-only` migration |

---

## Metadata

**Analog search scope:** `src/features/`, `src/lib/`, `src/types/`, `prisma/`, `auth.ts`, `tests/`
**Files scanned:** 14 source files read directly
**Pattern extraction date:** 2026-04-16

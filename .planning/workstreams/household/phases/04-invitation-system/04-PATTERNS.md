# Phase 4: Invitation System - Pattern Map

**Mapped:** 2026-04-18
**Files analyzed:** 11 (new/modified)
**Analogs found:** 11 / 11

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/features/household/actions.ts` (extend) | Server Action | CRUD + event-driven | `src/features/household/actions.ts` (self — existing actions) | exact |
| `src/features/household/queries.ts` (extend) | read helper / query | CRUD | `src/features/household/queries.ts` (self — existing helpers) | exact |
| `src/features/household/schema.ts` (extend) | Zod schema | transform | `src/features/household/schema.ts` (self — existing schemas) | exact |
| `src/lib/crypto.ts` (new) | utility | transform | `src/lib/slug.ts` | role-match |
| `auth.config.ts` (modify) | auth config | request-response | `auth.config.ts` (self — current file) | exact |
| `proxy.ts` (modify) | middleware config | request-response | `proxy.ts` (self — current file) | exact |
| `auth.ts` (modify — add export) | auth config | request-response | `auth.ts` (self — current file) | exact |
| `src/app/join/[token]/page.tsx` (new) | Server Component page | request-response | `src/app/(main)/h/[householdSlug]/dashboard/page.tsx` | role-match |
| `src/app/join/[token]/accept-form.tsx` (new) | Client Component form | request-response | `src/components/reminders/plant-reminder-toggle.tsx` | role-match |
| `src/components/household/destructive-leave-dialog.tsx` (new) | Client Component dialog | event-driven | `src/components/watering/log-watering-dialog.tsx` | role-match |
| `tests/phase-04/` (new — 14 files) | test | CRUD + concurrency | `tests/phase-03/` suite (all patterns) | exact |

---

## Pattern Assignments

---

### `src/features/household/actions.ts` (extend — 6 new Server Actions)

**Analog:** `src/features/household/actions.ts` (existing `createHousehold`, `skipCurrentCycle`, `createAvailability`, `deleteAvailability`)

**Imports pattern** (lines 1–17):
```typescript
"use server";

import { auth } from "../../../auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireHouseholdAccess, ForbiddenError } from "./guards";
import { HOUSEHOLD_PATHS } from "./paths";
import {
  createInvitationSchema,
  revokeInvitationSchema,
  acceptInvitationSchema,
  leaveHouseholdSchema,
  removeMemberSchema,
  promoteMemberSchema,
} from "./schema";
import { transitionCycle } from "./cycle";
import { generateInvitationToken, hashInvitationToken } from "@/lib/crypto";
import { unstable_update } from "../../../auth";
```

**7-step template — core pattern** (lines 32–120 of existing `createHousehold` + `skipCurrentCycle`):
```typescript
export async function exampleAction(data: unknown) {
  // Step 1: session
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  // Step 2: demo-mode guard
  if (session.user.isDemo) {
    return { error: "This action is disabled in demo mode. Sign up to get your own household." };
  }

  // Step 3: Zod parse
  const parsed = exampleSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  // Step 4: live household access check (skip only for createHousehold/acceptInvitation)
  let access: Awaited<ReturnType<typeof requireHouseholdAccess>>;
  try {
    access = await requireHouseholdAccess(parsed.data.householdId);
  } catch (err) {
    if (err instanceof ForbiddenError) return { error: err.message };
    throw err;
  }

  // Step 5: role authz (OWNER-gated actions)
  if (access.role !== "OWNER") {
    return { error: "Only household owners can ..." };
  }

  // Step 6: write (db.$transaction for multi-write)
  await db.$transaction(async (tx) => {
    // ...
  });

  // Step 7: revalidate
  revalidatePath(HOUSEHOLD_PATHS.settings, "page");
  return { success: true };
}
```

**OWNER-role gate pattern** (lines 268–279 of `deleteAvailability` — dual-auth model showing the pattern):
```typescript
try {
  const { role } = await requireHouseholdAccess(row.householdId);
  if (row.userId !== session.user.id && role !== "OWNER") {
    throw new ForbiddenError("You can only delete your own availability periods.");
  }
} catch (err) {
  if (err instanceof ForbiddenError) return { error: err.message };
  throw err;
}
```

**Transaction pattern** (lines 50–115 of `createHousehold`):
```typescript
const result = await db.$transaction(async (tx) => {
  const thing = await tx.someModel.create({ data: { ... } });
  await tx.anotherModel.create({ data: { ... } });
  return thing;
});
```

**`unstable_update` call shape** — add to the auth.ts export first (see auth.ts section), then call from Server Action after the transaction commits:
```typescript
// Called AFTER db.$transaction resolves — never inside the callback
await unstable_update({ activeHouseholdId: joinedHouseholdId });
```

**revalidatePath pattern** (lines 169, 239, 285):
```typescript
revalidatePath(HOUSEHOLD_PATHS.settings, "page");
revalidatePath(HOUSEHOLD_PATHS.dashboard, "page");
```

---

### `src/features/household/queries.ts` (extend — 3 new read helpers)

**Analog:** `src/features/household/queries.ts` (existing `resolveHouseholdBySlug`, `getUserHouseholds`, `getHouseholdAvailabilities`)

**Imports pattern** (lines 1–2):
```typescript
import { db } from "@/lib/db";
import type { Cycle, Availability } from "@/generated/prisma/client";
```

**findUnique with include pattern** (`resolveHouseholdBySlug`, line 14):
```typescript
export async function resolveHouseholdBySlug(slug: string) {
  return db.household.findUnique({
    where: { slug },
    select: { id: true, name: true },
  });
}
```

**findMany with relation include pattern** (`getHouseholdAvailabilities`, lines 66–76):
```typescript
export async function getHouseholdAvailabilities(householdId: string) {
  return db.availability.findMany({
    where: { householdId },
    include: {
      user: { select: { name: true, email: true } },
    },
    orderBy: { startDate: "asc" },
  });
}
```

**Return shape with mapping pattern** (`getUserHouseholds`, lines 32–45):
```typescript
return memberships.map((m) => ({
  household: m.household,
  role: m.role as "OWNER" | "MEMBER",
  isDefault: m.isDefault,
  joinedAt: m.createdAt,
}));
```

**No-auth read helper convention:** `resolveInvitationByToken` and `getHouseholdInvitations` follow the pattern of `getHouseholdAvailabilities` — no `auth()` call; the Server Component or Server Action that calls them owns the auth check. Add a JSDoc comment to that effect (see `getUserHouseholds` JSDoc at line 26: "caller MUST pass session.user.id — this query has no authz check itself").

---

### `src/features/household/schema.ts` (extend — 7 new Zod schemas)

**Analog:** `src/features/household/schema.ts` (existing schemas)

**Imports pattern** (line 1):
```typescript
import { z } from "zod/v4";
```

**Simple object schema with cuid + slug pattern** (lines 83–87, `skipCurrentCycleSchema`):
```typescript
export const skipCurrentCycleSchema = z.object({
  householdId: z.cuid(),
  householdSlug: z.string().min(1),
});
export type SkipCurrentCycleInput = z.infer<typeof skipCurrentCycleSchema>;
```

**Schema with a third field pattern** (lines 74–78, `deleteAvailabilitySchema`):
```typescript
export const deleteAvailabilitySchema = z.object({
  availabilityId: z.cuid(),
  householdSlug: z.string().min(1),
});
```

**Phase 2 D-04 hidden-field convention (binding):** Every mutating schema includes `householdId: z.cuid()` and `householdSlug: z.string().min(1)` as grepping anchors, even when `householdId` can be derived server-side from the entity row (CONTEXT.md D-16 discretion: grep-consistency wins).

**Enum schema pattern** (lines 10–11):
```typescript
export const householdRoleSchema = z.enum(["OWNER", "MEMBER"]);
export type HouseholdRole = z.infer<typeof householdRoleSchema>;
```

**JSDoc convention:** Each schema export carries a `/** REQ-ID / D-NN: one-line purpose */` comment block. Match this for all Phase 4 additions.

---

### `src/lib/crypto.ts` (new)

**Analog:** `src/lib/slug.ts` (same file — both are `node:crypto`-based generator utilities)

**Imports pattern** (`src/lib/slug.ts`, line 1):
```typescript
import { randomBytes } from "crypto";
```

**For Phase 4, use the `node:crypto` namespaced import** (RESEARCH.md Pattern 1 — consistent with Node 18+ best practice; `slug.ts` uses the non-namespaced `"crypto"` but RESEARCH.md specifies `"node:crypto"` — use `"node:crypto"` in the new file):
```typescript
import { randomBytes, createHash } from "node:crypto";

export function generateInvitationToken(): { rawToken: string; tokenHash: string } {
  const rawToken = randomBytes(32).toString("hex"); // 256 bits of entropy (D-01)
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  return { rawToken, tokenHash };
}

export function hashInvitationToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}
```

**Note:** `slug.ts` uses rejection-sampling for alphabet-constrained slugs; `crypto.ts` for invitation tokens just uses raw hex — simpler pattern, no bias concern.

---

### `auth.config.ts` (modify — split publicPaths into two lists)

**Analog:** `auth.config.ts` itself (current file, lines 1–32)

**Current `authorized` callback** (lines 11–28):
```typescript
authorized({ auth, request: { nextUrl } }) {
  const isLoggedIn = !!auth?.user;
  const publicPaths = ["/login", "/register", "/demo"];
  const isPublicRoute = publicPaths.some(
    (path) =>
      nextUrl.pathname === path || nextUrl.pathname.startsWith(path + "/"),
  );

  if (isPublicRoute) {
    // Redirect logged-in users away from auth pages to dashboard
    if (isLoggedIn) {
      return Response.redirect(new URL("/dashboard", nextUrl));
    }
    return true;
  }

  // All other routes require authentication
  return isLoggedIn;
},
```

**Required change — add `noRedirectPublicPaths` list** (RESEARCH.md Pattern 4):
```typescript
authorized({ auth, request: { nextUrl } }) {
  const isLoggedIn = !!auth?.user;
  const publicPaths = ["/login", "/register", "/demo"];
  const noRedirectPublicPaths = ["/join"]; // logged-in users stay on these pages

  const isPublicRoute = publicPaths.some(
    (path) => nextUrl.pathname === path || nextUrl.pathname.startsWith(path + "/"),
  );
  const isNoRedirectPublic = noRedirectPublicPaths.some(
    (path) => nextUrl.pathname === path || nextUrl.pathname.startsWith(path + "/"),
  );

  if (isNoRedirectPublic) {
    return true; // allow both logged-in and logged-out; no redirect
  }

  if (isPublicRoute) {
    if (isLoggedIn) {
      return Response.redirect(new URL("/dashboard", nextUrl));
    }
    return true;
  }

  return isLoggedIn;
},
```

**Critical:** `isNoRedirectPublic` check must come BEFORE `isPublicRoute` check. `/join` would match neither `publicPaths` list anyway, but the guard order makes intent explicit for future maintainers.

---

### `proxy.ts` (modify — add `join` to exclusion regex)

**Analog:** `proxy.ts` itself (current file, lines 1–9)

**Current matcher** (lines 3–8):
```typescript
export const config = {
  matcher: [
    "/((?!api/auth|api/cron|_next/static|_next/image|favicon.ico|login|register|demo).*)",
  ],
};
```

**Required change — additive regex token** (RESEARCH.md Pattern 4, Pitfall 3):
```typescript
export const config = {
  matcher: [
    "/((?!api/auth|api/cron|_next/static|_next/image|favicon.ico|login|register|demo|join).*)",
  ],
};
```

**Note:** The top line `export { auth as proxy } from "./auth";` stays unchanged. Only the `config.matcher` regex changes.

---

### `auth.ts` (modify — add `unstable_update` to exports)

**Analog:** `auth.ts` itself (current file, line 9)

**Current export** (line 9):
```typescript
export const { auth, handlers, signIn, signOut } = NextAuth({
```

**Required change** (RESEARCH.md Pattern 3, Pitfall 4):
```typescript
export const { auth, handlers, signIn, signOut, unstable_update } = NextAuth({
```

**No other changes to `auth.ts`.** The JWT callback and session callback are untouched — `unstable_update` patches the cookie directly; the existing `session` callback's `token.activeHouseholdId` passthrough already handles the updated value on subsequent requests.

---

### `src/app/join/[token]/page.tsx` (new — public Server Component)

**Analog:** `src/app/(main)/h/[householdSlug]/dashboard/page.tsx`

**Imports pattern** (lines 1–16 of dashboard page):
```typescript
import { auth } from "../../../../auth";  // adjust depth for join/[token]/
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { Leaf, XCircle, ShieldOff, CheckCircle2, Home, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { resolveInvitationByToken } from "@/features/household/queries";
import { AcceptForm } from "./accept-form";
```

**Server Component page skeleton** (lines 114–162 of dashboard page):
```typescript
export const metadata: Metadata = {
  robots: { index: false, follow: false }, // UI-SPEC §access: prevent token indexing
};

export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;   // Next.js 16: params is a Promise
  const session = await auth();     // null for logged-out visitors (public route)

  const resolved = await resolveInvitationByToken(token);
  // D-09 branch selection happens here...
}
```

**Note on `params` as `Promise`:** The existing dashboard page uses `const { householdSlug } = await params;` (line 124) — Next.js 16 async params is the established convention in this codebase. Copy it exactly.

**EmptyState usage pattern** (lines 86–96 of dashboard page):
```typescript
return (
  <EmptyState
    icon={XCircle}
    iconVariant="muted"
    heading="This invite link isn't valid"
    body="The link may be mistyped..."
    action={
      <Link href="/">
        <Button variant="outline">Go to Plant Minder</Button>
      </Link>
    }
  />
);
```

**Outer shell structure** (UI-SPEC §Visual Contract):
```typescript
<main className="min-h-screen flex flex-col items-center bg-background px-4 py-8">
  <div className="w-full max-w-md space-y-8">
    <Link href="/" className="flex items-center gap-2 text-foreground">
      <Leaf className="h-5 w-5 text-accent" aria-hidden />
      <span className="text-base font-semibold">Plant Minder</span>
    </Link>
    {/* branch content */}
  </div>
</main>
```

---

### `src/app/join/[token]/accept-form.tsx` (new — Client Component)

**Analog:** `src/components/reminders/plant-reminder-toggle.tsx` (Client Component with `isPending` state + `toast.error` on error)

**Imports and `"use client"` directive** (`plant-reminder-toggle.tsx`, lines 1–6):
```typescript
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { acceptInvitation } from "@/features/household/actions";
```

**isPending pattern** (`plant-reminder-toggle.tsx`, lines 24–41):
```typescript
const [isPending, setIsPending] = useState(false);

async function handleSubmit() {
  setIsPending(true);
  const result = await acceptInvitation({ token });
  setIsPending(false);
  if ("error" in result) {
    toast.error(result.error);
    return;
  }
  // Server Action calls redirect() server-side on success — no client navigation needed
}
```

**No `useActionState` in codebase yet.** The established pattern is `useState(false)` + manual `setIsPending`. Use that. The UI-SPEC calls for `disabled={isPending}` which this pattern delivers.

**Button disabled pattern:**
```typescript
<Button
  type="submit"
  variant="default"
  disabled={isPending}
  className="min-h-[44px] w-full"
>
  Accept and join
</Button>
```

---

### `src/components/household/destructive-leave-dialog.tsx` (new — Client Component)

**Analog:** `src/components/watering/log-watering-dialog.tsx` (controlled `ResponsiveDialog` + `isPending` + `toast.error`)

**Imports pattern** (`log-watering-dialog.tsx`, lines 1–18):
```typescript
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
} from "@/components/shared/responsive-dialog";
import { Button } from "@/components/ui/button";
```

**Controlled open/onOpenChange pattern** (`log-watering-dialog.tsx`, lines 54–69):
```typescript
interface DestructiveLeaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  householdName: string;
  plantCount: number;
  roomCount: number;
  onConfirm: () => Promise<void>;
}

export function DestructiveLeaveDialog({
  open,
  onOpenChange,
  householdName,
  plantCount,
  roomCount,
  onConfirm,
}: DestructiveLeaveDialogProps) {
```

**isPending + prevent-close-while-pending pattern** (`log-watering-dialog.tsx`, lines 79–87):
```typescript
const [isPending, setIsPending] = useState(false);

async function handleConfirm() {
  setIsPending(true);
  try {
    await onConfirm();
  } finally {
    setIsPending(false);
  }
}

function handleOpenChange(isOpen: boolean) {
  if (isPending) return; // prevent close-on-outside-click while pending
  onOpenChange(isOpen);
}
```

**ResponsiveDialog usage pattern** (mirrors `log-watering-dialog.tsx` lines 130–253 — controlled variant):
```typescript
return (
  <ResponsiveDialog open={open} onOpenChange={handleOpenChange}>
    <ResponsiveDialogContent>
      <ResponsiveDialogHeader>
        <ResponsiveDialogTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden />
          Delete {householdName} and leave?
        </ResponsiveDialogTitle>
        <ResponsiveDialogDescription>
          You're the only member and the only owner...
        </ResponsiveDialogDescription>
      </ResponsiveDialogHeader>
      {/* cascade list content */}
      <ResponsiveDialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Keep my household
        </Button>
        <Button variant="destructive" onClick={handleConfirm} disabled={isPending}>
          Delete household and leave
        </Button>
      </ResponsiveDialogFooter>
    </ResponsiveDialogContent>
  </ResponsiveDialog>
);
```

---

### `tests/phase-04/*.test.ts` (new — 14 test files)

**Analogs:** `tests/phase-03/skip-current-cycle.test.ts` (mocked-Prisma unit tests), `tests/phase-03/transition-concurrency.test.ts` + `tests/household-integration.test.ts` (real-DB integration tests), `tests/phase-03/fixtures.ts` (fixture helpers)

#### Mocked-Prisma unit test skeleton

**Mock block pattern** (`skip-current-cycle.test.ts`, lines 1–45):
```typescript
import { expect, test, describe, vi, beforeEach } from "vitest";

vi.mock("@/generated/prisma/client", () => ({ PrismaClient: vi.fn() }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    invitation: { create: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    householdMember: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn(), aggregate: vi.fn() },
    household: { delete: vi.fn() },
    cycle: { findFirst: vi.fn() },
    availability: { deleteMany: vi.fn() },
  },
}));
vi.mock("../../auth", () => ({ auth: vi.fn(), unstable_update: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// For actions that call transitionCycle:
vi.mock("@/features/household/cycle", async () => {
  const actual = await vi.importActual<typeof import("@/features/household/cycle")>(
    "@/features/household/cycle",
  );
  return { ...actual, transitionCycle: vi.fn() };
});

// For actions that call requireHouseholdAccess:
vi.mock("@/features/household/guards", () => {
  class ForbiddenError extends Error {
    readonly name = "ForbiddenError" as const;
    readonly statusCode = 403 as const;
    constructor(message = "Access denied") {
      super(message);
      Object.setPrototypeOf(this, ForbiddenError.prototype);
    }
  }
  return { ForbiddenError, requireHouseholdAccess: vi.fn() };
});

beforeEach(() => {
  vi.clearAllMocks();
});
```

**Double-cast auth mock pattern** (STATE.md binding; `skip-current-cycle.test.ts`, lines 61–62):
```typescript
vi.mocked(auth).mockResolvedValue({
  user: { id: USER_ID, isDemo: false },
} as unknown as Awaited<ReturnType<typeof auth>>);
```

**Key:** Use `mockResolvedValue` (not `mockResolvedValueOnce`) for `auth` when the action calls it more than once internally (e.g. via `requireHouseholdAccess`). STATE.md: "[Phase 03-04] Mocked-Prisma tests for auth()-calling actions use mockResolvedValue".

**requireHouseholdAccess mock for OWNER-gate tests** (`skip-current-cycle.test.ts`, lines 183–187):
```typescript
vi.mocked(requireHouseholdAccess).mockResolvedValueOnce({
  household: { id: HOUSEHOLD_ID } as never,
  member: {} as never,
  role: "OWNER",
});
```

#### Real-DB integration test skeleton

**vi.mock + dynamic import pattern** (`transition-concurrency.test.ts`, lines 1–13):
```typescript
import { expect, test, describe, vi, afterAll, beforeEach } from "vitest";

vi.mock("../../auth", () => ({ auth: vi.fn(), unstable_update: vi.fn() }));

const { db } = await import("@/lib/db");
const { acceptInvitation } = await import("@/features/household/actions");
const { EMAIL_PREFIX, createHouseholdWithMembers } = await import("./fixtures");
```

**afterAll cleanup pattern** (`transition-concurrency.test.ts`, lines 19–42):
```typescript
afterAll(async () => {
  try {
    const users = await db.user.findMany({
      where: { email: { startsWith: EMAIL_PREFIX } },
      select: { id: true },
    });
    const userIds = users.map((u: { id: string }) => u.id);
    if (userIds.length > 0) {
      const memberships = await db.householdMember.findMany({
        where: { userId: { in: userIds } },
        select: { householdId: true },
      });
      const householdIds = [
        ...new Set(memberships.map((m: { householdId: string }) => m.householdId)),
      ];
      await db.user.deleteMany({ where: { id: { in: userIds } } });
      if (householdIds.length > 0) {
        await db.household.deleteMany({ where: { id: { in: householdIds } } });
      }
    }
  } finally {
    await db.$disconnect();
  }
});
```

#### `tests/phase-04/fixtures.ts` pattern

**fixtures.ts skeleton** (`tests/phase-03/fixtures.ts`, lines 1–149):
```typescript
import { randomUUID } from "node:crypto";

export const RUN_ID = `${Date.now()}-${randomUUID().slice(0, 8)}`;
export const EMAIL_PREFIX = `phase04-test-${RUN_ID}`;  // change prefix for phase 4

export function emailFor(userTag: string): string {
  return `${EMAIL_PREFIX}-${userTag}@test.local`;
}

async function getDb() {
  const mod = await import("@/lib/db");
  return mod.db;
}

// Add Phase 4-specific helpers:
// createHouseholdWithInvitation(memberCount) → { householdId, ownerId, invitationId, rawToken }
// Phase 4 fixtures extend the Phase 3 createHouseholdWithMembers helper (import and re-export it
// rather than copy it — keeps the fixture DRY).
```

---

## Shared Patterns

### Auth check (Step 1 — every Server Action)

**Source:** `src/features/household/actions.ts` lines 34–35
**Apply to:** All 6 new Server Actions

```typescript
const session = await auth();
if (!session?.user?.id) return { error: "Not authenticated." };
```

### Demo-mode guard (Step 2 — every Server Action)

**Source:** `src/features/household/actions.ts` lines 38–40
**Apply to:** All 6 new Server Actions
**Phase 4 exact copy string** (UI-SPEC §Server Action error strings):

```typescript
if (session.user.isDemo) {
  return { error: "This action is disabled in demo mode. Sign up to get your own household." };
}
```

Note: the existing actions use `"Demo mode — sign up to save your changes."` — Phase 4 uses the UI-SPEC-specified string above, which matches the project-wide demo guard wording for household-specific actions.

### Zod parse (Step 3 — every Server Action)

**Source:** `src/features/household/actions.ts` lines 43–44
**Apply to:** All 6 new Server Actions

```typescript
const parsed = theSchema.safeParse(data);
if (!parsed.success) return { error: "Invalid input." };
```

### requireHouseholdAccess + ForbiddenError forwarding (Step 4 — household-scoped actions)

**Source:** `src/features/household/actions.ts` lines 203–209
**Apply to:** `createInvitation`, `revokeInvitation`, `leaveHousehold`, `removeMember`, `promoteToOwner`, `demoteToMember` (NOT `acceptInvitation` — it has no household scope pre-check)

```typescript
let access: Awaited<ReturnType<typeof requireHouseholdAccess>>;
try {
  access = await requireHouseholdAccess(parsed.data.householdId);
} catch (err) {
  if (err instanceof ForbiddenError) return { error: err.message };
  throw err;
}
```

### revalidatePath (Step 7)

**Source:** `src/features/household/actions.ts` lines 169, 239, 285
**Apply to:** All Server Actions that mutate visible state

```typescript
revalidatePath(HOUSEHOLD_PATHS.settings, "page");  // invite list, member list
revalidatePath(HOUSEHOLD_PATHS.dashboard, "page"); // assignee banner after leave
```

### Error handling in Client Components (toast.error)

**Source:** `src/components/reminders/plant-reminder-toggle.tsx` lines 36–40
**Apply to:** `accept-form.tsx`, `destructive-leave-dialog.tsx`

```typescript
const result = await serverAction({ ... });
if (result?.error) {
  toast.error(result.error);
  return;
}
```

### `householdMember` compound key accessor

**Source:** `tests/household-integration.test.ts` lines 127–130 (confirmed via integration test)
**Apply to:** Any Prisma `findUnique`/`delete` by member composite key

```typescript
await db.householdMember.findUnique({
  where: {
    householdId_userId: { householdId: household.id, userId: user.id },
  },
});
// For delete:
await tx.householdMember.delete({
  where: { householdId_userId: { householdId, userId: session.user.id } },
});
```

---

## No Analog Found

No files in this phase lack an analog. All patterns have direct equivalents in the existing codebase.

---

## Key Patterns Summary for Planner

1. **All Server Actions follow the 7-step template exactly** — copy from `createHousehold` / `skipCurrentCycle` / `deleteAvailability` in `src/features/household/actions.ts`.
2. **Atomic `updateMany` for acceptance** — RESEARCH.md Pattern 2 is the authoritative pattern; no codebase analog exists yet (first use), but the `db.$transaction` wrapper pattern is established in `createHousehold`.
3. **`unstable_update` export** — surgical one-word addition to `auth.ts` line 9 destructuring. Server Actions then import it from `"../../../auth"` (the same relative path used for `auth`).
4. **auth.config.ts split** — two-list pattern (`publicPaths` + `noRedirectPublicPaths`); `isNoRedirectPublic` guard runs before `isPublicRoute`.
5. **proxy.ts matcher** — additive `|join` token at end of the negative lookahead group.
6. **Mocked-Prisma tests use `mockResolvedValue` (not Once) for auth** — STATE.md binding to avoid under-stubbing when `requireHouseholdAccess` calls `auth()` internally.
7. **Real-DB tests use `vi.mock("../../auth")` + dynamic `await import()`** — transition-concurrency.test.ts is the exact reference.
8. **Fixtures use `EMAIL_PREFIX` + `RUN_ID` namespacing** — change prefix to `phase04-test-` to isolate from Phase 3 test data.
9. **No `useActionState`** — the codebase uses `useState(false)` + `setIsPending` pattern (plant-reminder-toggle.tsx). Copy that; do not introduce `useActionState`.
10. **`ResponsiveDialog` controlled variant** — `log-watering-dialog.tsx` lines 231–253 show the controlled `open`/`onOpenChange` variant (no `<DialogTrigger>`). The destructive-leave dialog ships the controlled variant since Phase 6 owns the trigger.

---

## Metadata

**Analog search scope:** `src/features/household/`, `src/components/`, `src/app/`, `tests/`, root config files
**Files scanned:** 22 source files + 6 test files
**Pattern extraction date:** 2026-04-18

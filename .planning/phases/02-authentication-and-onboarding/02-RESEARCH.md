# Phase 2: Authentication and Onboarding - Research

**Researched:** 2026-04-14
**Domain:** NextAuth.js v5 + React Hook Form + Prisma schema migration + onboarding state
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Registration Form**
- D-01: Registration collects email, password, and confirm password (3 fields). No name field.
- D-02: Client-side validation errors display inline under each field (red text). Server errors (email already taken, network failure) display as toast notifications.
- D-03: After successful registration, user is auto-logged in and redirected straight to the dashboard — no separate login step, no onboarding gate.

**Login Form**
- D-04: Login and register pages cross-link to each other.
- D-05: App root (`/`) redirects to `/dashboard` if logged in, `/login` if not.

**Onboarding Flow**
- D-06: Onboarding appears as a dismissible banner/card at the top of the dashboard on first visit — not a modal, not a separate page.
- D-07: Onboarding collects plant count only via quick-range buttons: "1-5 plants", "6-15 plants", "16-30 plants", "30+ plants".
- D-08: No reminder preference in onboarding. Reminders default to on.
- D-09: User can dismiss the onboarding banner at any time without completing it. A subtle "Complete setup" link in nav or settings lets them return.
- D-10: After completing onboarding, banner collapses (subtle animation).
- D-11: Onboarding banner uses a nature-themed accent style — soft green gradient or plant-inspired illustration. Built on shadcn Card.

### Claude's Discretion
- Auth error handling details — generic vs specific messages for failed login, rate limiting approach
- Password requirements beyond Zod min(6) validation
- Loading states and transitions during auth flows
- Logout button placement
- Session expiry behavior and re-authentication UX
- Exact onboarding banner animation and dismiss behavior
- Where the "Complete setup" return link lives (nav vs settings)
- Schema migration approach for adding onboarding fields to User model

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | User can create an account with email and password | Registration Server Action pattern: hash password with bcryptjs, call `db.user.create`, then call NextAuth `signIn("credentials", ...)` to auto-login. Schema has email+passwordHash already. |
| AUTH-02 | User can log in and stay logged in across browser refresh (JWT session) | JWT strategy already configured in `auth.config.ts`. `session.strategy: "jwt"` means no DB session table needed. `auth()` in Server Components reads the JWT cookie on every request. |
| AUTH-03 | User can log out from any page | NextAuth v5 `signOut()` Server Action called from a Client Component button. Redirect to `/login` after sign-out. |
| AUTH-04 | User goes through minimal onboarding after first login (plant count, reminder preference) | Add `onboardingCompleted Boolean @default(false)` and `plantCountRange String?` to User model. Dashboard Server Component reads `user.onboardingCompleted` and conditionally renders the banner. Server Action marks completion. |
| AUTH-05 | Authenticated routes are protected — unauthenticated users redirected to login | Already implemented via `auth.config.ts` authorized callback + `proxy.ts` matcher. Verify `/` root redirect behavior covers D-05. |
</phase_requirements>

---

## Summary

Phase 2 builds on a complete NextAuth v5 infrastructure from Phase 1. The auth scaffolding (JWT config, Credentials provider with bcrypt, proxy.ts matcher, route groups) is all in place — this phase only needs to add the UI layer (login form, register form, dashboard shell with onboarding banner) and two new Prisma fields on User.

The biggest implementation concern is the registration flow: creating a user via a Server Action, then immediately calling `signIn("credentials", ...)` within the same action to auto-login. This requires careful handling because `signIn` in NextAuth v5 throws a redirect rather than returning — the Server Action must call it last and let the redirect propagate.

The onboarding banner is a self-contained Client Component that reads `onboardingCompleted` from server-fetched user data (passed as a prop). It needs a Server Action to persist the `plantCountRange` selection and flip `onboardingCompleted = true`. The banner must be dismissible without completion (which sets no DB state — just unmounts via React state).

**Primary recommendation:** Build registration as a `"use server"` action that creates the user, then calls `signIn`. Build the login page as a standard form that calls `signIn("credentials", ...)` directly. Build the onboarding banner as a Client Component with a Server Action for persistence.

---

## Standard Stack

All packages are already installed. No new installations required for this phase.

### Core (already installed — verified against package.json)

| Library | Installed Version | Purpose | Note |
|---------|------------------|---------|------|
| `next-auth` | `5.0.0-beta.30` [VERIFIED: package.json] | Auth session, signIn/signOut | Use `signIn`, `signOut`, `auth` exports from `./auth` |
| `react-hook-form` | `7.72.1` [VERIFIED: package.json] | Form state, validation trigger | Use `useForm` + `zodResolver` |
| `@hookform/resolvers` | `5.2.2` [VERIFIED: node_modules] | Connects Zod to RHF | Import `zodResolver` from `@hookform/resolvers/zod` |
| `zod` | `4.3.6` [VERIFIED: package.json] | Schema validation | Import from `"zod/v4"` — project convention |
| `prisma` | `7.7.0` [VERIFIED: package.json] | Schema migration | `npx prisma migrate dev` for adding onboarding fields |
| `bcryptjs` | `3.0.3` [VERIFIED: package.json] | Password hashing | Already used in `auth.ts` authorize callback |
| `lucide-react` | `1.8.0` [VERIFIED: package.json] | Icons (eye toggle, check, X) | For password visibility toggle and onboarding UI |
| `tw-animate-css` | `1.4.0` [VERIFIED: package.json] | Animation utilities | For banner collapse animation (D-10) |

### Existing shadcn Components Available

| Component | File | Use in Phase 2 |
|-----------|------|----------------|
| `Button` | `src/components/ui/button.tsx` | Form submit, onboarding range buttons, dismiss |
| `Card` | `src/components/ui/card.tsx` | Onboarding banner container (D-11) |
| `Input` | `src/components/ui/input.tsx` | Email, password, confirm password fields |
| `Label` | `src/components/ui/label.tsx` | Form field labels |
| `Skeleton` | `src/components/ui/skeleton.tsx` | Loading states during auth transitions |
| `Badge` | `src/components/ui/badge.tsx` | Could be used for range buttons styling |

### Components to Add via shadcn CLI

| Component | Purpose | Command |
|-----------|---------|---------|
| `toast` (Sonner) | Server error notifications (D-02) | `npx shadcn@latest add sonner` |
| `form` | shadcn Form wrapper for RHF integration | `npx shadcn@latest add form` |

**Note on `@hookform/resolvers` version:** Package.json pins `^5.2.2` but CLAUDE.md recommended `^3.x`. Version 5.x is installed and functional — verify zodResolver import path is `@hookform/resolvers/zod` (same in both major versions). [VERIFIED: node_modules shows 5.2.2 installed and working]

---

## Architecture Patterns

### Recommended Project Structure (new files this phase)

```
src/
├── features/
│   └── auth/
│       ├── actions.ts          # registerUser, updateOnboarding server actions
│       └── schemas.ts          # loginSchema, registerSchema, onboardingSchema (Zod)
├── components/
│   └── auth/
│       ├── login-form.tsx      # Client Component, uses useForm + zodResolver
│       └── register-form.tsx   # Client Component, uses useForm + zodResolver
├── components/
│   └── onboarding/
│       └── onboarding-banner.tsx  # Client Component, receives user prop
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx        # Import LoginForm (replace stub)
│   │   └── register/
│   │       └── page.tsx        # Import RegisterForm (replace stub)
│   ├── (main)/
│   │   └── dashboard/
│   │       └── page.tsx        # Server Component, reads auth(), renders OnboardingBanner
│   └── page.tsx                # Root redirect (Server Component)
```

### Pattern 1: Registration Server Action (Create User + Auto-Login)

**What:** A `"use server"` action that hashes password, creates user in DB, then calls `signIn` to auto-authenticate.

**Critical gotcha:** `signIn("credentials", {...})` in NextAuth v5 **throws a redirect** (a `NEXT_REDIRECT` error). It does not return. The action must call it as the last statement and must not wrap it in try/catch that swallows the redirect. [ASSUMED — based on NextAuth v5 patterns; verify against current Auth.js v5 docs]

```typescript
// src/features/auth/actions.ts
"use server";

import { signIn } from "../../../auth";
import { db } from "@/lib/db";
import bcryptjs from "bcryptjs";
import { registerSchema } from "./schemas";
import { z } from "zod/v4";

export async function registerUser(formData: z.infer<typeof registerSchema>) {
  // 1. Validate
  const parsed = registerSchema.safeParse(formData);
  if (!parsed.success) return { error: "Invalid input" };

  // 2. Check email uniqueness
  const existing = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return { error: "Email already in use" };

  // 3. Hash password
  const passwordHash = await bcryptjs.hash(parsed.data.password, 12);

  // 4. Create user
  await db.user.create({
    data: { email: parsed.data.email, passwordHash },
  });

  // 5. Auto-login — throws NEXT_REDIRECT, must be last
  await signIn("credentials", {
    email: parsed.data.email,
    password: parsed.data.password,
    redirectTo: "/dashboard",
  });
}
```

**Source:** [ASSUMED — Auth.js v5 patterns; cross-reference https://authjs.dev/getting-started/authentication/credentials]

### Pattern 2: Login Form Client Component

**What:** A Client Component using `useForm` + `zodResolver`. On submit, calls `signIn("credentials", {...})` directly (not through a custom Server Action).

**Why direct signIn:** For login, NextAuth v5's `signIn` handles the entire flow including redirect. Wrapping in a custom action adds no value. [ASSUMED]

```typescript
// src/components/auth/login-form.tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";  // client-side import
import { loginSchema } from "@/features/auth/schemas";

// ... form using Form, FormField, Input, Button from shadcn
```

**Important import distinction:**
- Server Components / Server Actions: `import { signIn, signOut } from "../../../auth"` (the auth.ts export)
- Client Components: `import { signIn } from "next-auth/react"` (the React-specific client package)

[ASSUMED — standard NextAuth v5 pattern; verify against Auth.js v5 docs]

### Pattern 3: Root Page Redirect (D-05)

**What:** The root `page.tsx` at `/` is a Server Component that checks auth and redirects.

```typescript
// src/app/page.tsx
import { auth } from "../../auth";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await auth();
  if (session) redirect("/dashboard");
  else redirect("/login");
}
```

**Note:** `proxy.ts` matcher currently allows `/` through (not matched by the exclusion pattern). The root page redirect handles D-05 correctly without changing `proxy.ts`. [VERIFIED: proxy.ts matcher reviewed — the `(?!api|_next/static|_next/image|favicon.ico|login|register)` regex does match `/`, so the authorized callback will also fire. Current `authorized` callback returns `true` for unprotected routes that are not auth pages, so unauthenticated users reach the root — the server component redirect is the correct layer.]

### Pattern 4: Onboarding State in Prisma

**What:** Add two fields to User model. Run migration.

```prisma
model User {
  // ... existing fields ...
  onboardingCompleted Boolean @default(false)
  plantCountRange     String?
}
```

Migration command: `npx prisma migrate dev --name add-onboarding-fields`

**The banner reads this server-side:**

```typescript
// src/app/(main)/dashboard/page.tsx
import { auth } from "../../../../auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { OnboardingBanner } from "@/components/onboarding/onboarding-banner";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { onboardingCompleted: true, plantCountRange: true },
  });

  return (
    <main>
      {!user?.onboardingCompleted && (
        <OnboardingBanner userId={session.user.id} />
      )}
      {/* dashboard content */}
    </main>
  );
}
```

**Note:** NextAuth v5 JWT session only includes `id`, `email`, `name` by default. To get `user.id` in `session.user`, the `auth.ts` needs a `session` callback that copies the JWT `sub` to `session.user.id`. Check if Phase 1 set this up. [ASSUMED — standard NextAuth v5 pattern for accessing user ID]

### Pattern 5: Onboarding Banner Client Component

**What:** Self-contained Client Component that manages its own dismiss state locally (React useState) without any DB write. Completing onboarding (selecting a range + confirming) calls a Server Action.

```typescript
// src/components/onboarding/onboarding-banner.tsx
"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { completeOnboarding } from "@/features/auth/actions";

const PLANT_RANGES = ["1-5 plants", "6-15 plants", "16-30 plants", "30+ plants"];

export function OnboardingBanner({ userId }: { userId: string }) {
  const [dismissed, setDismissed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);

  if (dismissed) return null;

  async function handleComplete() {
    if (!selected) return;
    setCompleting(true);
    await completeOnboarding({ userId, plantCountRange: selected });
    setDismissed(true);
  }

  return (
    <Card className="...nature-themed styles...">
      {/* range buttons */}
      {/* complete + dismiss buttons */}
    </Card>
  );
}
```

### Pattern 6: Auth.ts Session Callback for User ID

**What:** NextAuth v5 JWT sessions store the user ID in `token.sub`, but `session.user.id` is not set by default. To access `user.id` in Server Components, add session/jwt callbacks.

```typescript
// auth.ts addition
callbacks: {
  ...authConfig.callbacks,
  async jwt({ token, user }) {
    if (user) token.id = user.id;
    return token;
  },
  async session({ session, token }) {
    if (token.id) session.user.id = token.id as string;
    return session;
  },
},
```

And extend the Session type in `next-auth.d.ts`:
```typescript
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}
```

[ASSUMED — standard NextAuth v5 augmentation; verify against https://authjs.dev/getting-started/typescript]

### Anti-Patterns to Avoid

- **Calling `signIn` inside a try/catch that catches all errors:** `signIn` throws `NEXT_REDIRECT`. Catching it prevents the redirect from propagating. Use `isRedirectError(error)` from `next/navigation` to re-throw redirect errors specifically.
- **Using `middleware.ts`:** Deprecated in Next.js 16. Already using `proxy.ts` — do not add or reference `middleware.ts`.
- **Using `import { z } from "zod"` (v3 compat):** Project convention is `import { z } from "zod/v4"`.
- **Fetching user data in Client Components:** Always fetch onboarding state server-side in the dashboard Server Component and pass as props.
- **Blocking the dashboard with onboarding:** D-06 explicitly says dashboard content is visible below the banner. Never gate the route.
- **Using `next-auth/react` for Server Actions:** Use `import { signIn, signOut } from "../../../auth"` (the local auth.ts export) in Server Actions. `next-auth/react` is for Client Components only.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing | Custom hash function | `bcryptjs` (already in deps) | bcrypt handles salt, rounds, timing attack resistance |
| Form validation error display | Custom error state | `react-hook-form` + `FormMessage` shadcn component | RHF manages error state, dirty state, touched state per field |
| JWT session management | Custom cookie/token logic | NextAuth v5 JWT strategy | NextAuth handles signing, rotation, expiry, and CSRF protection |
| Toast notifications | Custom toast component | shadcn `sonner` (add this phase) | Server error display (D-02) needs toast — don't build from scratch |
| Form submission loading state | Manual `useState(loading)` | RHF `formState.isSubmitting` | RHF tracks async submission state automatically |
| Redirect after auth | Manual `router.push()` | NextAuth `redirectTo` option + `redirect()` from next/navigation | NextAuth handles post-auth redirect; Server Components use `redirect()` |

**Key insight:** The auth domain has deceptively complex edge cases (CSRF, timing attacks, session invalidation, concurrent requests during password creation). Every custom solution re-discovers these failures. The combination of NextAuth + bcryptjs + RHF covers all of them with zero custom crypto.

---

## Common Pitfalls

### Pitfall 1: signIn() Swallowed by try/catch in Server Action
**What goes wrong:** Registration Server Action wraps everything in try/catch. `signIn` throws `NEXT_REDIRECT` which gets caught and silently discarded. User is registered but not logged in, and no redirect happens — the form hangs.

**Why it happens:** `NEXT_REDIRECT` is implemented as a thrown error (not a returned value) in Next.js. Any catch block that doesn't distinguish redirect errors will suppress it.

**How to avoid:**
```typescript
import { isRedirectError } from "next/dist/client/components/redirect-error";

try {
  await signIn("credentials", { redirectTo: "/dashboard", ... });
} catch (error) {
  if (isRedirectError(error)) throw error; // Re-throw redirect
  return { error: "Login failed" };
}
```
[ASSUMED — documented Next.js pattern; verify path in Next.js 16]

**Warning signs:** Registration "succeeds" (user appears in DB) but browser stays on register page with no redirect.

### Pitfall 2: Missing `session.user.id` from JWT Token
**What goes wrong:** Dashboard Server Component calls `auth()`, gets `session.user`, but `session.user.id` is `undefined`. DB queries for onboarding state fail.

**Why it happens:** NextAuth v5 JWT session includes `sub` (user ID) but does NOT automatically populate `session.user.id`. Requires explicit `jwt` and `session` callbacks.

**How to avoid:** Add jwt/session callbacks to `auth.ts` (Pattern 6 above). TypeScript will catch missing `id` if you extend the Session type in `next-auth.d.ts`.

**Warning signs:** TypeScript error on `session.user.id`, or DB queries with `userId: undefined` returning all records or throwing.

### Pitfall 3: Infinite Redirect Loop at Root
**What goes wrong:** Root `/` page.tsx calls `redirect("/login")`. `proxy.ts` matcher fires on every request including `/`, and the `authorized` callback also checks the route. If not handled correctly, `/login` → authorized check → redirect back to `/` → redirect to `/login`... loop.

**Why it happens:** The authorized callback in `auth.config.ts` redirects authenticated users away from `/login`. The root page redirects unauthenticated users to `/login`. These two rules should not conflict, but if `proxy.ts` fires on `/login` and the authorized callback redirects incorrectly, a loop forms.

**How to avoid:** The current `proxy.ts` matcher explicitly excludes `login` and `register` from the matcher. Confirm this is still correct after any proxy.ts changes. The current exclusion pattern `(?!...login|register)` means auth pages bypass the authorized callback entirely.

**Warning signs:** Browser shows "Too many redirects" or Chrome's redirect loop error.

### Pitfall 4: Onboarding Banner Re-appearing After Completion
**What goes wrong:** User completes onboarding. Banner dismisses (React state). On next page load, `onboardingCompleted` is still `false` in the DB because the Server Action failed silently or the `router.refresh()` was not called.

**Why it happens:** The Server Action sets `onboardingCompleted = true` in Prisma, but the dashboard page was already server-rendered with the old data. Without a router refresh, the cached server render still shows the banner.

**How to avoid:** After calling `completeOnboarding` Server Action, call `router.refresh()` (from `useRouter`) to revalidate the server component. Alternatively, use `revalidatePath("/dashboard")` inside the Server Action.

**Warning signs:** Banner re-appears after browser refresh despite successful DB update.

### Pitfall 5: Password Confirm Mismatch Validation
**What goes wrong:** Client-side Zod schema has `confirmPassword` field, but `auth.ts` authorize function only validates `email` + `password`. If the registration form passes data through a different schema, confirm-password mismatch may not be caught.

**Why it happens:** Two separate schemas exist: one for the registration form (with `confirmPassword`) and one in `auth.ts` for the Credentials provider (without it). Zod refine for password matching must be in the form schema only, not passed to the backend.

**How to avoid:** Registration schema has `.refine()` for password matching. The Server Action strips `confirmPassword` before creating the user. [VERIFIED: auth.ts only accepts email + password — no confirm field, as expected]

### Pitfall 6: @hookform/resolvers v5 API Change
**What goes wrong:** Code examples from CLAUDE.md or docs reference `@hookform/resolvers@3.x` patterns. Installed version is 5.2.2 — if there are breaking API changes, the integration fails silently or throws at runtime.

**Why it happens:** CLAUDE.md recommended `^3.x` but the project installed `5.2.2`. Version 5 may have API differences.

**How to avoid:** Use `zodResolver` from `@hookform/resolvers/zod` — this import path is stable across major versions. Verify actual API at runtime.

**Warning signs:** TypeScript errors on zodResolver import or runtime "resolver is not a function" errors.

---

## Code Examples

### Zod Schema for Registration (with confirm password refine)
```typescript
// src/features/auth/schemas.ts
import { z } from "zod/v4";

export const loginSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const registerSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export const onboardingSchema = z.object({
  plantCountRange: z.enum(["1-5 plants", "6-15 plants", "16-30 plants", "30+ plants"]),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type OnboardingInput = z.infer<typeof onboardingSchema>;
```

### shadcn Form + RHF Integration Pattern
```typescript
// Used in login-form.tsx and register-form.tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { loginSchema, type LoginInput } from "@/features/auth/schemas";

export function LoginForm() {
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    // signIn from next-auth/react for client components
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl><Input type="email" {...field} /></FormControl>
              <FormMessage /> {/* inline error, red text (D-02) */}
            </FormItem>
          )}
        />
        {/* ... */}
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Signing in..." : "Sign in"}
        </Button>
      </form>
    </Form>
  );
}
```

### Complete Onboarding Server Action
```typescript
// src/features/auth/actions.ts
"use server";

import { db } from "@/lib/db";
import { onboardingSchema } from "./schemas";
import { revalidatePath } from "next/cache";

export async function completeOnboarding(data: {
  userId: string;
  plantCountRange: string;
}) {
  const parsed = onboardingSchema.safeParse({ plantCountRange: data.plantCountRange });
  if (!parsed.success) return { error: "Invalid selection" };

  await db.user.update({
    where: { id: data.userId },
    data: {
      onboardingCompleted: true,
      plantCountRange: parsed.data.plantCountRange,
    },
  });

  revalidatePath("/dashboard"); // Revalidate so banner disappears on next render
}

export async function dismissOnboarding(userId: string) {
  // Dismiss without completing — no DB write needed
  // Banner state managed in React component state only
  // This action is a no-op; included here for documentation clarity
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` | `proxy.ts` | Next.js 16 | Must use `proxy.ts`; `middleware.ts` deprecated but still works |
| `next-auth@4.x` (Pages Router) | `next-auth@5.0.0-beta.30` (App Router) | 2023+ | v5 is required for App Router; v4 breaks Server Components |
| `import { z } from "zod"` | `import { z } from "zod/v4"` | zod@4.x | Performance improvement + new features; v3 compat path still works |
| `getServerSession()` in Next.js pages | `auth()` in Server Components | Auth.js v5 | Simpler API; works in RSC, Server Actions, and route handlers |
| `useServerAction` pattern | Direct Server Action import + call | Next.js 13.4+ | Server Actions are stable; no wrapper library needed |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `signIn()` in Server Actions throws NEXT_REDIRECT and requires `isRedirectError` re-throw | Pattern 1, Pitfall 1 | Registration works but auto-login silently fails; redirect never happens |
| A2 | `session.user.id` requires explicit jwt/session callbacks in NextAuth v5 | Pattern 6, Pitfall 2 | Dashboard page cannot query DB for onboarding state |
| A3 | `next-auth/react`'s `signIn` is for Client Components; `auth.ts` exports for Server | Pattern 2 | Import from wrong module causes runtime error |
| A4 | `@hookform/resolvers` v5.2.2 has the same `zodResolver` API as v3 | Standard Stack | Form validation silently fails or throws at setup |
| A5 | `isRedirectError` import path is `next/dist/client/components/redirect-error` in Next.js 16 | Pitfall 1 | Pattern must be updated; verify in Next.js 16 source |

---

## Open Questions

1. **Does `auth.ts` need jwt/session callbacks added, or does Phase 1 already include them?**
   - What we know: The `auth.ts` in the codebase does NOT include jwt/session callbacks. It only has the Credentials provider.
   - What's unclear: `token.sub` is the user ID in NextAuth JWT — some versions auto-populate `session.user.id` from `sub`, others don't.
   - Recommendation: Add jwt/session callbacks in Wave 1 of the plan and add a TypeScript type augmentation to verify at compile time.

2. **Does shadcn `form` component need to be added via CLI, or is it already available?**
   - What we know: `src/components/ui/` has button, card, input, label, skeleton, badge, separator — no `form.tsx`.
   - What's unclear: The shadcn `Form` component wraps RHF's FormProvider — it's required for the `FormField`/`FormMessage` pattern.
   - Recommendation: Add `form` component in Wave 0 (setup) via `npx shadcn@latest add form`. Also add `sonner` for toast notifications.

3. **What is the exact `isRedirectError` import path in Next.js 16?**
   - What we know: In Next.js 14-15, it was `next/dist/client/components/redirect-error`.
   - What's unclear: Next.js 16 may have moved or exported this utility differently.
   - Recommendation: Check `node_modules/next/dist` at implementation time, or use the pattern of catching only non-redirect errors by checking `error.digest?.startsWith("NEXT_REDIRECT")`.

---

## Environment Availability

Phase 2 is code-only changes (new UI components, Server Actions, one Prisma migration). No new external services required.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL | Prisma migration | Must be running | 17.x (per project setup) | — (required) |
| `npx prisma` CLI | Schema migration | ✓ | 7.7.0 [VERIFIED: package.json] | — |
| Node.js | All JS execution | ✓ | 20+ (per Next.js 16 requirement) | — |

**Missing dependencies with no fallback:** None beyond a running PostgreSQL instance for running migrations.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npx vitest run tests/auth.test.ts` |
| Full suite command | `npx vitest run` |

**Test file location:** `tests/` (configured in `vitest.config.ts` as `include: ["tests/**/*.{test,spec}.{ts,tsx}"]`)

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | registerUser action creates user with hashed password | unit | `npx vitest run tests/auth.test.ts` | ❌ Wave 0 |
| AUTH-01 | registerUser returns error for duplicate email | unit | `npx vitest run tests/auth.test.ts` | ❌ Wave 0 |
| AUTH-01 | Registration form shows inline validation errors | component | `npx vitest run tests/register-form.test.tsx` | ❌ Wave 0 |
| AUTH-02 | Session persists after browser refresh | e2e | `npx playwright test tests/e2e/auth.spec.ts` | ❌ Wave 0 |
| AUTH-03 | Logout redirects to /login | e2e | `npx playwright test tests/e2e/auth.spec.ts` | ❌ Wave 0 |
| AUTH-04 | OnboardingBanner renders when onboardingCompleted=false | component | `npx vitest run tests/onboarding-banner.test.tsx` | ❌ Wave 0 |
| AUTH-04 | completeOnboarding action sets onboardingCompleted=true | unit | `npx vitest run tests/auth.test.ts` | ❌ Wave 0 |
| AUTH-05 | Unauthenticated users are redirected from /dashboard | unit | `npx vitest run tests/auth.test.ts` (source inspection) | ✅ existing pattern |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/auth.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/auth.test.ts` — extend existing file with registerUser and completeOnboarding tests
- [ ] `tests/register-form.test.tsx` — component render + validation error tests
- [ ] `tests/onboarding-banner.test.tsx` — banner render, dismiss state, complete action tests
- [ ] `tests/e2e/auth.spec.ts` — Playwright: register → dashboard → logout flow
- [ ] shadcn `form` component: `npx shadcn@latest add form`
- [ ] shadcn `sonner` toast: `npx shadcn@latest add sonner`

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | NextAuth v5 Credentials provider + bcryptjs hash rounds=12 |
| V3 Session Management | yes | NextAuth JWT strategy — signed token, httpOnly cookie, SameSite |
| V4 Access Control | yes | `proxy.ts` + `auth.config.ts` authorized callback |
| V5 Input Validation | yes | Zod v4 on all form inputs + Server Action inputs |
| V6 Cryptography | yes | bcryptjs (do not hand-roll) |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Credential stuffing / brute force | Elevation of Privilege | [ASSUMED] NextAuth v5 beta.30 does not include built-in rate limiting — consider adding basic attempt counting at the Server Action level or via a middleware, or document as a known v1 gap |
| Password stored in plaintext | Information Disclosure | bcryptjs with 12 rounds — never store raw password |
| CSRF on Server Actions | Tampering | Next.js App Router Server Actions include built-in CSRF protection via origin verification [ASSUMED — documented Next.js 14+ behavior] |
| Session fixation | Elevation of Privilege | NextAuth v5 generates new JWT on each signIn — not reused |
| Verbose auth errors (user enumeration) | Information Disclosure | Return generic "Invalid credentials" for both wrong email and wrong password — D-02 specifies toast for server errors, so the message content is discretionary |

### Error Message Recommendation (Claude's Discretion)

Use **generic messages** to prevent user enumeration:
- Failed login: "Invalid email or password" (never distinguish between "email not found" vs "wrong password")
- Registration: "Unable to create account" for unexpected errors; "Email already in use" is acceptable for registration since the user is trying to create an account with their own email — the enumeration risk is minimal in this context [ASSUMED — standard industry practice]

---

## Sources

### Primary (HIGH confidence)
- `auth.config.ts`, `auth.ts`, `proxy.ts` — VERIFIED by direct file read: JWT strategy, Credentials provider, bcryptjs, Zod v4, proxy matcher all confirmed in place
- `package.json` — VERIFIED: next-auth@5.0.0-beta.30, next@16.2.2, react-hook-form@7.72.1, @hookform/resolvers@5.2.2, zod@4.3.6, bcryptjs@3.0.3, prisma@7.7.0
- `prisma/schema.prisma` — VERIFIED: User model has id, email, passwordHash, name, createdAt, updatedAt — no onboarding fields yet
- `vitest.config.ts` — VERIFIED: jsdom environment, tests/ directory, Vitest 4.1.4
- `tests/auth.test.ts` — VERIFIED: existing tests cover Phase 1 auth.ts/auth.config.ts structure; no Phase 2 tests yet
- `src/components/ui/` — VERIFIED: button, card, input, label, skeleton, badge, separator present; form and sonner missing
- `globals.css` — VERIFIED: OKLCH color system with `--color-accent: oklch(62% 0.10 155)` (green — correct for nature-themed onboarding D-11)

### Secondary (MEDIUM confidence)
- `CLAUDE.md` §What NOT to Use — confirms middleware.ts deprecated, proxy.ts required, zod/v4 import path required
- Auth.js v5 documentation patterns — standard Credentials + JWT + session callback pattern; cross-reference required at implementation

### Tertiary (LOW confidence — verify at implementation)
- A1–A5 in Assumptions Log — patterns based on NextAuth v5 training knowledge; verify against https://authjs.dev/getting-started/authentication/credentials and https://authjs.dev/getting-started/typescript

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified against package.json and node_modules
- Architecture: MEDIUM — patterns are well-established NextAuth v5 conventions, but 5 assumptions logged that must be verified at implementation time
- Pitfalls: MEDIUM — based on common NextAuth v5 gotchas from training; the `isRedirectError` path is LOW confidence for Next.js 16 specifically

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (NextAuth v5 is beta — check for beta version bumps before executing)

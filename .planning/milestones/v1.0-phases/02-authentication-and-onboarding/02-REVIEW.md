---
phase: 02-authentication-and-onboarding
reviewed: 2026-04-14T12:00:00Z
depth: standard
files_reviewed: 28
files_reviewed_list:
  - auth.config.ts
  - auth.ts
  - e2e/auth.spec.ts
  - package.json
  - prisma/schema.prisma
  - proxy.ts
  - src/app/(auth)/login/page.tsx
  - src/app/(auth)/register/page.tsx
  - src/app/(main)/dashboard/page.tsx
  - src/app/(main)/layout.tsx
  - src/app/api/auth/[...nextauth]/route.ts
  - src/app/globals.css
  - src/app/layout.tsx
  - src/app/page.tsx
  - src/components/auth/login-form.tsx
  - src/components/auth/logout-button.tsx
  - src/components/auth/register-form.tsx
  - src/components/onboarding/onboarding-banner.tsx
  - src/components/ui/form.tsx
  - src/components/ui/sonner.tsx
  - src/features/auth/actions.ts
  - src/features/auth/schemas.ts
  - src/lib/db.ts
  - src/types/next-auth.d.ts
  - tests/auth.test.ts
  - tests/onboarding-banner.test.tsx
  - tests/page.test.tsx
  - tests/register-form.test.tsx
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-04-14T12:00:00Z
**Depth:** standard
**Files Reviewed:** 28
**Status:** issues_found

## Summary

This review covers the authentication and onboarding implementation for Plant Minder: NextAuth v5 credentials provider, registration/login server actions, onboarding banner component, Prisma schema, proxy-based route protection, and associated client components.

The implementation is generally solid. The auth flow correctly separates edge-safe config (`auth.config.ts`) from Node.js-dependent auth logic (`auth.ts`), uses bcryptjs for password hashing with 12 rounds, validates input with Zod v4 schemas, and handles the `NEXT_REDIRECT` error propagation correctly in server actions. The Prisma schema is well-structured with proper cascade deletes and timezone-aware timestamps.

However, there is one critical authorization bypass in the `completeOnboarding` server action that must be fixed before merging, along with several warnings about defensive coding gaps.

## Critical Issues

### CR-01: Insecure Direct Object Reference (IDOR) in completeOnboarding

**File:** `src/features/auth/actions.ts:61-89`
**Issue:** The `completeOnboarding` server action accepts `userId` as a client-supplied parameter and uses it directly for the database update without verifying that the caller is the owner of that user ID. There is no `auth()` call to authenticate the request at all. Any client (including unauthenticated ones) can call this server action with any `userId` to modify another user's onboarding state and `plantCountRange`. This is a classic IDOR vulnerability.

The `userId` originates from `OnboardingBanner` props (set by the server in `dashboard/page.tsx`), but server actions are callable independently -- a malicious client can invoke the action directly with a forged `userId`.

**Fix:**
```typescript
export async function completeOnboarding(data: {
  plantCountRange: string;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Session expired. Please sign in again." };
  }

  const parsed = onboardingSchema.safeParse({
    plantCountRange: data.plantCountRange,
  });
  if (!parsed.success) {
    return { error: "Invalid selection." };
  }

  await db.user.update({
    where: { id: session.user.id },
    data: {
      onboardingCompleted: true,
      plantCountRange: parsed.data.plantCountRange,
    },
  });

  revalidatePath("/dashboard");
  return { success: true };
}
```

This also requires updating `OnboardingBanner` to stop passing `userId` to the action (the component can still receive it as a prop for other purposes, but the action should not accept it).

## Warnings

### WR-01: DATABASE_URL non-null assertion fails silently

**File:** `src/lib/db.ts:9`
**Issue:** The `!` non-null assertion on `process.env.DATABASE_URL!` will pass `undefined` to `PrismaPg` if the environment variable is not set, resulting in a confusing runtime error deep in the Prisma adapter rather than a clear startup failure.

**Fix:**
```typescript
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL environment variable is not set. Check your .env file."
  );
}

const adapter = new PrismaPg({ connectionString });
```

### WR-02: Route protection uses allowlist of protected paths instead of denylist of public paths

**File:** `auth.config.ts:13-16`
**Issue:** The `authorized` callback only protects routes starting with `/dashboard`, `/plants`, or `/rooms`. Any new routes added to the app (e.g., `/settings`, `/profile`, `/account`) will be unprotected by default. A safer pattern is to require authentication by default and explicitly list public paths.

**Fix:**
```typescript
authorized({ auth, request: { nextUrl } }) {
  const isLoggedIn = !!auth?.user;
  const publicPaths = ["/login", "/register"];
  const isPublicRoute = publicPaths.some(
    (path) => nextUrl.pathname === path || nextUrl.pathname.startsWith(path + "/")
  );

  if (isPublicRoute) {
    // Redirect logged-in users away from auth pages
    if (isLoggedIn) {
      return Response.redirect(new URL("/dashboard", nextUrl));
    }
    return true;
  }

  // All other routes require authentication
  return isLoggedIn;
},
```

### WR-03: Proxy matcher excludes all /api routes from authentication

**File:** `proxy.ts:4-7`
**Issue:** The matcher pattern `/((?!api|_next/static|_next/image|favicon.ico|login|register).*)` excludes ALL `/api/*` routes from the auth proxy. While `/api/auth/[...nextauth]` must be excluded (it handles its own auth), this blanket exclusion means any future API routes will be unprotected by default. If a developer adds `/api/plants` or `/api/users` later, those routes will have no proxy-level auth check.

**Fix:** Narrow the exclusion to only the NextAuth API routes:
```typescript
export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|login|register).*)",
  ],
};
```

### WR-04: useFormField guard runs after the value it guards is already used

**File:** `src/components/ui/form.tsx:42-51`
**Issue:** On line 47, `getFieldState(fieldContext.name, formState)` is called, which accesses `fieldContext.name`. The null check for `fieldContext` on line 49 runs after this access. If `fieldContext` is the empty default object (`{} as FormFieldContextValue`), then `fieldContext.name` is `undefined`, and `getFieldState(undefined, ...)` may produce unexpected results before the guard throws.

Note: This is a known shadcn/ui pattern. If you copied this from the shadcn CLI, it may be intentional (the empty-object default means `fieldContext` is always truthy, so the guard never fires). Consider either removing the dead guard or restructuring to check first:

**Fix:**
```typescript
const useFormField = () => {
  const fieldContext = React.useContext(FormFieldContext);
  if (!fieldContext.name) {
    throw new Error("useFormField should be used within <FormField>");
  }
  const itemContext = React.useContext(FormItemContext);
  const { getFieldState, formState } = useFormContext();
  const fieldState = getFieldState(fieldContext.name, formState);
  // ...
};
```

## Info

### IN-01: Relative import paths for auth module

**File:** `src/app/(main)/dashboard/page.tsx:1`, `src/app/(main)/layout.tsx:1`, `src/app/page.tsx:1`
**Issue:** These files use deep relative imports like `../../../../auth` and `../../../auth` instead of a path alias. This is fragile and inconsistent with the `@/` alias used everywhere else. The `auth.ts` file is in the project root, outside `src/`, so `@/` won't resolve to it directly, but a dedicated alias (e.g., `@auth`) or re-export from within `src/` would improve maintainability.

**Fix:** Add a path alias in `tsconfig.json`:
```json
{
  "compilerOptions": {
    "paths": {
      "@auth": ["./auth"]
    }
  }
}
```
Then import as `import { auth } from "@auth"`.

### IN-02: All test files contain only stubs

**Files:** `tests/auth.test.ts`, `tests/onboarding-banner.test.tsx`, `tests/register-form.test.tsx`, `e2e/auth.spec.ts`
**Issue:** All E2E tests use `test.fixme()` and unit tests use `test.todo()`. No actual test logic exists yet. The three implemented tests in `tests/auth.test.ts` (lines 4-37) only verify source file contents via string matching rather than testing behavior. This is understood as Wave 0 scaffolding per the plan, but means there is zero behavioral test coverage for the auth system.

### IN-03: CSS variable double-indirection in globals.css

**File:** `src/app/globals.css:7-93`
**Issue:** The `@theme` block (lines 7-31) defines color tokens directly (e.g., `--color-accent: oklch(62% 0.10 155)`). Then the `@theme inline` block (lines 52-93) redefines many of the same tokens to reference CSS custom properties (e.g., `--color-accent: var(--accent)`), and `:root` (lines 95-128) sets those custom properties. The `@theme inline` block overrides the `@theme` block, making the first `@theme` color definitions dead code. The spacing and font definitions in the first `@theme` block are still effective, but the color values there are never used. Consider consolidating to avoid confusion.

---

_Reviewed: 2026-04-14T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

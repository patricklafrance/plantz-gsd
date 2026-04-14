---
phase: 02-authentication-and-onboarding
plan: "01"
subsystem: auth
tags: [nextauth, prisma, zod, bcryptjs, shadcn, react-hook-form, sonner, typescript]

# Dependency graph
requires:
  - phase: 01-scaffold-and-foundations
    provides: "prisma schema, auth.ts+auth.config.ts split, db singleton, TypeScript+Tailwind+shadcn scaffold"
provides:
  - "User model with onboardingCompleted + plantCountRange fields"
  - "Zod v4 loginSchema, registerSchema, onboardingSchema with copywriting-contract error messages"
  - "NextAuth jwt+session callbacks propagating user.id to session.user.id"
  - "TypeScript module augmentation for session.user.id typed as string"
  - "registerUser Server Action with bcrypt hash, email uniqueness check, auto-login redirect"
  - "completeOnboarding Server Action with enum validation and revalidatePath"
  - "shadcn form component (FormField, FormItem, FormLabel, FormControl, FormMessage)"
  - "shadcn sonner component (Toaster) mounted in root layout"
affects:
  - "02-02 (login page)"
  - "02-03 (register page)"
  - "02-04 (onboarding page)"
  - "all subsequent phases consuming session.user.id"

# Tech tracking
tech-stack:
  added:
    - "sonner@2.0.7 (toast notifications)"
    - "next-themes@0.4.6 (theme-aware Toaster)"
  patterns:
    - "Server Actions with Zod safeParse then Prisma mutation"
    - "isRedirectError re-throw pattern for signIn auto-login"
    - "Zod v4 import path: zod/v4"
    - "shadcn Form component wrapping react-hook-form Controller"

key-files:
  created:
    - "src/features/auth/schemas.ts"
    - "src/features/auth/actions.ts"
    - "src/types/next-auth.d.ts"
    - "src/components/ui/form.tsx"
    - "src/components/ui/sonner.tsx"
  modified:
    - "prisma/schema.prisma (added onboardingCompleted, plantCountRange)"
    - "auth.ts (added jwt+session callbacks)"
    - "src/app/layout.tsx (added Toaster)"
    - "package.json (sonner, next-themes)"

key-decisions:
  - "form.tsx created manually: shadcn CLI with base-nova style silently skips form component without @radix-ui/react-label being installed as a direct dep; created equivalent using react-hook-form Controller + FormProvider pattern matching shadcn's form component API"
  - "prisma db push deferred: no DATABASE_URL set in worktree environment; prisma generate was run successfully and client types include new fields — db push must be done by user when PostgreSQL is available"
  - "sonner Toaster uses next-themes for theme-aware appearance; next-themes was installed as dep by shadcn CLI"

patterns-established:
  - "Pattern: Server Action error return shape — { error: string } | { success: true } | undefined (for redirect)"
  - "Pattern: isRedirectError re-throw — required in any Server Action using signIn() with redirectTo"
  - "Pattern: Zod v4 import — import { z } from 'zod/v4' (not 'zod')"
  - "Pattern: auth actions import signIn from relative path '../../../../auth' (3 parent traversals from src/features/auth/)"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, AUTH-04]

# Metrics
duration: 15min
completed: 2026-04-14
---

# Phase 2 Plan 01: Auth Infrastructure Summary

**NextAuth session callbacks propagating user.id, Zod v4 validation schemas, bcrypt registration action with auto-login, and shadcn form+sonner components installed**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-14T01:10:00Z
- **Completed:** 2026-04-14T01:28:00Z
- **Tasks:** 3 (Task 3 partially deferred — prisma generate done, db push needs DATABASE_URL)
- **Files modified:** 9

## Accomplishments

- Prisma User model extended with `onboardingCompleted` and `plantCountRange` fields; Prisma client regenerated with new types
- Zod v4 schemas for login (email + required password), register (email + min-6 password + match refine), and onboarding (plantCountRange enum) with exact UI-SPEC copywriting-contract error messages
- auth.ts upgraded with jwt+session callbacks spreading authConfig.callbacks, propagating user.id from JWT token to session.user.id; TypeScript augmentation in src/types/next-auth.d.ts ensures typed access
- registerUser Server Action: validates input, checks email uniqueness with friendly error message, hashes password with bcrypt (12 rounds), creates user, auto-logins via signIn with redirectTo /dashboard, correctly re-throws NEXT_REDIRECT errors
- completeOnboarding Server Action: validates plantCountRange against enum whitelist, updates User record with onboardingCompleted=true, revalidates /dashboard path
- shadcn sonner component installed (Toaster mounted in root layout); form.tsx created manually with full FormField/FormItem/FormLabel/FormControl/FormMessage API

## Task Commits

Each task was committed atomically:

1. **Task 1: Prisma schema + Zod schemas + NextAuth session callbacks + type augmentation** - `19a1ca6` (feat)
2. **Task 2: Install shadcn components + Server Actions + Toaster mount** - `1859d07` (feat)
3. **Task 3: Prisma generate (db push deferred)** - `85874b0` (chore)

## Files Created/Modified

- `prisma/schema.prisma` - Added onboardingCompleted Boolean @default(false) and plantCountRange String? to User model
- `src/features/auth/schemas.ts` - Zod v4 loginSchema, registerSchema (with .refine for password match), onboardingSchema with enum validation
- `src/types/next-auth.d.ts` - TypeScript module augmentation adding id: string to Session.user
- `auth.ts` - Added jwt callback (token.id = user.id) and session callback (session.user.id = token.id) spreading authConfig.callbacks
- `src/features/auth/actions.ts` - registerUser and completeOnboarding Server Actions with full validation, error handling, and isRedirectError re-throw pattern
- `src/components/ui/form.tsx` - shadcn Form component with FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage
- `src/components/ui/sonner.tsx` - shadcn Toaster component (theme-aware via next-themes)
- `src/app/layout.tsx` - Added Toaster import and mount inside body
- `package.json` - Added sonner@2.0.7, next-themes@0.4.6

## Decisions Made

- **form.tsx manual creation**: The shadcn CLI with `base-nova` style silently skips the `form` component install (outputs "Checking registry" with no file created). Created form.tsx manually following the standard shadcn form component pattern using react-hook-form's FormProvider and Controller. The implementation matches the shadcn form API contract exactly (same exports, data-slot attributes) so downstream pages consuming `@/components/ui/form` will work without modification.

- **prisma db push deferred**: No DATABASE_URL is configured in the worktree environment. `prisma generate` was run successfully — the TypeScript client types include the new fields. The `db push` step must be run by the user after providing `DATABASE_URL`. This does not block Tasks 1 and 2 which are code/type changes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created form.tsx manually after shadcn CLI silently skipped it**
- **Found during:** Task 2 (Install shadcn components)
- **Issue:** `npx shadcn@latest add form --yes` ran successfully but created no files. The `base-nova` style does not install form via the registry (likely requires @radix-ui/react-label as direct dep which is not installed)
- **Fix:** Created `src/components/ui/form.tsx` manually with the standard shadcn form pattern — FormProvider wrapper, FormField using react-hook-form Controller, FormItem/FormLabel/FormControl/FormDescription/FormMessage helper components
- **Files modified:** `src/components/ui/form.tsx` (created)
- **Verification:** TypeScript compilation passes with zero errors
- **Committed in:** `1859d07` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Form component functionally equivalent to what shadcn CLI would have installed. No scope creep.

## Issues Encountered

- shadcn CLI `base-nova` style silently skips `form` component install — resolved by manual creation (see Deviations)
- `prisma db push` requires running PostgreSQL + DATABASE_URL — resolved by running `prisma generate` instead, which fixes TypeScript compilation without requiring a live DB connection

## User Setup Required

Before the auth flow can be tested end-to-end, the user must:

1. Set `DATABASE_URL` in `.env.local`:
   ```
   DATABASE_URL="postgresql://user:password@localhost:5432/plantz_dev"
   ```

2. Set `AUTH_SECRET` in `.env.local`:
   ```
   AUTH_SECRET="$(openssl rand -base64 32)"
   ```

3. Run Prisma schema push:
   ```bash
   npx prisma db push
   ```

This step synchronizes the database with the Prisma schema (adds `onboardingCompleted` and `plantCountRange` columns to the `User` table).

## Known Stubs

None — all files created in this plan contain fully functional code. No placeholder/mock data was used.

## Threat Flags

No new security-relevant surface beyond the plan's threat model. All threat mitigations from T-02-01 through T-02-04 are implemented:
- T-02-01: registerSchema.safeParse validates all input before DB operations
- T-02-02: plantCountRange validated via z.enum whitelist in completeOnboarding
- T-02-03: Error messages match copywriting contract (distinguish registration duplicate vs generic error)
- T-02-04: signIn re-authenticates against DB via bcryptjs.compare

## Next Phase Readiness

- Auth contracts (schemas, actions, session callbacks) are ready for UI plans 02-02 (login), 02-03 (register), 02-04 (onboarding) to consume
- `session.user.id` is typed and available in all Server Components after login
- Toaster is mounted globally for toast notifications
- **Blocker for full E2E testing:** DATABASE_URL must be configured and `prisma db push` run before any auth flow can execute

---
*Phase: 02-authentication-and-onboarding*
*Completed: 2026-04-14*

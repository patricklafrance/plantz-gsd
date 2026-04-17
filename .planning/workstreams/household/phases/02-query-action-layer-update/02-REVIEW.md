---
phase: 02-query-action-layer-update
reviewed: 2026-04-17T18:45:00Z
depth: standard
iteration: 3
previous_review: 2026-04-17T15:26:22Z
files_reviewed: 63
files_reviewed_list:
  - auth.ts
  - package.json
  - prisma/migrations/20260417033126_add_household_member_is_default/migration.sql
  - prisma/schema.prisma
  - prisma/seed.ts
  - src/app/(main)/dashboard/page.tsx
  - src/app/(main)/h/[householdSlug]/dashboard/loading.tsx
  - src/app/(main)/h/[householdSlug]/dashboard/page.tsx
  - src/app/(main)/h/[householdSlug]/error.tsx
  - src/app/(main)/h/[householdSlug]/layout.tsx
  - src/app/(main)/h/[householdSlug]/not-found.tsx
  - src/app/(main)/h/[householdSlug]/plants/[id]/page.tsx
  - src/app/(main)/h/[householdSlug]/plants/loading.tsx
  - src/app/(main)/h/[householdSlug]/plants/page.tsx
  - src/app/(main)/h/[householdSlug]/rooms/[id]/page.tsx
  - src/app/(main)/h/[householdSlug]/rooms/loading.tsx
  - src/app/(main)/h/[householdSlug]/rooms/page.tsx
  - src/app/(main)/layout.tsx
  - src/app/(main)/not-found.tsx
  - src/app/(main)/plants/[id]/page.tsx
  - src/app/(main)/plants/page.tsx
  - src/app/(main)/rooms/[id]/page.tsx
  - src/app/(main)/rooms/page.tsx
  - src/components/auth/login-form.tsx
  - src/components/layout/bottom-tab-bar.tsx
  - src/components/onboarding/onboarding-banner.tsx
  - src/components/plants/add-plant-dialog.tsx
  - src/components/plants/plant-card.tsx
  - src/components/plants/plant-grid.tsx
  - src/components/rooms/room-card.tsx
  - src/components/watering/dashboard-client.tsx
  - src/components/watering/dashboard-plant-card.tsx
  - src/features/auth/actions.ts
  - src/features/demo/actions.ts
  - src/features/household/actions.ts
  - src/features/household/context.ts
  - src/features/household/guards.ts
  - src/features/household/paths.ts
  - src/features/household/queries.ts
  - src/features/household/schema.ts
  - src/features/notes/actions.ts
  - src/features/notes/queries.ts
  - src/features/notes/schemas.ts
  - src/features/plants/actions.ts
  - src/features/plants/queries.ts
  - src/features/plants/schemas.ts
  - src/features/reminders/actions.ts
  - src/features/reminders/queries.ts
  - src/features/reminders/schemas.ts
  - src/features/rooms/actions.ts
  - src/features/rooms/queries.ts
  - src/features/rooms/schemas.ts
  - src/features/watering/actions.ts
  - src/features/watering/queries.ts
  - src/features/watering/schemas.ts
  - tests/household-create.test.ts
  - tests/household-list.test.ts
  - tests/household.test.ts
  - tests/notes.test.ts
  - tests/plants.test.ts
  - tests/reminders.test.ts
  - tests/rooms.test.ts
  - tests/watering.test.ts
fixes_verified:
  - CR-01
  - WR-01
  - WR-02
  - WR-03
  - WR-04
  - IN-01
  - IN-02
  - IN-03
  - IN-04
  - IN-05
findings:
  critical: 0
  warning: 0
  info: 2
  total: 2
status: issues_found
---

# Phase 02: Code Review Report (Re-review — Iteration 3)

**Reviewed:** 2026-04-17T18:45:00Z
**Depth:** standard
**Files Reviewed:** 63
**Status:** issues_found (Info-only; all Critical/Warning and all iteration-2 Info findings resolved)

## Summary

This is the third-pass re-review of Phase 02 covering (a) verification of the 5 Info findings from iteration 2 (commits 2e47d51, ebf3534, f5926d5, 4db5df7, 9c1bcce) and (b) review of new files added by gap-closure phases 02-08 / 02-09 / 02-10 (`src/app/(main)/not-found.tsx`, `src/components/auth/login-form.tsx` rewrite, `src/components/onboarding/onboarding-banner.tsx`, and householdSlug threading through `PlantCard` / `PlantGrid` / `RoomCard` / `DashboardClient` / `DashboardPlantCard`).

**Overall assessment:** Every iteration-1 Critical/Warning finding (CR-01, WR-01, WR-02, WR-03, WR-04) and every iteration-2 Info finding (IN-01, IN-02, IN-03, IN-04, IN-05) is now verified resolved. The 02-08/09/10 work introduced no Critical or Warning regressions. Two new minor Info-level observations are recorded below — neither is a correctness issue and neither blocks phase completion.

**Iteration-2 fix verification:**

- **IN-01** (dead `deleteRoomSchema`) — Fixed. `src/features/rooms/schemas.ts` no longer exports `deleteRoomSchema`; `deleteRoom` continues to import and use `roomTargetSchema`. Repo-wide grep for `deleteRoomSchema` returns zero matches.
- **IN-02** (`householdId` schema inconsistency) — Fixed. All `householdId` fields across `plants/schemas.ts`, `rooms/schemas.ts`, `notes/schemas.ts`, `reminders/schemas.ts`, and `watering/schemas.ts` now use `z.string().min(1)`. Repo-wide grep for `.cuid()` returns zero matches in `src/`.
- **IN-03** (`completeOnboarding` revalidates legacy path) — Fixed. `src/features/auth/actions.ts:156` calls `revalidatePath(HOUSEHOLD_PATHS.dashboard, "page")` with the household-scoped pattern. The import on line 9 is in place.
- **IN-04** (unused `household` destructures) — Fixed. Only two `const { household } = await requireHouseholdAccess(...)` destructures remain in the repo: `createPlant` (line 19) and `createRoom` (line 18) — both actually reference `household.id` on the next write. The previously-flagged `updatePlant` / `archivePlant` / `unarchivePlant` / `deletePlant` / `updateRoom` / `deleteRoom` sites now call `await requireHouseholdAccess(parsed.data.householdId)` without destructuring.
- **IN-05** (loose slug-loop test assertion) — Fixed. `tests/household-create.test.ts:90` now asserts `expect(txMock.household.findUnique).toHaveBeenCalledTimes(10)` — strictly enforces "exactly 10" instead of the previous `toBeGreaterThanOrEqual(10)`.

**02-08/09/10 review (new/modified files):**

- `src/app/(main)/not-found.tsx` (new) — Root-level 404 for routes outside `/h/[householdSlug]/`. Copy-paste of the household not-found component (see IN-06 below). No security issue; works as expected.
- `src/app/(main)/h/[householdSlug]/not-found.tsx` — Unchanged from iteration 2.
- `src/components/auth/login-form.tsx` (rewritten) — UAT-2 fix. Uses Auth.js v5 native server-side redirect (`redirect: true, redirectTo: "/dashboard"`) instead of the `{ redirect: false }` + `router.push` pattern. Correctly re-throws `isRedirectError` on success. No credential leakage, no exposed state.
- `src/components/onboarding/onboarding-banner.tsx` (new/rewritten) — Concurrent-action flow via `Promise.all` for `completeOnboarding` + `seedStarterPlants`. Surfaces seed-error via `toast.error` without auto-dismissing (UAT-10). One small nit flagged as IN-07.
- `src/components/plants/plant-card.tsx` — Now accepts `householdSlug` prop; builds household-scoped link at line 48. No session/DB access client-side — correct.
- `src/components/plants/plant-grid.tsx` — Passes `householdSlug` through to `PlantCard`. Pure presentation.
- `src/components/rooms/room-card.tsx` — Accepts `householdId` + `householdSlug`; calls `deleteRoom({ householdId, roomId })` correctly; link builds `/h/${householdSlug}/rooms/${room.id}`. Correct.
- `src/components/watering/dashboard-client.tsx` — Adds `householdSlug` to props and threads it through to `DashboardPlantCard`. `logWatering({ householdId, plantId })` call at line 91 matches the `logWateringSchema` contract.
- `src/components/watering/dashboard-plant-card.tsx` — Accepts `householdSlug` for link construction; `snoozeReminder({ householdId, plantId, days })` at line 89 matches schema. Correct.

**No new Critical or Warning findings.** Two Info items follow.

## Info

### IN-06: `src/app/(main)/not-found.tsx` duplicates `src/app/(main)/h/[householdSlug]/not-found.tsx` byte-for-byte

**Files:**
- `src/app/(main)/not-found.tsx:1-19`
- `src/app/(main)/h/[householdSlug]/not-found.tsx:1-19`

**Issue:** Both files export a "Household not found" component with identical icon (`SearchX`), identical headline, identical body copy, and identical "Go to dashboard" button pointing at `/dashboard`. The inner file is correct for the `/h/[householdSlug]/*` route scope (household lookup failed for a known slug shape). The outer file renders for routes outside `/h/*` — where the message "Household not found" is semantically wrong (the user hit e.g. `/settings`, not a household route).

The copy is harmless in practice because `/dashboard` will redirect to a valid household (or `/login?error=no_household` via the WR-03 fix), but future divergence is invited: a copy change in one file will silently drift from the other.

**Fix:**

Option A (recommended — fix the outer message):

```tsx
// src/app/(main)/not-found.tsx
export default function MainNotFound() {
  return (
    <div className="space-y-4 py-12 text-center">
      <SearchX className="mx-auto h-12 w-12 text-muted-foreground" aria-hidden="true" />
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="text-muted-foreground max-w-md mx-auto">
        We couldn&apos;t find what you&apos;re looking for. Head back to your dashboard.
      </p>
      <Link href="/dashboard">
        <Button variant="outline" size="sm">Go to dashboard</Button>
      </Link>
    </div>
  );
}
```

Option B: Extract a shared `<NotFoundCard heading={…} body={…} />` component in `src/components/shared/` and import it from both locations.

### IN-07: `userId` prop on `OnboardingBanner` is unused

**File:** `src/components/onboarding/onboarding-banner.tsx:14-19`

**Issue:** `OnboardingBannerProps` declares `userId: string` and the function destructures it, but the variable is never referenced in the component body. Both Server Actions it invokes (`completeOnboarding` and `seedStarterPlants`) re-authenticate via `auth()` server-side and derive `session.user.id` themselves — the client-passed `userId` is redundant. A caller that passes a wrong `userId` would not cause a security issue (the server action ignores it), but the prop is dead surface area and will trip `@typescript-eslint/no-unused-vars` under strict lint configs.

The `householdId` prop, by contrast, is load-bearing: it's the landing-target hint that the server action uses (and subsequently re-authorizes via `requireHouseholdAccess`), which is the D-14 pattern.

**Fix:**

```tsx
// Before
interface OnboardingBannerProps {
  userId: string;
  householdId: string;
}

export function OnboardingBanner({ userId, householdId }: OnboardingBannerProps) {

// After
interface OnboardingBannerProps {
  householdId: string;
}

export function OnboardingBanner({ householdId }: OnboardingBannerProps) {
```

And at the call site in `src/app/(main)/h/[householdSlug]/dashboard/page.tsx:139`:

```tsx
// Before
<OnboardingBanner userId={session.user.id} householdId={household.id} />

// After
<OnboardingBanner householdId={household.id} />
```

No behavioral change.

---

_Reviewed: 2026-04-17T18:45:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Iteration: 3 (re-review)_

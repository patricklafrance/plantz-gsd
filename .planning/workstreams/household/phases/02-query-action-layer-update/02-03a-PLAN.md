---
phase: 02-query-action-layer-update
plan: 03a
type: execute
wave: 4
depends_on: ["02-01", "02-04", "02-05a", "02-05b"]
files_modified:
  - src/app/(main)/h/[householdSlug]/layout.tsx
  - src/app/(main)/h/[householdSlug]/error.tsx
  - src/app/(main)/h/[householdSlug]/not-found.tsx
  - src/app/(main)/h/[householdSlug]/dashboard/page.tsx
  - src/app/(main)/h/[householdSlug]/dashboard/loading.tsx
  - src/app/(main)/h/[householdSlug]/plants/page.tsx
  - src/app/(main)/h/[householdSlug]/plants/loading.tsx
  - src/app/(main)/h/[householdSlug]/plants/[id]/page.tsx
  - src/app/(main)/h/[householdSlug]/rooms/page.tsx
  - src/app/(main)/h/[householdSlug]/rooms/loading.tsx
  - src/app/(main)/h/[householdSlug]/rooms/[id]/page.tsx
autonomous: true
requirements: [HSLD-02, HSLD-03]
tags: [nextjs-routing, layout-chokepoint, react-cache, error-boundary, not-found, route-moves]

must_haves:
  truths:
    - "Every authenticated page has a /h/[householdSlug]/ variant that calls getCurrentHousehold and sources householdId from the cached result"
    - "Layout chokepoint at src/app/(main)/h/[householdSlug]/layout.tsx composes resolveHouseholdBySlug + requireHouseholdAccess via React cache()"
    - "error.tsx discriminates ForbiddenError vs generic errors; not-found.tsx handles unknown slugs"
    - "Every new page.tsx threads household.id into query function calls AND passes household.id/householdSlug as prop to any rendered dialog/action-button client components"
    - "plants/page.tsx replaces hardcoded `/plants` URL strings with template literals using householdSlug"
    - "rooms/[id]/page.tsx is fixed where it references `room.userId` (Pitfall 1 flag from PATTERNS)"
  artifacts:
    - path: "src/app/(main)/h/[householdSlug]/layout.tsx"
      provides: "Pure chokepoint — calls getCurrentHousehold; NO chrome in this plan (Plan 03c adds chrome)"
      contains: "getCurrentHousehold"
      min_lines: 15
    - path: "src/app/(main)/h/[householdSlug]/error.tsx"
      provides: "Client error boundary — discriminates ForbiddenError"
      contains: "ForbiddenError"
    - path: "src/app/(main)/h/[householdSlug]/not-found.tsx"
      provides: "Server-Component 404 for unknown slugs"
      contains: "Household not found"
    - path: "src/app/(main)/h/[householdSlug]/dashboard/page.tsx"
      provides: "Dashboard page sourcing household.id from getCurrentHousehold"
      contains: "getCurrentHousehold"
  key_links:
    - from: "src/app/(main)/h/[householdSlug]/layout.tsx"
      to: "src/features/household/context.ts"
      via: "import getCurrentHousehold"
      pattern: "import.*getCurrentHousehold.*context"
    - from: "src/app/(main)/h/[householdSlug]/dashboard/page.tsx"
      to: "getDashboardPlants(household.id, ...)"
      via: "household-scoped query call"
      pattern: "getDashboardPlants\\(household\\.id"
---

<objective>
Move every authenticated route under `/h/[householdSlug]/...` (D-01, D-02 — route-tree half), establish the layout chokepoint that calls `getCurrentHousehold` once per request (D-03), and add `error.tsx` + `not-found.tsx` boundaries for 403/404 UX. This plan ships the NEW path tree only. Plan 03b replaces the legacy routes with redirect stubs. Plan 03c relocates the chrome (header + NotificationBell + BottomTabBar) from the outer `(main)/layout.tsx` into the new household layout.

Purpose: Establishes the route-tree where queries from Plan 04 have a home and actions from Plan 05a/05b have URLs to post from. Without this plan, the build has no page tree that consumes the new household-scoped queries. The chrome stays in the outer layout during this plan — both legacy paths (still present during 03a) and new paths render the outer chrome. Plan 03c removes the duplication.

Output: 11 new files under `src/app/(main)/h/[householdSlug]/` — 5 page.tsx + 3 loading.tsx + layout.tsx + error.tsx + not-found.tsx.
</objective>

<execution_context>
@C:/Dev/poc/plantz-gsd/.claude/get-shit-done/workflows/execute-plan.md
@C:/Dev/poc/plantz-gsd/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/workstreams/household/STATE.md
@.planning/workstreams/household/phases/02-query-action-layer-update/02-CONTEXT.md
@.planning/workstreams/household/phases/02-query-action-layer-update/02-RESEARCH.md
@.planning/workstreams/household/phases/02-query-action-layer-update/02-PATTERNS.md
@.planning/workstreams/household/phases/02-query-action-layer-update/02-UI-SPEC.md
@.planning/workstreams/household/phases/02-query-action-layer-update/02-01-PLAN.md
@.planning/workstreams/household/phases/02-query-action-layer-update/02-04-PLAN.md
@.planning/workstreams/household/phases/02-query-action-layer-update/02-05a-PLAN.md
@.planning/workstreams/household/phases/02-query-action-layer-update/02-05b-PLAN.md
@CLAUDE.md
@.claude/skills/nextjs/SKILL.md

# Source files the executor MUST read before editing
@src/app/(main)/layout.tsx
@src/app/(main)/dashboard/page.tsx
@src/app/(main)/plants/page.tsx
@src/app/(main)/plants/[id]/page.tsx
@src/app/(main)/rooms/page.tsx
@src/app/(main)/rooms/[id]/page.tsx
@src/app/(main)/dashboard/loading.tsx
@src/app/(main)/plants/loading.tsx
@src/app/(main)/rooms/loading.tsx
@src/components/shared/empty-state.tsx
@src/features/household/context.ts
@auth.ts

<interfaces>
<!-- Plan 02-01's cached helper — the chokepoint consumer -->

```typescript
export const getCurrentHousehold: (slug: string) => Promise<{
  household: { id: string; slug: string; name: string; timezone: string; cycleDuration: number; rotationStrategy: string };
  member: HouseholdMember;
  role: "OWNER" | "MEMBER";
}>;
```

Next.js 16 signatures:
```typescript
// next/navigation
export function redirect(url: string): never;
export function notFound(): never;

// Layout props — async params per Next.js 16
params: Promise<{ householdSlug: string }>;
```

**Per-page rewiring map (queries now accept `householdId`, from Plan 04):**

| Page | Old query call | New query call |
|------|----------------|----------------|
| dashboard | `getDashboardPlants(session.user.id, ...)` | `getDashboardPlants(household.id, ...)` |
| dashboard | `db.plant.count({ where: { userId: session.user.id, archivedAt: null } })` | `db.plant.count({ where: { householdId: household.id, archivedAt: null } })` |
| plants | `getPlants(session.user.id, opts)` | `getPlants(household.id, opts)` |
| plants | `getRoomsForSelect(session.user.id)` | `getRoomsForSelect(household.id)` |
| plants | `db.plant.count({ where: { userId: session.user.id, archivedAt: null } })` | `db.plant.count({ where: { householdId: household.id, archivedAt: null } })` |
| plants/[id] | `getPlant(id, session.user.id)` | `getPlant(id, household.id)` |
| plants/[id] | `getRoomsForSelect(session.user.id)` | `getRoomsForSelect(household.id)` |
| plants/[id] | `getTimeline(id, session.user.id)` | `getTimeline(id, household.id)` |
| rooms | `getRooms(session.user.id)` | `getRooms(household.id)` |
| rooms/[id] | `getRoom(id, session.user.id)` | `getRoom(id, household.id)` |

**Dialog prop threading (Plan 05a/05b added `householdId` prop to these client components):**

| Component | Parent page | Prop to pass |
|-----------|-------------|--------------|
| AddPlantDialog | plants/page.tsx | `householdId={household.id}` |
| EditPlantDialog | plants/[id]/page.tsx | `householdId={household.id}` |
| PlantActions | plants/[id]/page.tsx | `householdId={household.id}` |
| CreateRoomDialog | rooms/page.tsx and plants/[id]/page.tsx | `householdId={household.id}` |
| QuickCreatePresets | rooms/page.tsx | `householdId={household.id}` |
| RoomCard | rooms/page.tsx | `householdId={household.id}` |
| DashboardClient | dashboard/page.tsx | `householdId={household.id}` |
| LogWateringDialog | plants/[id]/page.tsx and watering-history-entry.tsx | `householdId={household.id}` |
| Timeline | plants/[id]/page.tsx | `householdId={household.id}` |
| WateringHistory | plants/[id]/page.tsx | `householdId={household.id}` |
| PlantReminderToggle | plants/[id]/page.tsx | `householdId={household.id}` |
| SnoozePills | plants/[id]/page.tsx | `householdId={household.id}` |

**CRITICAL FIX — rooms/[id]/page.tsx line 24 (PATTERNS flag):** Current file has `room: { id: room.id, name: room.name, userId: room.userId, createdAt: ..., updatedAt: ... }`. Replace `userId: room.userId` with `householdId: room.householdId` because Phase 1 dropped Room.userId.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create /h/[householdSlug]/ layout + error.tsx + not-found.tsx (pure chokepoint — NO chrome yet; Plan 03c adds it)</name>
  <files>src/app/(main)/h/[householdSlug]/layout.tsx, src/app/(main)/h/[householdSlug]/error.tsx, src/app/(main)/h/[householdSlug]/not-found.tsx</files>
  <read_first>
    - src/features/household/context.ts (Plan 01 output — getCurrentHousehold export)
    - src/app/(main)/layout.tsx (current chrome — it keeps rendering during 03a/03b; Plan 03c removes it)
    - src/components/shared/empty-state.tsx (props shape — UI-SPEC reuses it)
    - .planning/workstreams/household/phases/02-query-action-layer-update/02-UI-SPEC.md §Visual Contract for New Surfaces
    - .planning/workstreams/household/phases/02-query-action-layer-update/02-RESEARCH.md §Pattern 2 + §Code Examples
  </read_first>
  <action>
    Step 1 — Create `src/app/(main)/h/[householdSlug]/layout.tsx`. Pure chokepoint:

    ```typescript
    import { getCurrentHousehold } from "@/features/household/context";

    /**
     * D-03 chokepoint. Resolves the slug → household + membership once per request
     * via React cache(); nested pages reuse the cached result. Throws ForbiddenError
     * (caught by error.tsx) for non-members and notFound() (caught by not-found.tsx)
     * for unknown slugs.
     *
     * Chrome (header + NotificationBell + BottomTabBar) is rendered by the OUTER
     * `(main)/layout.tsx` during Plans 03a + 03b. Plan 03c moves it inward to this
     * layout so the chrome is household-aware (reminder count uses household.id).
     */
    export default async function HouseholdLayout({
      children,
      params,
    }: {
      children: React.ReactNode;
      params: Promise<{ householdSlug: string }>;
    }) {
      const { householdSlug } = await params;
      await getCurrentHousehold(householdSlug);
      return <>{children}</>;
    }
    ```

    Step 2 — Create `src/app/(main)/h/[householdSlug]/error.tsx` (Client Component):

    ```typescript
    "use client";

    import Link from "next/link";
    import { ShieldAlert, AlertCircle } from "lucide-react";
    import { Button } from "@/components/ui/button";

    export default function HouseholdError({
      error,
      reset,
    }: {
      error: Error & { digest?: string };
      reset: () => void;
    }) {
      if (error.name === "ForbiddenError") {
        return (
          <div role="alert" aria-live="polite" className="space-y-4 py-12 text-center">
            <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground" aria-hidden="true" />
            <h1 className="text-xl font-semibold">You don&apos;t have access to this household</h1>
            <p className="text-muted-foreground max-w-md mx-auto">
              Your membership may have been removed or you may have followed an outdated link.
              Go back to your dashboard to see the households you belong to.
            </p>
            <Link href="/dashboard">
              <Button variant="outline" size="sm">Go to dashboard</Button>
            </Link>
          </div>
        );
      }

      return (
        <div role="alert" aria-live="polite" className="space-y-4 py-12 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" aria-hidden="true" />
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="text-muted-foreground">
            We couldn&apos;t load this household. Try again, or go back to your dashboard.
          </p>
          <Button onClick={reset} variant="outline" size="sm">Try again</Button>
        </div>
      );
    }
    ```

    NOTE: The original plan suggested using `EmptyState` from `@/components/shared/empty-state.tsx`, but the inline markup above is safer because it avoids a component API assumption. If a later UI polish pass wants to adopt EmptyState, it can swap in — not in this plan's scope.

    Step 3 — Create `src/app/(main)/h/[householdSlug]/not-found.tsx` (Server Component):

    ```typescript
    import Link from "next/link";
    import { SearchX } from "lucide-react";
    import { Button } from "@/components/ui/button";

    export default function HouseholdNotFound() {
      return (
        <div className="space-y-4 py-12 text-center">
          <SearchX className="mx-auto h-12 w-12 text-muted-foreground" aria-hidden="true" />
          <h1 className="text-xl font-semibold">Household not found</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            This household doesn&apos;t exist, or it may have been deleted.
            Go back to see the households you&apos;re part of.
          </p>
          <Link href="/dashboard">
            <Button variant="outline" size="sm">Go to dashboard</Button>
          </Link>
        </div>
      );
    }
    ```

    Step 4 — Run `npx tsc --noEmit 2>&1 | grep -E "src[/\\\\]app[/\\\\]\\(main\\)[/\\\\]h[/\\\\]\\[householdSlug\\][/\\\\](layout|error|not-found)\\.tsx"`. Should return zero errors.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep -cE "src[/\\\\]app[/\\\\]\\(main\\)[/\\\\]h[/\\\\]\\[householdSlug\\][/\\\\](layout|error|not-found)\\.tsx"</automated>
  </verify>
  <acceptance_criteria>
    - File `src/app/(main)/h/[householdSlug]/layout.tsx` exists
    - File `src/app/(main)/h/[householdSlug]/error.tsx` exists with `"use client"` directive on line 1
    - File `src/app/(main)/h/[householdSlug]/not-found.tsx` exists WITHOUT `"use client"` directive
    - Grep `getCurrentHousehold` in layout.tsx returns 1 match
    - Grep `params: Promise<\{ householdSlug: string \}>` in layout.tsx returns 1 match
    - Grep `error\.name === "ForbiddenError"` in error.tsx returns 1 match
    - Grep `Household not found` in not-found.tsx returns 1 match
    - `npx tsc --noEmit` reports zero errors specific to these three new files
  </acceptance_criteria>
  <done>Chokepoint layout + error/not-found boundaries exist; chrome deferred to Plan 03c.</done>
</task>

<task type="auto">
  <name>Task 2: Move dashboard, plants, plants/[id], rooms, rooms/[id] under /h/[householdSlug]/ with household-scoped queries + dialog householdId prop threading</name>
  <files>src/app/(main)/h/[householdSlug]/dashboard/page.tsx, src/app/(main)/h/[householdSlug]/dashboard/loading.tsx, src/app/(main)/h/[householdSlug]/plants/page.tsx, src/app/(main)/h/[householdSlug]/plants/loading.tsx, src/app/(main)/h/[householdSlug]/plants/[id]/page.tsx, src/app/(main)/h/[householdSlug]/rooms/page.tsx, src/app/(main)/h/[householdSlug]/rooms/loading.tsx, src/app/(main)/h/[householdSlug]/rooms/[id]/page.tsx</files>
  <read_first>
    - src/app/(main)/dashboard/page.tsx (current — source for move)
    - src/app/(main)/dashboard/loading.tsx
    - src/app/(main)/plants/page.tsx (note basePath + clearUrl hardcoded to /plants per PATTERNS)
    - src/app/(main)/plants/loading.tsx
    - src/app/(main)/plants/[id]/page.tsx (note line 24 `room.userId` flagged by PATTERNS)
    - src/app/(main)/rooms/page.tsx
    - src/app/(main)/rooms/loading.tsx
    - src/app/(main)/rooms/[id]/page.tsx
    - src/features/plants/queries.ts (Plan 04 migrated — signatures accept householdId)
    - src/features/rooms/queries.ts (Plan 04 migrated)
    - src/features/watering/queries.ts (Plan 04 migrated)
    - src/features/notes/queries.ts (Plan 04 migrated)
    - src/features/household/context.ts (getCurrentHousehold)
    - .planning/workstreams/household/phases/02-query-action-layer-update/02-PATTERNS.md §src/app/(main)/h/[householdSlug]/
  </read_first>
  <action>
    For each source page, COPY its contents to the new path, rewire every query call to receive `household.id` instead of `session.user.id`, and pass `householdId={household.id}` as a prop to every rendered dialog/action-button client component that Plan 05a/05b added the prop to.

    Step 1 — Move loading files verbatim (no content edits):
      - `src/app/(main)/dashboard/loading.tsx` → `src/app/(main)/h/[householdSlug]/dashboard/loading.tsx`
      - `src/app/(main)/plants/loading.tsx` → `src/app/(main)/h/[householdSlug]/plants/loading.tsx`
      - `src/app/(main)/rooms/loading.tsx` → `src/app/(main)/h/[householdSlug]/rooms/loading.tsx`

      Use file copy; skeleton components have no route-dependent logic.

    Step 2 — Move `dashboard/page.tsx` → `src/app/(main)/h/[householdSlug]/dashboard/page.tsx`. In the NEW file:

      a. Update signature:
      ```typescript
      import { getCurrentHousehold } from "@/features/household/context";

      export default async function DashboardPage({
        params,
      }: {
        params: Promise<{ householdSlug: string }>;
      }) {
        const session = await auth();
        if (!session?.user?.id) redirect("/login");

        const { householdSlug } = await params;
        const { household } = await getCurrentHousehold(householdSlug);
        // ... rest of original body
      }
      ```

      b. Replace every `session.user.id` or `userId` in query args with `household.id`:
      ```typescript
      const [groups, plantCount] = await Promise.all([
        getDashboardPlants(household.id, todayStart, todayEnd),
        db.plant.count({ where: { householdId: household.id, archivedAt: null } }),
      ]);
      ```

      c. Pass `householdId={household.id}` to `<DashboardClient>` render:
      ```tsx
      <DashboardClient groups={groups} isDemo={isDemo} householdId={household.id} />
      ```

      d. Leave all imports, rendering logic, and other JSX identical.

    Step 3 — Move `plants/page.tsx` → `src/app/(main)/h/[householdSlug]/plants/page.tsx`. In the NEW file:

      a. Update signature:
      ```typescript
      export default async function PlantsPage({
        params,
        searchParams,
      }: {
        params: Promise<{ householdSlug: string }>;
        searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
      }) {
        const session = await auth();
        if (!session?.user?.id) redirect("/login");

        const { householdSlug } = await params;
        const { household } = await getCurrentHousehold(householdSlug);
        // ... rest
      }
      ```

      b. Replace query args:
      ```typescript
      const [plantsResult, catalog, rooms, totalPlantCount] = await Promise.all([
        getPlants(household.id, { /* existing opts unchanged */ }),
        getCatalog(),
        getRoomsForSelect(household.id),
        db.plant.count({ where: { householdId: household.id, archivedAt: null } }),
      ]);
      ```

      c. Rewire hardcoded `/plants` URLs to `/h/${householdSlug}/plants`:
      - ~Line 65-67 redirect: `redirect(qs ? \`/h/${householdSlug}/plants?${qs}\` : \`/h/${householdSlug}/plants\`);`
      - ~Line 117 `basePath` prop on Pagination: `basePath={\`/h/${householdSlug}/plants\`}`
      - Lines ~165-195 `EmptyFilterState` clearUrl logic: substitute `/h/${householdSlug}/plants` everywhere `/plants` appears

      After edits, grep the NEW file for the string `"/plants"` (literal double-quoted) — should return 0 matches (all converted to template literals with householdSlug).

      d. Pass `householdId={household.id}` to `<AddPlantDialog>` and `<CreateRoomDialog>` (if the page renders a room-create dialog for the "add to room" flow):
      ```tsx
      <AddPlantDialog rooms={rooms} catalog={catalog} householdId={household.id} />
      ```

    Step 4 — Move `plants/[id]/page.tsx` → `src/app/(main)/h/[householdSlug]/plants/[id]/page.tsx`. In the NEW file:

      a. Params become `Promise<{ householdSlug: string; id: string }>`:
      ```typescript
      export default async function PlantDetailPage({
        params,
      }: {
        params: Promise<{ householdSlug: string; id: string }>;
      }) {
        const session = await auth();
        if (!session?.user?.id) redirect("/login");

        const { householdSlug, id } = await params;
        const { household } = await getCurrentHousehold(householdSlug);

        const [plant, rooms, { entries: timelineEntries, total: timelineTotal }] =
          await Promise.all([
            getPlant(id, household.id),
            getRoomsForSelect(household.id),
            getTimeline(id, household.id),
          ]);
        // ... rest
      }
      ```

      b. Back-link (approx line 44 of original): `<Link href={\`/h/${householdSlug}/plants\`} ...>`.

      c. Thread `householdId={household.id}` into EVERY rendered client component that needs it (Plan 05a/05b added the prop). Grep the existing file to enumerate:
      - `<EditPlantDialog>` — add `householdId={household.id}`
      - `<PlantActions>` — add `householdId={household.id}`
      - `<LogWateringDialog>` (if rendered directly) — add `householdId={household.id}`
      - `<Timeline>` — add `householdId={household.id}`
      - `<WateringHistory>` — add `householdId={household.id}`
      - `<PlantReminderToggle>` — add `householdId={household.id}`
      - `<SnoozePills>` — add `householdId={household.id}`
      - Any other client component touched by Plan 05a/05b

    Step 5 — Move `rooms/page.tsx` → `src/app/(main)/h/[householdSlug]/rooms/page.tsx`. In the NEW file:

      a. Params: `Promise<{ householdSlug: string }>`.
      b. `getRooms(household.id)`.
      c. Rewrite hardcoded `/rooms/...` URLs → `/h/${householdSlug}/rooms/...`.
      d. Pass `householdId={household.id}` to `<CreateRoomDialog>`, `<QuickCreatePresets>`, and any `<RoomCard>` rendered in a loop (pass it through the map callback).

    Step 6 — Move `rooms/[id]/page.tsx` → `src/app/(main)/h/[householdSlug]/rooms/[id]/page.tsx`. In the NEW file:

      a. Params: `Promise<{ householdSlug: string; id: string }>`.
      b. `getRoom(id, household.id)` instead of `getRoom(id, session.user.id)`.
      c. **CRITICAL FIX (PATTERNS line 24):** locate the line that reads `room: { id: room.id, name: room.name, userId: room.userId, ... }` or any similar use of `room.userId`. Replace `userId: room.userId` with `householdId: room.householdId`. If no `userId` reference on `room` exists (e.g., the file was already refactored), grep the file for `room\\.userId` — returns 0 matches and skip this step. If ANY `room.userId` reference remains, replace it.
      d. Back-link: `<Link href={\`/h/${householdSlug}/rooms\`} ...>` if present.
      e. Pass `householdId={household.id}` to any dialogs rendered (e.g. edit-room via `<CreateRoomDialog room={room} />`).

    Step 7 — Run `npx tsc --noEmit 2>&1 | grep "src[/\\\\]app[/\\\\]\\(main\\)[/\\\\]h"`. Should return zero errors in the moved files.

    Note: This task does NOT delete the old files — Plan 03b replaces them with legacy redirect stubs.

    Step 8 — Stage all 8 new files. Do NOT run `git commit` — notify the developer.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep -cE "src[/\\\\]app[/\\\\]\\(main\\)[/\\\\]h[/\\\\]\\[householdSlug\\]"</automated>
  </verify>
  <acceptance_criteria>
    - All 8 files exist at `src/app/(main)/h/[householdSlug]/{dashboard,plants,plants/[id],rooms,rooms/[id]}/{page,loading}.tsx` (3 loading + 5 page)
    - Every new page.tsx: grep `getCurrentHousehold\(householdSlug\)` returns ≥ 1 match
    - Every new page.tsx: grep `household\.id` returns ≥ 1 match (query arg or prop)
    - `plants/[id]/page.tsx` and `rooms/[id]/page.tsx`: grep `await params` returns 1 match with `householdSlug` + `id` both destructured
    - `rooms/[id]/page.tsx`: grep `room\.userId` returns 0 matches (PATTERNS fix applied)
    - `plants/page.tsx` (new): grep `"/plants"` (literal double-quoted) returns 0 matches — all replaced with template literals
    - Dialog prop threading: grep `householdId={household\.id}` in `plants/[id]/page.tsx` returns ≥ 5 matches (EditPlantDialog, PlantActions, Timeline, WateringHistory, PlantReminderToggle minimum)
    - `npx tsc --noEmit` reports zero errors in files under `src/app/(main)/h/[householdSlug]/`
  </acceptance_criteria>
  <done>All 5 route pages + 3 loading skeletons moved under the household-scoped tree; query calls rewired to household.id; dialog components receive householdId prop.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| URL householdSlug → DB | `[householdSlug]` untrusted URL input; `getCurrentHousehold` resolves via slug lookup then membership-checks via `requireHouseholdAccess` |
| 403 vs 404 discriminant | `error.name === "ForbiddenError"` runtime string comparison; Phase 1 `Object.setPrototypeOf` makes the name consistent |
| Page query args — untrusted slug, trusted household.id | Pages receive household.id from the cached `getCurrentHousehold` — the id itself is DB-derived post-auth, never URL-derived |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-03a-01 | E (Elevation of Privilege) | [householdSlug] layout chokepoint | mitigate | `getCurrentHousehold` composes `resolveHouseholdBySlug` + `requireHouseholdAccess`. URL manipulation fails with `ForbiddenError` → 403 via error.tsx. Unknown slug → `notFound()` → 404 via not-found.tsx. |
| T-02-03a-02 | I (Information Disclosure) | 403 vs 404 oracle | accept | Phase 1 T-01-04-03 flagged for Phase 2. Slug entropy 54^8 ≈ 72T — brute enumeration infeasible. Acceptable. |
| T-02-03a-03 | I | Dialog prop leakage | mitigate | `household.id` is passed as a prop from Server Component to Client Component. The id is DB-derived and membership-validated before passing. Cannot be tampered by client code (props are serialised once). |
| T-02-03a-04 | T | Tampered `room.userId` fix | mitigate | rooms/[id]/page.tsx fix — the `room.userId` reference is replaced with `room.householdId`. Prisma schema no longer has the column; compile-time type-checking enforces correctness. Pitfall 1 scoped to compile-time. |
</threat_model>

<verification>
- `npx tsc --noEmit` — zero errors in `src/app/(main)/h/[householdSlug]/**/*.tsx`
- Every new page.tsx calls `getCurrentHousehold(householdSlug)` exactly once via the layout cache
- Every dialog/action-button rendered in the new pages receives `householdId={household.id}` prop
- rooms/[id]/page.tsx no longer references `room.userId`
- plants/page.tsx has no literal `"/plants"` string (all template literals)
</verification>

<success_criteria>
- Every authenticated route has a /h/[householdSlug]/ variant that compiles, calls getCurrentHousehold, and sources householdId from the cached result
- Layout chokepoint established: getCurrentHousehold called once per request; pages reuse the cache
- Error + not-found boundaries catch 403/404 with user-recovery UI
- rooms/[id]/page.tsx Pitfall 1 fix applied (room.userId → room.householdId)
- Dialog prop threading correctly wires Plan 05a/05b's householdId expectation
- Plan 03b unblocked (it needs the new routes to exist as redirect targets)
- Plan 03c unblocked (it needs the new layout to extend with chrome)
</success_criteria>

<output>
After completion, create `.planning/workstreams/household/phases/02-query-action-layer-update/02-03a-SUMMARY.md` including:
- Confirmation of 11 new files created
- Per-page dialog-prop-threading checklist (which client components received householdId in which page)
- Any remaining hardcoded `/plants` or `/rooms` URLs grep'd after (should be 0)
- rooms/[id]/page.tsx userId→householdId fix line-number before/after
- Any deviations from the plan (unexpected legacy path hardcoding, etc.)
</output>
</content>
</invoke>
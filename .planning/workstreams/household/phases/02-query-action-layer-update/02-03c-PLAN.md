---
phase: 02-query-action-layer-update
plan: 03c
type: execute
wave: 6
depends_on: ["02-03a", "02-03b"]
files_modified:
  - src/app/(main)/h/[householdSlug]/layout.tsx
  - src/app/(main)/layout.tsx
  - src/components/layout/bottom-tab-bar.tsx
  - src/components/reminders/notification-bell.tsx
autonomous: true
requirements: [HSLD-02, HSLD-03]
tags: [chrome-relocation, bottom-tab-bar, notification-bell, q11-option-a, household-scoped-nav]

must_haves:
  truths:
    - "The inner /h/[householdSlug]/layout.tsx owns the household-aware chrome: top nav (Plant Minder logo + Plants/Rooms nav + UserMenu + NotificationBell) AND BottomTabBar (mobile)"
    - "The outer (main)/layout.tsx retains ONLY non-household chrome: session gate, demo banner, TimezoneSync, FocusHeading, SkipToContent, main wrapper"
    - "NotificationBell receives a householdSlug prop and its reminder-item click handler links to /h/[slug]/plants/[plantId]"
    - "BottomTabBar receives a householdSlug prop; tab hrefs include /h/[slug]/ prefix; active-tab detection works across the /h/[slug]/ prefix"
    - "WCAG min-h-[44px] touch targets preserved on BottomTabBar (no visual regression)"
    - "Reminder count + items are fetched with household.id (not session.user.id) — achieved by calling getReminderCount/getReminderItems from inside the inner layout"
  artifacts:
    - path: "src/app/(main)/h/[householdSlug]/layout.tsx"
      provides: "Household chokepoint + chrome — calls getCurrentHousehold, then getReminderCount(household.id, ...), renders header + NotificationBell + BottomTabBar + children"
      contains: "NotificationBell"
      min_lines: 50
    - path: "src/app/(main)/layout.tsx"
      provides: "Outer layout, slimmed — session gate + demo banner + TimezoneSync + FocusHeading + SkipToContent + <main> wrapper; NO header/nav/chrome"
    - path: "src/components/layout/bottom-tab-bar.tsx"
      provides: "BottomTabBar accepts householdSlug prop; tab hrefs use /h/[slug]/"
      contains: "householdSlug"
    - path: "src/components/reminders/notification-bell.tsx"
      provides: "NotificationBell accepts householdSlug prop; reminder-item router.push uses /h/[slug]/plants/[plantId]"
      contains: "householdSlug"
  key_links:
    - from: "src/app/(main)/h/[householdSlug]/layout.tsx"
      to: "getReminderCount(household.id, todayStart, todayEnd)"
      via: "household-scoped reminder fetch replacing the session.user.id version"
      pattern: "getReminderCount\\(household\\.id"
    - from: "src/app/(main)/h/[householdSlug]/layout.tsx"
      to: "<NotificationBell householdSlug={householdSlug} />"
      via: "prop threading for reminder-item href construction"
      pattern: "householdSlug=\\{householdSlug\\}"
    - from: "src/components/layout/bottom-tab-bar.tsx"
      to: "tab hrefs /h/${householdSlug}/dashboard etc."
      via: "template-literal tab hrefs"
      pattern: "/h/\\$\\{.*householdSlug"
---

<objective>
Relocate the app chrome — top header (Plant Minder logo + Plants/Rooms nav + UserMenu + NotificationBell) and bottom tab bar (mobile) — from the outer `src/app/(main)/layout.tsx` into the household-scoped `src/app/(main)/h/[householdSlug]/layout.tsx`. Thread `householdSlug` through `<BottomTabBar>` and `<NotificationBell>` so tab hrefs and reminder-item clicks link to `/h/[slug]/...` paths. Switch reminder-count fetch from `session.user.id` to `household.id` (Plan 04 migrated the query signatures; this plan flips the caller).

Purpose: Q11 Option A chrome relocation. Before this plan, the outer layout fetches reminders with `session.user.id` — which fails post-migration because the queries now accept `householdId`. This plan closes the loop. Also makes the chrome household-aware (a user who switches households via Phase 6 will see a different reminder count without reloading).

Output: 4 files modified — inner layout extends from Plan 03a's stub to include chrome; outer layout slims; BottomTabBar + NotificationBell accept householdSlug.
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
@.planning/workstreams/household/phases/02-query-action-layer-update/02-03a-PLAN.md
@.planning/workstreams/household/phases/02-query-action-layer-update/02-03b-PLAN.md
@.planning/workstreams/household/phases/02-query-action-layer-update/02-04-PLAN.md
@CLAUDE.md
@.claude/skills/nextjs/SKILL.md

# Source files the executor MUST read before editing
@src/app/(main)/layout.tsx
@src/app/(main)/h/[householdSlug]/layout.tsx
@src/components/layout/bottom-tab-bar.tsx
@src/components/reminders/notification-bell.tsx
@src/features/reminders/queries.ts
@src/features/household/context.ts
@src/components/watering/timezone-sync.tsx
@src/components/shared/focus-heading.tsx
@src/components/auth/user-menu.tsx

<interfaces>
<!-- Post-migration reminder queries (Plan 04 output) -->

```typescript
// src/features/reminders/queries.ts
export async function getReminderCount(
  householdId: string,
  todayStart: Date,
  todayEnd: Date
): Promise<number>;

export async function getReminderItems(
  householdId: string,
  todayStart: Date,
  todayEnd: Date
): Promise<ReminderItem[]>;
```

**Component API changes:**

BottomTabBar current props (`src/components/layout/bottom-tab-bar.tsx`):
```typescript
interface BottomTabBarProps {
  notificationCount: number;
  reminderItems: ReminderItem[];
}
```

BottomTabBar NEW props:
```typescript
interface BottomTabBarProps {
  householdSlug: string;     // NEW
  notificationCount: number;
  reminderItems: ReminderItem[];
}
```

Internal TABS array changes from static to dynamic per-slug:
```typescript
// BEFORE (static module-level const)
const TABS = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard", exact: true },
  { href: "/plants", icon: Leaf, label: "Plants", exact: false },
  { href: "/rooms", icon: DoorOpen, label: "Rooms", exact: false },
] as const;

// AFTER (computed inside component from householdSlug)
const tabs = [
  { href: `/h/${householdSlug}/dashboard`, icon: LayoutDashboard, label: "Dashboard", exact: true },
  { href: `/h/${householdSlug}/plants`, icon: Leaf, label: "Plants", exact: false },
  { href: `/h/${householdSlug}/rooms`, icon: DoorOpen, label: "Rooms", exact: false },
];
```

Reminder-item router.push in BottomTabBar (current line 96):
```typescript
// BEFORE:
onClick={() => router.push(`/plants/${item.plantId}`)}
// AFTER:
onClick={() => router.push(`/h/${householdSlug}/plants/${item.plantId}`)}
```

NotificationBell current props (`src/components/reminders/notification-bell.tsx`):
```typescript
interface NotificationBellProps {
  count: number;
  items: ReminderItem[];
}
```

NotificationBell NEW props:
```typescript
interface NotificationBellProps {
  householdSlug: string;     // NEW
  count: number;
  items: ReminderItem[];
}
```

Reminder-item router.push in NotificationBell (current line 59):
```typescript
// BEFORE:
onClick={() => router.push(`/plants/${item.plantId}`)}
// AFTER:
onClick={() => router.push(`/h/${householdSlug}/plants/${item.plantId}`)}
```

**Layout split — what moves, what stays:**

Outer `(main)/layout.tsx` STAYS with:
- `auth()` session gate + `redirect("/login")` — needed to gate legacy stubs (Plan 03b) that never reach the inner layout
- `db.user.findUnique` for email/name/remindersEnabled flags — the UserMenu needs these, but UserMenu moves to the inner layout; decide whether to fetch here-and-prop-drill or refetch in inner layout. **Recommendation: keep the user fetch here (the outer layout runs first); prop-drill `user` + `isDemo` into the inner layout** via `React.cloneElement` or context OR simply refetch in inner layout (the query is `findUnique` on userId — negligible cost, cache-friendly). The simplest choice: **refetch in inner layout via a tiny `getSessionUserProfile()` helper** to avoid prop drilling through cloneElement (which Next.js doesn't support cleanly for layouts).

  Simpler still: do both fetches in the inner layout. The outer layout becomes:

  ```typescript
  import { auth } from "../../../auth";
  import { redirect } from "next/navigation";
  import { TimezoneSync } from "@/components/watering/timezone-sync";
  import { FocusHeading } from "@/components/shared/focus-heading";

  export default async function MainLayout({ children }: { children: React.ReactNode }) {
    const session = await auth();
    if (!session?.user?.id) redirect("/login");

    return (
      <div className="min-h-screen bg-background">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-md focus:ring-2 focus:ring-ring">
          Skip to content
        </a>
        <TimezoneSync />
        <FocusHeading />
        <main id="main-content" className="mx-auto max-w-5xl px-4 py-6 pb-20 sm:pb-6">
          {children}
        </main>
      </div>
    );
  }
  ```

  The demo banner previously in outer layout — move to the inner layout (only household-scoped pages need it; legacy stubs redirect immediately so they never render the banner anyway).

Inner `[householdSlug]/layout.tsx` GETS (extending Plan 03a's stub):
- `getCurrentHousehold(householdSlug)` (already present from Plan 03a)
- Additional: fetch user profile (email/name/isDemo) — either re-query or accept from outer via cloneElement
- Fetch reminder count + items via `getReminderCount(household.id, ...)` and `getReminderItems(household.id, ...)`
- Render the top nav (Plant Minder logo + Plants/Rooms nav links + UserMenu + NotificationBell)
- Render children
- Render BottomTabBar
- Render demo banner if `session.user.isDemo`

**Today-window computation:** copy verbatim from current outer layout (`cookies()` + `user_tz` + Date.UTC math).

**Tailwind classes:** Preserve verbatim from current outer layout. Do NOT change visual styling. UI-SPEC is zero-visual-redesign.

**Active-tab detection in BottomTabBar:** current logic (lines 40-42):
```typescript
const isActive = exact
  ? pathname === href
  : pathname === href || pathname.startsWith(href + "/");
```

Works with the new template-literal hrefs because `pathname` at runtime is `/h/<slug>/plants/...` and `href` is `/h/<slug>/plants`. The string comparison + `startsWith` still works. No logic change needed — only the hrefs change.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Slim outer (main)/layout.tsx — remove chrome; retain session gate + TimezoneSync + FocusHeading + SkipToContent + main wrapper</name>
  <files>src/app/(main)/layout.tsx</files>
  <read_first>
    - src/app/(main)/layout.tsx (current — full file; identify which imports become unused)
    - src/components/watering/timezone-sync.tsx (confirm it stays in outer)
    - src/components/shared/focus-heading.tsx (confirm it stays in outer)
    - .planning/workstreams/household/phases/02-query-action-layer-update/02-UI-SPEC.md §Chrome relocation
  </read_first>
  <action>
    Rewrite `src/app/(main)/layout.tsx` to remove every UI element that is household-aware. Retain only the session gate, accessibility scaffolding, and the `<main>` wrapper:

    ```typescript
    import { auth } from "../../../auth";
    import { redirect } from "next/navigation";
    import { TimezoneSync } from "@/components/watering/timezone-sync";
    import { FocusHeading } from "@/components/shared/focus-heading";

    /**
     * Outer (main) layout — gates authenticated access and renders non-household
     * chrome (accessibility skip link, timezone sync, focus heading, main wrapper).
     * The household-aware chrome (header + nav + NotificationBell + BottomTabBar +
     * demo banner) moves into src/app/(main)/h/[householdSlug]/layout.tsx so the
     * reminder count can source household.id (Plan 03c / Q11 Option A).
     *
     * Legacy redirect stubs (Plan 03b) pass through this layout but redirect before
     * rendering — they never reach the inner layout, which is fine (stubs forward
     * to /h/[slug]/... where the inner layout renders the chrome).
     */
    export default async function MainLayout({
      children,
    }: {
      children: React.ReactNode;
    }) {
      const session = await auth();
      if (!session?.user?.id) {
        redirect("/login");
      }

      return (
        <div className="min-h-screen bg-background">
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-md focus:ring-2 focus:ring-ring"
          >
            Skip to content
          </a>
          <TimezoneSync />
          <FocusHeading />
          <main id="main-content" className="mx-auto max-w-5xl px-4 py-6 pb-20 sm:pb-6">
            {children}
          </main>
        </div>
      );
    }
    ```

    Removed imports (they move to the inner layout):
    - `db` (reminder fetch no longer happens here)
    - `cookies` (today-window computation moves to inner)
    - `Leaf` (Plant Minder logo icon — moves to inner)
    - `Link` (nav links move to inner)
    - `UserMenu` (moves to inner)
    - `getReminderCount, getReminderItems` (called with household.id in inner)
    - `NotificationBell` (moves to inner)
    - `BottomTabBar` (moves to inner)

    The `isDemo` banner moves to the inner layout (legacy stubs redirect before rendering anyway).

    Run `npx tsc --noEmit 2>&1 | grep "src[/\\\\]app[/\\\\]\\(main\\)[/\\\\]layout\\.tsx"`. Should report zero errors.

    Stage the file. Do NOT run `git commit`.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep -cE "src[/\\\\]app[/\\\\]\\(main\\)[/\\\\]layout\\.tsx"</automated>
  </verify>
  <acceptance_criteria>
    - `src/app/(main)/layout.tsx`: grep `NotificationBell` returns 0 matches (moved to inner)
    - grep `BottomTabBar` returns 0 matches (moved to inner)
    - grep `getReminderCount\|getReminderItems` returns 0 matches (moved to inner)
    - grep `UserMenu` returns 0 matches (moved to inner)
    - grep `Plant Minder` returns 0 matches (logo + title moved to inner)
    - grep `auth\(\)` returns 1 match (session gate preserved)
    - grep `TimezoneSync` returns 1 match (stays)
    - grep `FocusHeading` returns 1 match (stays)
    - grep `id="main-content"` returns 1 match (stays)
    - `npx tsc --noEmit` reports zero errors in the outer layout
    - Line count reduced from ~100 to ~30-35 (approximately — acceptable range)
  </acceptance_criteria>
  <done>Outer layout slimmed; chrome fully removed; session gate + a11y scaffolding preserved.</done>
</task>

<task type="auto">
  <name>Task 2: Extend inner /h/[householdSlug]/layout.tsx with chrome (header + NotificationBell + BottomTabBar + demo banner); update BottomTabBar + NotificationBell to accept householdSlug prop</name>
  <files>src/app/(main)/h/[householdSlug]/layout.tsx, src/components/layout/bottom-tab-bar.tsx, src/components/reminders/notification-bell.tsx</files>
  <read_first>
    - src/app/(main)/h/[householdSlug]/layout.tsx (Plan 03a stub — extend it)
    - src/components/layout/bottom-tab-bar.tsx (current — note TABS is a module-level const; must move inside component to use householdSlug)
    - src/components/reminders/notification-bell.tsx (current — line 59 has the reminder-item router.push)
    - src/features/reminders/queries.ts (Plan 04 migrated signatures)
    - src/features/household/context.ts (getCurrentHousehold cached result)
    - src/components/auth/user-menu.tsx (UserMenu props — confirm email/name usage)
    - The previous src/app/(main)/layout.tsx contents (before Task 1 slimmed it) for verbatim JSX/classes
  </read_first>
  <action>
    Step 1 — Rewrite `src/app/(main)/h/[householdSlug]/layout.tsx` to replace the Plan 03a stub with the full chrome-bearing layout:

    ```typescript
    import { cookies } from "next/headers";
    import Link from "next/link";
    import { Leaf } from "lucide-react";
    import { auth } from "../../../../../auth";
    import { db } from "@/lib/db";
    import { getCurrentHousehold } from "@/features/household/context";
    import { getReminderCount, getReminderItems } from "@/features/reminders/queries";
    import { NotificationBell } from "@/components/reminders/notification-bell";
    import { BottomTabBar } from "@/components/layout/bottom-tab-bar";
    import { UserMenu } from "@/components/auth/user-menu";

    /**
     * D-03 chokepoint + household-aware chrome (Q11 Option A).
     *
     * Resolves the slug → household + membership once per request via React cache().
     * Fetches user profile + today's reminder window using household.id (not
     * session.user.id — Plan 04 migrated the query signatures). Renders the top
     * nav + NotificationBell + BottomTabBar with householdSlug threaded through.
     *
     * Nested pages reuse the cached getCurrentHousehold result — no re-query.
     * Throws ForbiddenError (caught by error.tsx) for non-members and notFound()
     * (caught by not-found.tsx) for unknown slugs.
     */
    export default async function HouseholdLayout({
      children,
      params,
    }: {
      children: React.ReactNode;
      params: Promise<{ householdSlug: string }>;
    }) {
      const { householdSlug } = await params;
      const { household } = await getCurrentHousehold(householdSlug);

      // Session is already validated by outer (main)/layout.tsx — re-read for user profile + isDemo
      const session = await auth();
      // Non-null assertion: outer layout redirected if session missing
      const sessionUser = session!.user!;

      const user = await db.user.findUnique({
        where: { id: sessionUser.id },
        select: { email: true, name: true, onboardingCompleted: true, remindersEnabled: true },
      });

      // Today-window in user's timezone (same idiom as the pre-move outer layout)
      const cookieStore = await cookies();
      const userTz = cookieStore.get("user_tz")?.value ?? household.timezone ?? "UTC";
      const now = new Date();
      const localDateStr = now.toLocaleDateString("en-CA", { timeZone: userTz });
      const [year, month, day] = localDateStr.split("-").map(Number);
      const todayStart = new Date(Date.UTC(year, month - 1, day));
      const todayEnd = new Date(Date.UTC(year, month - 1, day + 1));

      const [reminderCount, reminderItems] = await Promise.all([
        getReminderCount(household.id, todayStart, todayEnd),
        getReminderItems(household.id, todayStart, todayEnd),
      ]);

      const isDemo = sessionUser.isDemo ?? false;

      return (
        <>
          {isDemo && (
            <div className="sticky top-0 z-50 flex h-9 items-center justify-center border-b border-border bg-surface">
              <p className="text-sm text-muted-foreground">
                You&apos;re in demo mode &mdash;{" "}
                <Link href="/register" className="text-accent hover:underline">
                  Sign up to save your data
                </Link>
              </p>
            </div>
          )}
          <header className="border-b border-border">
            <nav aria-label="Top navigation" className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
              <Link href={`/h/${householdSlug}/dashboard`} className="flex items-center gap-2">
                <Leaf className="h-5 w-5 text-accent" />
                <span className="text-base font-semibold">Plant Minder</span>
              </Link>
              <div className="hidden items-center gap-4 sm:flex">
                <Link
                  href={`/h/${householdSlug}/plants`}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  Plants
                </Link>
                <Link
                  href={`/h/${householdSlug}/rooms`}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  Rooms
                </Link>
              </div>
              <div className="flex items-center gap-4">
                <div className="hidden sm:block">
                  <NotificationBell
                    householdSlug={householdSlug}
                    count={reminderCount}
                    items={reminderItems}
                  />
                </div>
                <UserMenu email={user?.email ?? ""} name={user?.name} />
              </div>
            </nav>
          </header>
          {children}
          <BottomTabBar
            householdSlug={householdSlug}
            notificationCount={reminderCount}
            reminderItems={reminderItems}
          />
        </>
      );
    }
    ```

    Verify the relative import depth to `auth.ts`: this file is at `src/app/(main)/h/[householdSlug]/layout.tsx` — 5 levels from repo root → `../../../../../auth`.

    Step 2 — Update `src/components/layout/bottom-tab-bar.tsx`:

    a. Add `householdSlug: string` to `BottomTabBarProps`.

    b. Move the `TABS` const from module-level to inside the component, using `householdSlug`:

    ```typescript
    "use client";

    import Link from "next/link";
    import { usePathname, useRouter } from "next/navigation";
    import { LayoutDashboard, Leaf, DoorOpen, Bell } from "lucide-react";
    import { cn } from "@/lib/utils";
    import {
      DropdownMenu,
      DropdownMenuContent,
      DropdownMenuItem,
      DropdownMenuTrigger,
    } from "@/components/ui/dropdown-menu";
    import type { ReminderItem } from "@/features/reminders/types";

    interface BottomTabBarProps {
      householdSlug: string;  // NEW
      notificationCount: number;
      reminderItems: ReminderItem[];
    }

    export function BottomTabBar({
      householdSlug,
      notificationCount,
      reminderItems,
    }: BottomTabBarProps) {
      const pathname = usePathname();
      const router = useRouter();

      const tabs = [
        { href: `/h/${householdSlug}/dashboard`, icon: LayoutDashboard, label: "Dashboard", exact: true },
        { href: `/h/${householdSlug}/plants`, icon: Leaf, label: "Plants", exact: false },
        { href: `/h/${householdSlug}/rooms`, icon: DoorOpen, label: "Rooms", exact: false },
      ];

      return (
        <nav
          aria-label="Main navigation"
          className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] sm:hidden"
        >
          <div className="flex h-14 items-stretch">
            {tabs.map(({ href, icon: Icon, label, exact }) => {
              const isActive = exact
                ? pathname === href
                : pathname === href || pathname.startsWith(href + "/");

              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex flex-1 flex-col items-center justify-center gap-0.5 text-xs min-h-[44px] rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1",
                    isActive ? "text-accent" : "text-muted-foreground"
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  <span>{label}</span>
                </Link>
              );
            })}

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    aria-label={
                      notificationCount > 0
                        ? `${notificationCount} plants need attention`
                        : "No plants need attention"
                    }
                    className="flex flex-1 flex-col items-center justify-center gap-0.5 text-xs min-h-[44px] rounded-md text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1 aria-expanded:text-accent"
                  >
                    <span className="relative">
                      <Bell className="h-5 w-5" aria-hidden="true" />
                      {notificationCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
                          {notificationCount > 9 ? "9+" : notificationCount}
                        </span>
                      )}
                    </span>
                    <span>Alerts</span>
                  </button>
                }
              />
              <DropdownMenuContent
                side="top"
                align="end"
                className="w-72 max-h-[320px] overflow-y-auto"
              >
                {reminderItems.length === 0 ? (
                  <p className="px-4 py-2 text-sm text-muted-foreground">
                    No reminders &mdash; Plants that need attention will appear here.
                  </p>
                ) : (
                  reminderItems.map((item) => (
                    <DropdownMenuItem
                      key={item.plantId}
                      onClick={() => router.push(`/h/${householdSlug}/plants/${item.plantId}`)}
                      className="group/item flex cursor-pointer flex-col items-start gap-1 py-2"
                    >
                      <span className="text-sm font-semibold text-foreground group-data-[highlighted]/item:text-accent-foreground">
                        {item.nickname}
                      </span>
                      <span className="text-xs text-muted-foreground group-data-[highlighted]/item:text-accent-foreground/70">
                        {item.roomName ?? "No room"} &middot; {item.statusLabel}
                      </span>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </nav>
      );
    }
    ```

    Step 3 — Update `src/components/reminders/notification-bell.tsx`:

    a. Add `householdSlug: string` to `NotificationBellProps`.

    b. Update the reminder-item `router.push` (current line 59):

    ```typescript
    // BEFORE:
    onClick={() => router.push(`/plants/${item.plantId}`)}
    // AFTER:
    onClick={() => router.push(`/h/${householdSlug}/plants/${item.plantId}`)}
    ```

    Do NOT change any visual styling or badge logic.

    Step 4 — Run `npx tsc --noEmit 2>&1 | grep -E "layout\\.tsx|bottom-tab-bar|notification-bell"`. Zero errors.

    Step 5 — Run `npm run build`. Full build green.

    Step 6 — Manual smoke-test (developer runs, records in SUMMARY):
      1. `npm run dev`
      2. Log in
      3. Visit `/dashboard` → redirects to `/h/<slug>/dashboard`
      4. Check that header + nav + BottomTabBar render on the household-scoped page
      5. Click Plants tab → URL becomes `/h/<slug>/plants`, active-tab visual updates
      6. Click NotificationBell (desktop) → dropdown opens; clicking an item navigates to `/h/<slug>/plants/<id>`
      7. Switch viewport to mobile; verify BottomTabBar renders; click Alerts → dropdown opens; item click navigates to `/h/<slug>/plants/<id>`
      8. Visit `/h/not-a-real-slug/dashboard` → 404 page renders (not-found.tsx)
      9. (If a second account with a different household is available) Visit the other user's slug → 403 page renders (error.tsx)

    Step 7 — Stage the 3 modified files. Do NOT run `git commit` — notify the developer.
  </action>
  <verify>
    <automated>npm run build 2>&1 | tail -30</automated>
  </verify>
  <acceptance_criteria>
    - `src/app/(main)/h/[householdSlug]/layout.tsx`: grep `NotificationBell` returns ≥ 1 match
    - grep `BottomTabBar` returns ≥ 1 match
    - grep `getReminderCount\(household\.id` returns 1 match
    - grep `UserMenu` returns ≥ 1 match
    - grep `Plant Minder` returns 1 match (header title moved in)
    - grep `isDemo` returns ≥ 1 match (demo banner moved in)
    - `src/components/layout/bottom-tab-bar.tsx`: grep `householdSlug` returns ≥ 4 matches (prop + 3 tab hrefs + reminder-item router.push)
    - `src/components/layout/bottom-tab-bar.tsx`: grep `min-h-\[44px\]` returns ≥ 1 match (touch target preserved)
    - `src/components/reminders/notification-bell.tsx`: grep `householdSlug` returns ≥ 2 matches (prop + item href)
    - `src/components/reminders/notification-bell.tsx`: grep `/h/\$\{householdSlug\}/plants/` returns 1 match
    - `npx tsc --noEmit` reports zero errors in the 3 modified files
    - `npm run build` exits 0 — complete Phase 2 route build passes
    - SUMMARY records smoke-test results (dev server redirects, 404/403 rendering, tab-bar navigation)
  </acceptance_criteria>
  <done>Chrome relocated per Q11 Option A; BottomTabBar + NotificationBell slug-aware; reminder count fetched with household.id; build green.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Inner layout fetch → getCurrentHousehold | Already runs for membership check; chrome fetch piggybacks on validated household.id — cannot leak across households |
| User profile re-fetch in inner layout | Outer layout already validated session; inner layout's `db.user.findUnique` is a trusted second read (same userId from auth()), small overhead |
| Reminder queries sourcing household.id | Plan 04 migrated queries filter by householdId; calling with `household.id` from getCurrentHousehold is authorized |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-03c-01 | I (Information Disclosure) | Chrome reminder count leak | mitigate | `getReminderCount(household.id, ...)` runs AFTER `getCurrentHousehold` validates membership. Non-members never reach this call (request ends in the ForbiddenError throw). D-15 temporary regression (roommates see same count) documented; Phase 5 closes it. |
| T-02-03c-02 | T (Tampering) | BottomTabBar Alerts link (v1 debt) | accept | UI-SPEC explicitly preserves current Alerts tab behavior (opens DropdownMenu with reminder items). Not a threat — it's an existing UX pattern. |
| T-02-03c-03 | S (Spoofing) | UserMenu relocated | accept | UserMenu receives `email` + `name` from the inner layout's `db.user.findUnique`. Session-derived; not URL-derived. No spoof surface. |
| T-02-03c-04 | I | 404 vs 403 UX parity | accept | Already covered by Plan 03a's error.tsx + not-found.tsx. No new surface in this plan. |
</threat_model>

<verification>
- `npm run build` — exits 0; full Phase 2 route tree + chrome compile cleanly
- Grep coverage:
  - `getReminderCount(household.id` in inner layout: 1 match (chrome now household-scoped)
  - `getReminderCount` in outer layout: 0 matches (purged)
  - `householdSlug` in BottomTabBar: ≥ 4 matches (prop + 3 tabs + reminder-item href)
  - `householdSlug` in NotificationBell: ≥ 2 matches (prop + item href)
  - `min-h-[44px]` in BottomTabBar: preserved
- Smoke-test recorded in SUMMARY
</verification>

<success_criteria>
- Q11 Option A chrome relocation complete — household-aware nav + NotificationBell + BottomTabBar
- Outer layout slimmed to session gate + a11y scaffolding
- Reminder count fetched with household.id (not session.user.id) — Plan 04 query signatures now have a caller
- WCAG touch targets preserved
- `npm run build` green — Phase 2 routing layer fully complete
</success_criteria>

<output>
After completion, create `.planning/workstreams/household/phases/02-query-action-layer-update/02-03c-SUMMARY.md` including:
- Before/after line count on outer layout (~100 → ~35)
- Chrome relocation checklist: header, nav links, logo, UserMenu, NotificationBell, BottomTabBar, demo banner — all moved to inner
- Verbatim text for the 3 tab hrefs in BottomTabBar (confirms template literal pattern)
- Smoke-test results (dev server ran? redirects confirmed? 404/403 confirmed? touch target preserved?)
- `npm run build` exit code and duration
- Any deviations from the plan
</output>
</content>
</invoke>
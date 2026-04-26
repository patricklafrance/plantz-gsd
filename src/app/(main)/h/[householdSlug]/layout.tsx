import { cookies } from "next/headers";
import Link from "next/link";
import { Leaf } from "lucide-react";
import { auth } from "../../../../../auth";
import { db } from "@/lib/db";
import { getCurrentHousehold } from "@/features/household/context";
import { getReminderCount, getReminderItems } from "@/features/reminders/queries";
import {
  getCurrentCycle,
  getUnreadCycleEventCount,
  getCycleNotificationsForViewer,
  getUserHouseholds,
} from "@/features/household/queries";
import type { CycleEventItem } from "@/features/reminders/types";
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

  // D-19: 4-way Promise.all for the unified badge + dropdown feed.
  // getCurrentCycle runs in parallel; its result feeds the subsequent
  // getCycleNotificationsForViewer call (needs cycle.id — necessarily sequential).
  const [
    reminderCount,
    reminderItems,
    unreadCycleEventCount,
    currentCycle,
    userHouseholds,
  ] = await Promise.all([
    getReminderCount(household.id, sessionUser.id, todayStart, todayEnd),
    getReminderItems(household.id, sessionUser.id, todayStart, todayEnd),
    getUnreadCycleEventCount(household.id, sessionUser.id),
    getCurrentCycle(household.id),
    getUserHouseholds(sessionUser.id),
  ]);

  // D-19 unified badge: one number, two renders (desktop + mobile).
  const totalCount = reminderCount + unreadCycleEventCount;

  // D-29 bell dropdown feed: cycle events for the current active cycle only
  // (D-06 derivational clearing — prior cycles' rows never surface here).
  //
  // Sequential hop: getCycleNotificationsForViewer needs currentCycle.id so it cannot
  // run inside the 4-way Promise.all above. This is the only sequential fetch.
  // The dashboard page Server Component (Plan 05-05 Task 2) also calls this function;
  // Plan 05-02 Task 2 wraps it with React.cache(), so that second call is a
  // request-level cache hit (zero extra DB work).
  let cycleEvents: CycleEventItem[] = [];
  if (currentCycle) {
    const notificationRows = await getCycleNotificationsForViewer(
      household.id,
      sessionUser.id,
      currentCycle.id,
    );
    cycleEvents = notificationRows.map((row) => {
      // WR-02 (Phase 5 review): prefer the stored priorAssigneeUserId snapshot
      // populated by transitionCycle at emission time — it is correct by
      // construction regardless of subsequent rotation churn. For rows emitted
      // BEFORE the schema change (priorAssignee: null) we fall back to the
      // legacy rotation-predecessor walk so historical notifications still
      // render something plausible. If both fail the row surfaces as null and
      // the bell CycleEventRow + ReassignmentBanner render "Someone".
      let priorAssigneeName: string | null = null;
      if (row.priorAssignee) {
        priorAssigneeName =
          row.priorAssignee.name ?? row.priorAssignee.email ?? null;
      } else {
        // Legacy fallback: rotation predecessor of the current assignee.
        const members = row.cycle?.household?.members ?? [];
        const sorted = [...members].sort((a, b) => a.rotationOrder - b.rotationOrder);
        const currentIdx = currentCycle.assignedUserId
          ? sorted.findIndex((m) => m.userId === currentCycle.assignedUserId)
          : -1;
        const priorMember =
          currentIdx > 0
            ? sorted[currentIdx - 1]
            : currentIdx === 0 && sorted.length > 1
              ? sorted[sorted.length - 1]
              : null;
        priorAssigneeName = priorMember
          ? (priorMember.user.name ?? priorMember.user.email ?? null)
          : null;
      }

      return {
        notificationId: row.id,
        type: row.type as CycleEventItem["type"],
        createdAt: row.createdAt,
        readAt: row.readAt,
        priorAssigneeName,
      };
    });
  }

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
          <Link
            href={`/h/${householdSlug}/dashboard`}
            aria-label="Plant Minder home"
            className="flex items-center gap-2 -ml-2 px-2 rounded-md hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <Leaf className="h-5 w-5 text-accent" aria-hidden="true" />
            <span className="text-sm font-semibold">Plant Minder</span>
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
                variant="desktop"
                householdId={household.id}
                householdSlug={householdSlug}
                count={totalCount}
                reminderItems={reminderItems}
                cycleEvents={cycleEvents}
              />
            </div>
            <UserMenu
              email={user?.email ?? ""}
              name={user?.name}
              households={userHouseholds.map((uh) => ({
                household: {
                  id: uh.household.id,
                  slug: uh.household.slug,
                  name: uh.household.name,
                },
                role: uh.role,
                isDefault: uh.isDefault,
              }))}
              currentSlug={householdSlug}
              currentHouseholdName={household.name}
            />
          </div>
        </nav>
      </header>
      <main id="main-content" className="mx-auto max-w-5xl px-4 py-6 pb-20 sm:pb-6">
        {children}
      </main>
      <BottomTabBar
        householdId={household.id}
        householdSlug={householdSlug}
        notificationCount={totalCount}
        reminderItems={reminderItems}
        cycleEvents={cycleEvents}
      />
    </>
  );
}

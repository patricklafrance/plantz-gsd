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
      <main id="main-content" className="mx-auto max-w-5xl px-4 py-6 pb-20 sm:pb-6">
        {children}
      </main>
      <BottomTabBar
        householdSlug={householdSlug}
        notificationCount={reminderCount}
        reminderItems={reminderItems}
      />
    </>
  );
}

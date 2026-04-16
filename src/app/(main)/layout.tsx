import { auth } from "../../../auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Leaf } from "lucide-react";
import Link from "next/link";
import { UserMenu } from "@/components/auth/user-menu";
import { TimezoneSync } from "@/components/watering/timezone-sync";
import { cookies } from "next/headers";
import { getReminderCount, getReminderItems } from "@/features/reminders/queries";
import { NotificationBell } from "@/components/reminders/notification-bell";
import { FocusHeading } from "@/components/shared/focus-heading";
import { BottomTabBar } from "@/components/layout/bottom-tab-bar";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, name: true, onboardingCompleted: true, remindersEnabled: true },
  });

  // Compute today boundaries using user's timezone cookie (same pattern as dashboard)
  const cookieStore = await cookies();
  const userTz = cookieStore.get("user_tz")?.value ?? "UTC";
  const now = new Date();
  const localDateStr = now.toLocaleDateString("en-CA", { timeZone: userTz });
  const [year, month, day] = localDateStr.split("-").map(Number);
  const todayStart = new Date(Date.UTC(year, month - 1, day));
  const todayEnd = new Date(Date.UTC(year, month - 1, day + 1));

  const [reminderCount, reminderItems] = await Promise.all([
    getReminderCount(session.user.id, todayStart, todayEnd),
    getReminderItems(session.user.id, todayStart, todayEnd),
  ]);

  const isDemo = session.user.isDemo ?? false;

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
      {isDemo && (
        <div className="sticky top-0 z-50 flex h-9 items-center justify-center border-b border-border bg-surface">
          <p className="text-sm text-muted-foreground">
            You&apos;re in demo mode &mdash;{" "}
            <Link
              href="/register"
              className="text-accent hover:underline"
            >
              Sign up to save your data
            </Link>
          </p>
        </div>
      )}
      <header className="border-b border-border">
        <nav aria-label="Top navigation" className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Leaf className="h-5 w-5 text-accent" />
            <span className="text-base font-semibold">Plant Minder</span>
          </Link>
          <div className="hidden items-center gap-4 sm:flex">
            <Link
              href="/plants"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Plants
            </Link>
            <Link
              href="/rooms"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Rooms
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:block">
              <NotificationBell count={reminderCount} items={reminderItems} />
            </div>
            <UserMenu email={user?.email ?? ""} name={user?.name} />
          </div>
        </nav>
      </header>
      <main id="main-content" className="mx-auto max-w-5xl px-4 py-6 pb-20 sm:pb-6">
        {children}
      </main>
      <BottomTabBar notificationCount={reminderCount} reminderItems={reminderItems} />
    </div>
  );
}

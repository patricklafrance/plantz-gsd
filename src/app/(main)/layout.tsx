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

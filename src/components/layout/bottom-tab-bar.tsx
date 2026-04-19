"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Leaf, DoorOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/reminders/notification-bell";
import type { ReminderItem, CycleEventItem } from "@/features/reminders/types";

interface BottomTabBarProps {
  householdId: string;
  householdSlug: string;
  notificationCount: number;
  reminderItems: ReminderItem[];
  cycleEvents: CycleEventItem[];
}

/**
 * D-21, D-22 (v1 tech debt fix): the 4th tab slot delegates to the unified
 * <NotificationBell variant="mobile" />. Eliminates the previous inline
 * DropdownMenu + "9+" badge regression + reminders-only dropdown content.
 */
export function BottomTabBar({
  householdId,
  householdSlug,
  notificationCount,
  reminderItems,
  cycleEvents,
}: BottomTabBarProps) {
  const pathname = usePathname();

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
                isActive ? "text-accent" : "text-muted-foreground",
              )}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span>{label}</span>
            </Link>
          );
        })}

        {/* D-21, D-22: Alerts tab slot delegates to the unified bell. */}
        <NotificationBell
          variant="mobile"
          householdId={householdId}
          householdSlug={householdSlug}
          count={notificationCount}
          reminderItems={reminderItems}
          cycleEvents={cycleEvents}
        />
      </div>
    </nav>
  );
}

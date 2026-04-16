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

const TABS = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard", exact: true },
  { href: "/plants", icon: Leaf, label: "Plants", exact: false },
  { href: "/rooms", icon: DoorOpen, label: "Rooms", exact: false },
] as const;

interface BottomTabBarProps {
  notificationCount: number;
  reminderItems: ReminderItem[];
}

export function BottomTabBar({
  notificationCount,
  reminderItems,
}: BottomTabBarProps) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav
      aria-label="Main navigation"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      <div className="flex h-14 items-stretch">
        {TABS.map(({ href, icon: Icon, label, exact }) => {
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
                  onClick={() => router.push(`/plants/${item.plantId}`)}
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

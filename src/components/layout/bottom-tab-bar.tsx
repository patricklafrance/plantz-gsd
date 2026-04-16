"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Leaf, DoorOpen, Bell } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard", exact: true },
  { href: "/plants", icon: Leaf, label: "Plants", exact: false },
  { href: "/rooms", icon: DoorOpen, label: "Rooms", exact: false },
  { href: "/notifications", icon: Bell, label: "Alerts", exact: false },
] as const;

interface BottomTabBarProps {
  notificationCount: number;
}

export function BottomTabBar({ notificationCount }: BottomTabBarProps) {
  const pathname = usePathname();

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
              href={href === "/notifications" ? "/dashboard" : href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 text-xs min-h-[44px] rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1",
                isActive ? "text-accent" : "text-muted-foreground"
              )}
            >
              {label === "Alerts" ? (
                <span className="relative">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  {notificationCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
                      {notificationCount > 9 ? "9+" : notificationCount}
                    </span>
                  )}
                </span>
              ) : (
                <Icon className="h-5 w-5" aria-hidden="true" />
              )}
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

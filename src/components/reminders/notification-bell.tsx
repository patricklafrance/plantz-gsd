"use client";

import { Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { buttonVariants } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import type { ReminderItem } from "@/features/reminders/types";

interface NotificationBellProps {
  count: number;
  items: ReminderItem[];
}

export function NotificationBell({ count, items }: NotificationBellProps) {
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={
          count > 0
            ? `${count} plants need attention`
            : "No plants need attention"
        }
        render={
          <button
            className={buttonVariants({
              variant: "ghost",
              size: "icon",
              className: "relative p-2.5",
            })}
          />
        }
      >
        <Bell
          className={`h-5 w-5 ${count > 0 ? "text-foreground" : "text-muted-foreground"}`}
        />
        {count > 0 && (
          <Badge
            className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 py-0 text-[10px] font-semibold text-accent-foreground"
          >
            {count > 99 ? "99+" : count}
          </Badge>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 max-h-[320px] overflow-y-auto">
        {items.length === 0 ? (
          <p className="px-4 py-2 text-sm text-muted-foreground">
            All caught up!
          </p>
        ) : (
          items.map((item) => (
            <DropdownMenuItem
              key={item.plantId}
              onClick={() => router.push(`/plants/${item.plantId}`)}
              className="flex cursor-pointer flex-col items-start gap-1 py-2"
            >
              <span className="text-sm font-semibold text-foreground">
                {item.nickname}
              </span>
              <span className="text-xs text-muted-foreground">
                {item.roomName ?? "No room"} &middot; {item.statusLabel}
              </span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

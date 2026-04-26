"use client";

import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, Sparkles, UserCheck, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReminderItem, CycleEventItem } from "@/features/reminders/types";
import { markNotificationsRead } from "@/features/household/actions";
import { memberNameText } from "@/components/household/member-name";

interface NotificationBellProps {
  variant: "desktop" | "mobile";
  householdId: string;
  householdSlug: string;
  count: number;
  reminderItems: ReminderItem[];
  cycleEvents: CycleEventItem[];
}

/**
 * D-17, D-22 — Single canonical bell, position-responsive via `variant` prop.
 * Desktop: ghost icon button in top-nav. Mobile: tab-shape in BottomTabBar.
 * D-18 — Merged dropdown feed: plant reminders + cycle events in fixed buckets
 *        (overdue → due-today → unread cycle events → read cycle events).
 * D-19 — Badge shows unified count (reminderCount + unreadCycleEventCount);
 *        both variants cap at 99+ (eliminates mobile '9+' regression).
 * D-20 — Mark-read on open via `useTransition` + `markNotificationsRead`
 *        Server Action. Uses async transition so React 19 tracks the full
 *        Server Action lifecycle and defers the revalidatePath router refresh
 *        to transition priority, preventing portal teardown races.
 */
export function NotificationBell({
  variant,
  householdId,
  householdSlug,
  count,
  reminderItems,
  cycleEvents,
}: NotificationBellProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // D-20: snapshot unread notification ids at render. The onOpenChange
  // handler closes over this memo; no re-read on open.
  const unreadCycleEventIds = useMemo(
    () =>
      cycleEvents.filter((e) => e.readAt === null).map((e) => e.notificationId),
    [cycleEvents],
  );

  const handleOpenChange = (open: boolean) => {
    if (!open) return;
    if (unreadCycleEventIds.length === 0) return;
    // D-20 fix: use async startTransition (React 19 pattern) so React tracks
    // the Server Action's full async lifecycle. The prior `void` pattern caused
    // startTransition to complete synchronously, leaving the revalidatePath
    // router refresh to run as a high-priority update outside the transition.
    // That high-priority update could interrupt the Base UI portal teardown
    // sequence and produce a "removeChild: node is not a child" DOM error.
    // With `await`, the router refresh is deferred to transition priority,
    // which cannot preempt React's in-flight commit work.
    startTransition(async () => {
      await markNotificationsRead({
        householdId,
        householdSlug,
        notificationIds: unreadCycleEventIds,
      });
    });
  };

  // D-18 merged feed buckets. Inputs are already filtered by upstream
  // queries (getReminderItems + getCycleNotificationsForViewer), so we only
  // sort within each bucket here.
  const overdue = reminderItems
    .filter((r) => r.daysOverdue > 0)
    .sort((a, b) =>
      b.daysOverdue !== a.daysOverdue
        ? b.daysOverdue - a.daysOverdue
        : a.nickname.localeCompare(b.nickname),
    );
  const dueToday = reminderItems
    .filter((r) => r.daysOverdue === 0)
    .sort((a, b) => a.nickname.localeCompare(b.nickname));
  const unreadEvents = cycleEvents.filter((e) => e.readAt === null);
  const readEvents = cycleEvents.filter((e) => e.readAt !== null);

  const isEmpty =
    overdue.length === 0 &&
    dueToday.length === 0 &&
    unreadEvents.length === 0 &&
    readEvents.length === 0;

  const ariaLabel =
    count > 0 ? `${count} notifications` : "No new notifications";
  const displayCount = count > 99 ? "99+" : String(count);

  // Variant-branched trigger. Keeps dropdown content identical across variants.
  const trigger =
    variant === "desktop" ? (
      <button
        aria-label={ariaLabel}
        className={buttonVariants({
          variant: "ghost",
          size: "icon",
          className: "relative p-2.5",
        })}
      >
        <Bell
          className={cn(
            "h-5 w-5",
            count > 0 ? "text-foreground" : "text-muted-foreground",
          )}
        />
        {count > 0 && (
          <Badge className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 py-0 text-[10px] font-semibold text-accent-foreground">
            {displayCount}
          </Badge>
        )}
      </button>
    ) : (
      <button
        aria-label={ariaLabel}
        className="flex flex-1 flex-col items-center justify-center gap-0.5 text-xs min-h-[44px] rounded-md text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1 aria-expanded:text-accent"
      >
        <span className="relative">
          <Bell className="h-5 w-5" aria-hidden="true" />
          {count > 0 && (
            <Badge className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 py-0 text-[10px] font-semibold text-accent-foreground">
              {displayCount}
            </Badge>
          )}
        </span>
        <span>Alerts</span>
      </button>
    );

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger render={trigger} />
      <DropdownMenuContent
        align="end"
        side={variant === "mobile" ? "top" : "bottom"}
        className="w-72 max-h-[320px] overflow-y-auto"
      >
        {isEmpty ? (
          <div className="px-4 py-6 space-y-1">
            <p className="text-sm font-semibold text-foreground">
              You&apos;re all caught up
            </p>
            <p className="text-xs text-muted-foreground">
              New reminders and cycle updates will appear here.
            </p>
          </div>
        ) : (
          <>
            {[...overdue, ...dueToday].map((item) => (
              <DropdownMenuItem
                key={item.plantId}
                onClick={() =>
                  router.push(`/h/${householdSlug}/plants/${item.plantId}`)
                }
                className="group/item flex cursor-pointer flex-col items-start gap-1 py-2"
              >
                <span className="text-sm font-semibold text-foreground group-data-[highlighted]/item:text-accent-foreground">
                  {item.nickname}
                </span>
                <span className="text-xs text-muted-foreground group-data-[highlighted]/item:text-accent-foreground/70">
                  {item.roomName ?? "No room"} &middot; {item.statusLabel}
                </span>
              </DropdownMenuItem>
            ))}
            {unreadEvents.map((event) => (
              <CycleEventRow
                key={event.notificationId}
                event={event}
                muted={false}
              />
            ))}
            {readEvents.map((event) => (
              <CycleEventRow
                key={event.notificationId}
                event={event}
                muted={true}
              />
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CycleEventRow({
  event,
  muted,
}: {
  event: CycleEventItem;
  muted: boolean;
}) {
  const Icon =
    event.type === "cycle_started"
      ? Sparkles
      : event.type === "cycle_fallback_owner"
        ? AlertTriangle
        : UserCheck;

  const priorLabel = memberNameText(event.priorAssigneeName, event.priorAssigneeEmail);
  const subject =
    event.type === "cycle_started"
      ? "You're up this cycle"
      : event.type === "cycle_fallback_owner"
        ? "You're covering (nobody available)"
        : event.type === "cycle_reassigned_manual_skip"
          ? `${priorLabel} skipped — you're covering`
          : event.type === "cycle_reassigned_auto_skip"
            ? `${priorLabel} is unavailable — you're covering`
            : `${priorLabel} left — you're covering`;

  return (
    <DropdownMenuItem
      className={cn(
        "group/item flex cursor-pointer items-start gap-2 py-2",
        !muted && "border-l-2 border-accent pl-3",
        muted && "opacity-60",
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0 mt-0.5",
          muted ? "text-muted-foreground" : "text-accent",
        )}
        aria-hidden="true"
      />
      <div className="flex-1 space-y-0.5">
        <span
          className={cn(
            "text-sm",
            muted ? "text-muted-foreground" : "font-semibold text-foreground",
          )}
        >
          {subject}
        </span>
      </div>
    </DropdownMenuItem>
  );
}

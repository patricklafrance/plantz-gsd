// No client directive — this is a pure presentational component with no
// hooks or interactivity. Sibling banners (passive-status-banner.tsx) are also
// non-client. They can be rendered inside a Server Component OR a Client
// Component; both work.

import { Calendar, Clock } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export type CycleCountdownBannerProps = {
  daysLeft: number;
  nextAssigneeName: string | null;
  cycleEndDate: Date;
  isSingleMember: boolean;
};

/**
 * D-23 / D-24 / D-25 — Dashboard cycle-countdown banner for the current
 * assignee when there is no unread cycle event pending. The fifth dashboard
 * banner (alongside Fallback, CycleStart, Reassignment, PassiveStatus).
 *
 * Caller-gated per D-25: the dashboard Server Component (Plan 07) gates
 * rendering on `viewerIsAssignee && currentCycle.status === "active" &&
 * !hasUnreadCycleEvent`. This component is unconditional on its props and
 * contains no hooks, no session reads, no query reads.
 *
 * Variants:
 *   - Normal (daysLeft > 1): accent palette + Calendar icon
 *   - Urgency (daysLeft <= 1): destructive palette + Clock icon (still a
 *     status-level region, not urgent-alert level per D-25 — steady state)
 *
 * Copy branches (four total):
 *   - Single-member + normal: "You're on rotation — N days left in this cycle."
 *   - Single-member + urgent: "Last day — you're on rotation."
 *   - Multi-member + normal:  "You're up this week — N days left. {Next} is next."
 *   - Multi-member + urgent:  "Last day — tomorrow passes to {Next}."
 */
export function CycleCountdownBanner({
  daysLeft,
  nextAssigneeName,
  cycleEndDate,
  isSingleMember,
}: CycleCountdownBannerProps) {
  const isUrgent = daysLeft <= 1;
  const Icon = isUrgent ? Clock : Calendar;

  const formattedEndDate = format(cycleEndDate, "MMM d, yyyy");

  let primaryLine: string;
  if (isSingleMember) {
    primaryLine = isUrgent
      ? "Last day — you're on rotation."
      : `You're on rotation — ${formatDaysLeft(daysLeft)} left in this cycle.`;
  } else {
    if (isUrgent) {
      primaryLine = nextAssigneeName
        ? `Last day — tomorrow passes to ${nextAssigneeName}.`
        : "Last day on rotation.";
    } else {
      const nextClause = nextAssigneeName ? ` ${nextAssigneeName} is next.` : "";
      primaryLine = `You're up this week — ${formatDaysLeft(daysLeft)}.${nextClause}`;
    }
  }

  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-lg border px-4 py-3",
        isUrgent
          ? "bg-destructive/10 border-destructive/30"
          : "bg-accent/10 border-accent/30"
      )}
    >
      <Icon
        className={cn(
          "h-5 w-5 shrink-0 mt-0.5",
          isUrgent ? "text-destructive" : "text-accent"
        )}
        aria-hidden="true"
      />
      <div className="flex-1 space-y-1">
        <p className="text-sm text-foreground">{primaryLine}</p>
        <p className="text-xs text-muted-foreground">Cycle ends {formattedEndDate}</p>
      </div>
    </div>
  );
}

function formatDaysLeft(n: number): string {
  return n === 1 ? "1 day left" : `${n} days left`;
}

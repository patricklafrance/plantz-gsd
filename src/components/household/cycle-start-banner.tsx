import { Sparkles } from "lucide-react";
import { format } from "date-fns";

interface CycleStartBannerProps {
  // INTENTIONAL DEVIATION from PATTERNS.md §cycle-start-banner:
  // `assigneeName` is NOT accepted. The UI-SPEC copy "You're up this cycle."
  // addresses the viewer in second person and never names them. The dashboard
  // page (Plan 05-05) only mounts this banner when viewerIsAssignee === true,
  // so the second-person addressing is authoritative.
  dueCount: number;
  cycleEndDate: Date;
  /** Phase 8.1: optional right-aligned action slot (e.g. Skip button). */
  action?: React.ReactNode;
}

/**
 * HNTF-02 / D-12.1 — Dashboard banner shown to the new cycle assignee with
 * an unread `cycle_started` HouseholdNotification row for the current active
 * cycle. Read-only (D-16): never writes readAt on render.
 *
 * Caller (dashboard page Server Component) gates rendering on:
 *   viewerIsAssignee && unreadNotification?.type === "cycle_started"
 * Props-only: no DB calls, no hooks.
 */
export function CycleStartBanner({ dueCount, cycleEndDate, action }: CycleStartBannerProps) {
  const formattedEndDate = format(cycleEndDate, "EEE MMM d");
  const meta =
    dueCount > 0
      ? `${dueCount} ${dueCount === 1 ? "plant" : "plants"} due · Cycle ends ${formattedEndDate}`
      : `No plants due right now · Cycle ends ${formattedEndDate}`;

  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-lg border border-accent/30 bg-accent/10 px-4 py-3"
    >
      <Sparkles className="h-5 w-5 shrink-0 text-accent mt-0.5" aria-hidden="true" />
      <div className="flex-1 space-y-1">
        <p className="text-sm text-foreground">
          <span className="font-semibold">You&apos;re up this cycle.</span>
        </p>
        <p className="text-xs text-muted-foreground">{meta}</p>
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}

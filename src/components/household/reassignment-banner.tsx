import { UserCheck } from "lucide-react";
import { format } from "date-fns";

type ReassignType = "manual_skip" | "auto_skip" | "member_left";

interface ReassignmentBannerProps {
  priorAssigneeName: string;
  reassignType: ReassignType;
  dueCount: number;
  cycleEndDate: Date;
}

/**
 * HNTF-03 / D-12.2 — Dashboard banner shown to the new assignee after a
 * mid-cycle reassignment (manual skip, auto-skip due to unavailability, or
 * a member leaving). Type-branched subject copy; shared meta.
 *
 * D-06 derivational clearing: caller filters notifications to
 * `notification.cycleId === currentActiveCycle.id` so the previous assignee's
 * banner naturally disappears once the new cycle transitions in. This
 * component is unaware of the filter.
 */
export function ReassignmentBanner({
  priorAssigneeName,
  reassignType,
  dueCount,
  cycleEndDate,
}: ReassignmentBannerProps) {
  const verbPhrase: Record<ReassignType, string> = {
    manual_skip: "skipped — you're covering this cycle.",
    auto_skip: "is unavailable — you're covering this cycle.",
    member_left: "left the household — you're covering this cycle.",
  };

  const formattedEndDate = format(cycleEndDate, "EEE MMM d");
  const meta =
    dueCount > 0
      ? `${dueCount} ${dueCount === 1 ? "plant" : "plants"} due · Cycle ends ${formattedEndDate}`
      : `Cycle ends ${formattedEndDate}`;

  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-lg border border-accent/30 bg-accent/10 px-4 py-3"
    >
      <UserCheck className="h-5 w-5 shrink-0 text-accent mt-0.5" aria-hidden="true" />
      <div className="flex-1 space-y-1">
        <p className="text-sm text-foreground">
          <span className="font-semibold">{priorAssigneeName}</span> {verbPhrase[reassignType]}
        </p>
        <p className="text-xs text-muted-foreground">{meta}</p>
      </div>
    </div>
  );
}

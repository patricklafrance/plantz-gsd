import { UserCheck } from "lucide-react";
import { format } from "date-fns";
import { MemberName } from "./member-name";

type ReassignType = "manual_skip" | "auto_skip" | "member_left";

interface ReassignmentBannerProps {
  priorAssigneeName?: string | null;
  priorAssigneeEmail?: string | null;
  reassignType: ReassignType;
  dueCount: number;
  cycleEndDate: Date;
}

/**
 * HNTF-03 / D-12.2 — banner shown to the new assignee after a mid-cycle
 * reassignment. Phase 8.3: priorAssignee renders as [name] (email) with name
 * highlighted; falls back to email-only or "Someone" when both are missing.
 */
export function ReassignmentBanner({
  priorAssigneeName,
  priorAssigneeEmail,
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
          <MemberName name={priorAssigneeName} email={priorAssigneeEmail} />{" "}
          {verbPhrase[reassignType]}
        </p>
        <p className="text-xs text-muted-foreground">{meta}</p>
      </div>
    </div>
  );
}

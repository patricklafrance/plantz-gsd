import { Users } from "lucide-react";
import { format } from "date-fns";
import { MemberName } from "./member-name";

interface PassiveStatusBannerProps {
  assigneeName?: string | null;
  assigneeEmail?: string | null;
  nextAssigneeName?: string | null;
  nextAssigneeEmail?: string | null;
  nextIsFallbackOwner?: boolean;
  memberCount: number;
  cycleEndDate: Date;
}

/**
 * HNTF-04 / D-12.3 — Dashboard passive-status banner for non-assignees.
 * Phase 8.3: renders [name] (email) with the name highlighted; falls back to
 * just email when name is unset (no "() (email)" or "null (email)" artifacts).
 */
export function PassiveStatusBanner({
  assigneeName,
  assigneeEmail,
  nextAssigneeName,
  nextAssigneeEmail,
  nextIsFallbackOwner,
  memberCount,
  cycleEndDate,
}: PassiveStatusBannerProps) {
  const hasNext =
    memberCount > 1 &&
    (Boolean(nextAssigneeName?.trim()) || Boolean(nextAssigneeEmail?.trim()));

  const formattedEndDate = format(cycleEndDate, "EEE MMM d");

  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3"
    >
      <Users className="h-5 w-5 shrink-0 text-muted-foreground mt-0.5" aria-hidden="true" />
      <div className="flex-1 space-y-1">
        <p className="text-sm text-foreground">
          <MemberName name={assigneeName} email={assigneeEmail} /> is watering this cycle.
          {hasNext && (
            <>
              {" "}
              <MemberName name={nextAssigneeName} email={nextAssigneeEmail} />
              {nextIsFallbackOwner
                ? " covers if no one's available next."
                : " is next up."}
            </>
          )}
        </p>
        <p className="text-xs text-muted-foreground">Cycle ends {formattedEndDate}</p>
      </div>
    </div>
  );
}

import { Users } from "lucide-react";
import { format } from "date-fns";

interface PassiveStatusBannerProps {
  assigneeName: string;
  nextAssigneeName?: string;
  nextIsFallbackOwner?: boolean;
  memberCount: number;
  cycleEndDate: Date;
}

/**
 * HNTF-04 / D-12.3 — Dashboard passive-status banner for non-assignees.
 * Shows who is currently responsible and (for multi-member households) who is
 * next up. When the "next" is owner-fallback per Phase 3 D-20, the copy
 * changes to "covers if no one's available next."
 *
 * Caller suppression: render nothing when the viewer IS the assignee or when
 * memberCount === 1 AND viewer IS the assignee. When memberCount === 1 and
 * viewer is NOT the assignee (impossible — single-member household means
 * viewer IS the sole member), caller should not render this banner. In other
 * words: this component is only rendered for non-assignees of multi-member
 * households. The nextAssigneeName/memberCount props are defensive fallback
 * guards for the single-member edge case.
 */
export function PassiveStatusBanner({
  assigneeName,
  nextAssigneeName,
  nextIsFallbackOwner,
  memberCount,
  cycleEndDate,
}: PassiveStatusBannerProps) {
  const showNextLine =
    memberCount > 1 &&
    typeof nextAssigneeName === "string" &&
    nextAssigneeName.length > 0;

  const formattedEndDate = format(cycleEndDate, "EEE MMM d");

  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3"
    >
      <Users className="h-5 w-5 shrink-0 text-muted-foreground mt-0.5" aria-hidden="true" />
      <div className="flex-1 space-y-1">
        <p className="text-sm text-foreground">
          <span className="font-semibold">{assigneeName}</span> is watering this cycle.
          {showNextLine && (
            <>
              {" "}
              <span className="font-semibold">{nextAssigneeName}</span>
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

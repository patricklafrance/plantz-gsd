import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";

interface FallbackBannerProps {
  viewerIsOwner: boolean;
  ownerName: string;
  /** cycle.status === "paused" (strict) vs transitionReason === "all_unavailable_fallback" */
  isPaused: boolean;
}

/**
 * AVLB-05 / D-12.4 — Dashboard fallback banner rendered when the household's
 * current Cycle is paused (all-unavailable AND owner unavailable, per Phase 3
 * D-20 reconciliation) OR when transitionReason === "all_unavailable_fallback"
 * (owner is covering for everyone).
 *
 * Three copy branches: owner-is-covering (viewerIsOwner), owner-is-covering
 * (non-owner viewer), and paused (nobody is covering).
 *
 * role="alert" (not "status") — matches the TimezoneWarning + DestructiveLeaveDialog
 * precedent for urgent state that SR users should hear immediately.
 *
 * Precedent color tokens: bg-destructive/10 + border-destructive/30 + text-destructive
 * (WCAG-verified in globals.css; no new warning-amber token introduced — UI-SPEC §Color).
 */
export function FallbackBanner({ viewerIsOwner, ownerName, isPaused }: FallbackBannerProps) {
  let subject: ReactNode;
  let meta: string;
  if (isPaused) {
    subject = "This week's rotation is paused.";
    meta = "Someone needs to step up — plants still need water.";
  } else if (viewerIsOwner) {
    subject = "Nobody's available — you're covering this cycle.";
    meta = "Check back when members update their availability.";
  } else {
    subject = (
      <>
        Nobody&apos;s available — <span className="font-semibold">{ownerName}</span> is covering this cycle.
      </>
    );
    meta = "You can update your availability in settings.";
  }

  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3"
    >
      <AlertTriangle className="h-5 w-5 shrink-0 text-destructive mt-0.5" aria-hidden="true" />
      <div className="flex-1 space-y-1">
        <p className="text-sm text-foreground">
          <span className="font-semibold">{subject}</span>
        </p>
        <p className="text-xs text-muted-foreground">{meta}</p>
      </div>
    </div>
  );
}

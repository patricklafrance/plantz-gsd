import { cn } from "@/lib/utils";

interface MemberNameProps {
  name: string | null | undefined;
  email: string | null | undefined;
  /** Optional className for the rendered <span>. */
  className?: string;
  /** Render the email parens muted (default). When false, email matches name color. */
  muteEmail?: boolean;
  /** Use bold weight on the name token. Defaults to true. */
  bold?: boolean;
}

/**
 * Phase 8.3 — Canonical viewer-of-other display:
 *   - Both name + email present:  **Pat** (pat@example.com)
 *   - Only email present:         pat@example.com
 *   - Only name present:          **Pat**
 *   - Neither present:            "Someone"   (caller-provided fallback site uses "A member" /
 *                                              "Someone" depending on copy; this component
 *                                              renders nothing-friendly when it has nothing)
 *
 * Always avoids the "() (email)" or "null (email)" artifacts the v1 copy was
 * vulnerable to.
 */
export function MemberName({
  name,
  email,
  className,
  muteEmail = true,
  bold = true,
}: MemberNameProps) {
  const trimmedName = name?.trim() || null;
  const trimmedEmail = email?.trim() || null;

  if (!trimmedName && !trimmedEmail) {
    return <span className={className}>Someone</span>;
  }

  if (trimmedName && trimmedEmail) {
    return (
      <span className={className}>
        <span className={cn(bold && "font-semibold", "text-foreground")}>
          {trimmedName}
        </span>{" "}
        <span className={cn(muteEmail && "text-muted-foreground", "text-xs")}>
          ({trimmedEmail})
        </span>
      </span>
    );
  }

  // Single token — name only OR email only — render plain (no parens).
  return (
    <span className={cn(bold && "font-semibold", className)}>
      {trimmedName ?? trimmedEmail}
    </span>
  );
}

/**
 * Plain-text version for places that need a string (alt text, aria labels,
 * toasts). Matches MemberName's truthiness rules and "Someone" fallback.
 */
export function memberNameText(
  name: string | null | undefined,
  email: string | null | undefined,
): string {
  const n = name?.trim() || null;
  const e = email?.trim() || null;
  if (!n && !e) return "Someone";
  if (n && e) return `${n} (${e})`;
  return n ?? e!;
}

/**
 * Phase 8.2 — derive a friendly household name from a user's display name.
 *
 *   "Pat"        → "Pat's plants"
 *   "Pat Smith"  → "Pat's plants"          (first token only)
 *   "Charles"    → "Charles's plants"
 *   "Chris"      → "Chris' plants"         (name ending in 's' takes apostrophe-only)
 *   ""  / null   → "My plants"             (safe fallback)
 *
 * Used at signup to seed the auto-created solo household and as the one-time
 * data flush for legacy "My Plants" rows whose owner now has a name.
 */
export function deriveHouseholdName(rawName: string | null | undefined): string {
  if (!rawName) return "My plants";
  const trimmed = rawName.trim();
  if (!trimmed) return "My plants";
  const firstToken = trimmed.split(/\s+/)[0];
  if (!firstToken) return "My plants";
  const lastChar = firstToken.charAt(firstToken.length - 1).toLowerCase();
  const possessive = lastChar === "s" ? `${firstToken}'` : `${firstToken}'s`;
  return `${possessive} plants`;
}

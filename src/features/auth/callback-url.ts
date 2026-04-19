/**
 * Open-redirect guard for `?callbackUrl=` query params (Phase 4 GAP-04-01).
 *
 * Returns the URL if it is a same-origin relative path, or null otherwise.
 * Callers should fall back to a safe default (e.g. "/dashboard") on null.
 *
 * Rejects:
 *   - Non-string / empty values
 *   - Absolute URLs (`http://`, `https://`, any `<scheme>://`)
 *   - Protocol-relative URLs (`//evil.com`)
 *   - Backslash-prefixed paths (`/\evil.com` — some browsers normalize to `//`)
 *   - Any value not starting with `/`
 */
export function validateCallbackUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//") || value.startsWith("/\\")) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return null;
  return value;
}

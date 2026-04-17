import { cache } from "react";
import { notFound } from "next/navigation";
import { resolveHouseholdBySlug } from "./queries";
import { requireHouseholdAccess } from "./guards";

/**
 * Per-request cached: resolves slug → householdId → membership context.
 * Called from the household layout (mandatory chokepoint, D-03) and from any
 * nested Server Component that needs the household. React.cache() ensures
 * the DB round-trips happen at most once per request.
 *
 * Per D-03/D-18: this is per-request, NOT cross-request — a user removed
 * mid-session sees the change on their next page load. Does NOT cross
 * Server-Component → Server-Action boundary; every mutating action still
 * hits the live DB via requireHouseholdAccess() directly.
 *
 * Throws via notFound() (404) for unknown slugs.
 * Throws ForbiddenError (403) via requireHouseholdAccess for non-members.
 */
export const getCurrentHousehold = cache(async (slug: string) => {
  const summary = await resolveHouseholdBySlug(slug);
  if (!summary) notFound();
  return await requireHouseholdAccess(summary.id);
});

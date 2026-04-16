import { db } from "@/lib/db";

/**
 * D-17: Resolve a URL slug to a household identifier.
 *
 * Used by Server Components to translate `/h/[householdSlug]` URL params
 * into a `householdId` that can be passed to `requireHouseholdAccess()`.
 *
 * Returns null when the slug is unknown — the caller decides whether to
 * 404 or redirect. This function does NOT call `auth()`; authentication
 * and authorization are the guard's job (D-16/D-18).
 */
export async function resolveHouseholdBySlug(slug: string) {
  return db.household.findUnique({
    where: { slug },
    select: { id: true, name: true },
  });
}

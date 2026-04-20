/**
 * Legacy redirect stub — Plan 03a migrates the real dashboard to
 * /h/[householdSlug]/dashboard. This stub redirects to the user's
 * active household dashboard.
 *
 * WR-03: The JWT's activeHouseholdId hint can be stale (JWT issued before the
 * household was created, or the referenced household was deleted). Always fall
 * back to a live membership query so new users aren't silently bounced to
 * /login. When no membership exists at all, surface an explicit error query
 * param instead of a silent redirect.
 */
import { auth } from "../../../../auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";

async function resolveActiveHouseholdSlug(userId: string, hint?: string) {
  if (hint) {
    const hinted = await db.household.findUnique({
      where: { id: hint },
      select: { slug: true },
    });
    if (hinted) return hinted.slug;
  }
  // Live fallback — JWT hint was stale or missing.
  const membership = await db.householdMember.findFirst({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: { household: { select: { slug: true } } },
  });
  return membership?.household.slug ?? null;
}

export default async function LegacyDashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const slug = await resolveActiveHouseholdSlug(
    session.user.id,
    session.user.activeHouseholdId,
  );
  if (!slug) redirect("/login?error=no_household");

  redirect(`/h/${slug}/dashboard`);
}

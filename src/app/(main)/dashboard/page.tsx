/**
 * Legacy redirect stub — Plan 03a migrates the real dashboard to
 * /h/[householdSlug]/dashboard. The root page (`/`) resolves the active
 * household directly, so a signed-in user lands on /h/[slug]/dashboard
 * in one hop. This stub remains for any inbound links that still point
 * at /dashboard (bookmarks, external references, old emails).
 */
import { auth } from "../../../../auth";
import { redirect } from "next/navigation";
import { resolveActiveHouseholdSlug } from "@/features/household/queries";

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

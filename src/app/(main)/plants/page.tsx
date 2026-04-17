/**
 * Legacy redirect stub — Plan 03a migrates the real plants page to
 * /h/[householdSlug]/plants. This stub redirects to the user's
 * active household plants page.
 */
import { auth } from "../../../../auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";

export default async function LegacyPlantsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const id = session.user.activeHouseholdId;
  if (!id) redirect("/login");

  const household = await db.household.findUnique({
    where: { id },
    select: { slug: true },
  });
  if (!household) redirect("/login");

  const params = await searchParams;
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined)) as Record<string, string>
  ).toString();

  redirect(qs ? `/h/${household.slug}/plants?${qs}` : `/h/${household.slug}/plants`);
}

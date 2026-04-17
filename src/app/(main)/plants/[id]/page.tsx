/**
 * Legacy redirect stub — Plan 03a migrates the real plant detail page to
 * /h/[householdSlug]/plants/[id]. This stub redirects to the user's
 * active household plant detail page.
 */
import { auth } from "../../../../../auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";

export default async function LegacyPlantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
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

  const { id: plantId } = await params;
  redirect(`/h/${household.slug}/plants/${plantId}`);
}

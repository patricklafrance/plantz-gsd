/**
 * Legacy redirect stub — Plan 03a migrates the real rooms page to
 * /h/[householdSlug]/rooms. This stub redirects to the user's
 * active household rooms page.
 */
import { auth } from "../../../../auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";

export default async function LegacyRoomsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const id = session.user.activeHouseholdId;
  if (!id) redirect("/login");

  const household = await db.household.findUnique({
    where: { id },
    select: { slug: true },
  });
  if (!household) redirect("/login");

  redirect(`/h/${household.slug}/rooms`);
}

/**
 * Legacy redirect stub — Plan 03a migrates the real room detail page to
 * /h/[householdSlug]/rooms/[id]. This stub redirects to the user's
 * active household room detail page.
 */
import { auth } from "../../../../../auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";

export default async function LegacyRoomDetailPage({
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

  const { id: roomId } = await params;
  redirect(`/h/${household.slug}/rooms/${roomId}`);
}

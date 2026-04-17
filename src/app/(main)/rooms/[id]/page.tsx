/**
 * Legacy redirect stub — Plan 03a migrates the real room detail page to
 * /h/[householdSlug]/rooms/[id]. This stub redirects to the user's
 * active household room detail page.
 *
 * WR-03: Fall back to a live membership query when the JWT hint is stale or
 * missing, and surface an explicit error param when no household exists.
 */
import { auth } from "../../../../../auth";
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
  const membership = await db.householdMember.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { household: { select: { slug: true } } },
  });
  return membership?.household.slug ?? null;
}

export default async function LegacyRoomDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const slug = await resolveActiveHouseholdSlug(
    session.user.id,
    session.user.activeHouseholdId,
  );
  if (!slug) redirect("/login?error=no_household");

  const { id: roomId } = await params;
  redirect(`/h/${slug}/rooms/${roomId}`);
}

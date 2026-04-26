import { auth } from "../../auth";
import { redirect } from "next/navigation";
import { resolveActiveHouseholdSlug } from "@/features/household/queries";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const slug = await resolveActiveHouseholdSlug(
    session.user.id,
    session.user.activeHouseholdId,
  );
  if (!slug) {
    redirect("/login?error=no_household");
  }

  redirect(`/h/${slug}/dashboard`);
}

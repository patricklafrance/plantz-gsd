import { auth } from "../../../../../../auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { PreferencesForm } from "@/components/preferences/preferences-form";
import { getUserHouseholds } from "@/features/household/queries";

export default async function PreferencesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const [user, userHouseholds] = await Promise.all([
    db.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, remindersEnabled: true },
    }),
    getUserHouseholds(session.user.id),
  ]);

  if (!user) {
    redirect("/login");
  }

  // The "Default household" select is only meaningful when the user belongs
  // to 2+ households — a single-membership user has nothing to swap to.
  const householdOptions = userHouseholds.map((uh) => ({
    id: uh.household.id,
    name: uh.household.name,
  }));
  const defaultHouseholdId =
    userHouseholds.find((uh) => uh.isDefault)?.household.id ??
    householdOptions[0]?.id ??
    "";

  return (
    <PreferencesForm
      initialRemindersEnabled={user.remindersEnabled}
      userEmail={user.email}
      isDemo={session.user.isDemo ?? false}
      households={householdOptions}
      defaultHouseholdId={defaultHouseholdId}
    />
  );
}

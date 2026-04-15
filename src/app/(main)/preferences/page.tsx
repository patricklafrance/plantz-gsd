import { auth } from "../../../../auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { PreferencesForm } from "@/components/preferences/preferences-form";

export default async function PreferencesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, remindersEnabled: true },
  });

  if (!user) {
    redirect("/login");
  }

  return (
    <PreferencesForm
      initialRemindersEnabled={user.remindersEnabled}
      userEmail={user.email}
      isDemo={session.user.isDemo ?? false}
    />
  );
}

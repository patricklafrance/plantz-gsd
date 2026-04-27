import { auth } from "../../../../../../auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { PreferencesForm } from "@/components/preferences/preferences-form";
import { getCurrentHousehold } from "@/features/household/context";

type PageProps = {
  params: Promise<{ householdSlug: string }>;
};

export default async function PreferencesPage({ params }: PageProps) {
  const { householdSlug } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { household } = await getCurrentHousehold(householdSlug);

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, remindersEnabled: true },
  });

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8 space-y-8 pb-20 sm:pb-8">
      <header>
        <h1 className="text-2xl font-semibold outline-none" tabIndex={-1}>
          Account
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{household.name}</p>
      </header>

      <PreferencesForm
        initialRemindersEnabled={user.remindersEnabled}
        userEmail={user.email}
        isDemo={session.user.isDemo ?? false}
      />
    </main>
  );
}

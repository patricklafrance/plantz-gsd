import { auth } from "../../../../../../auth";
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
    <main className="max-w-2xl mx-auto px-4 py-8 space-y-8 pb-20 sm:pb-8">
      <header>
        <h1 className="text-2xl font-semibold outline-none" tabIndex={-1}>
          Account
        </h1>
      </header>

      <PreferencesForm
        initialRemindersEnabled={user.remindersEnabled}
        userEmail={user.email}
        isDemo={session.user.isDemo ?? false}
      />
    </main>
  );
}

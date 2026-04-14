import { auth } from "../../../../auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { OnboardingBanner } from "@/components/onboarding/onboarding-banner";
import { Leaf } from "lucide-react";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { onboardingCompleted: true },
  });

  return (
    <div className="space-y-lg">
      {!user?.onboardingCompleted && (
        <OnboardingBanner userId={session.user.id} />
      )}

      {/* Empty state — visible below banner (D-06) */}
      <div className="flex flex-col items-center justify-center py-3xl text-center">
        <div className="mb-md rounded-full bg-accent/10 p-lg">
          <Leaf className="h-8 w-8 text-accent" />
        </div>
        <h2 className="text-xl font-semibold">No plants yet</h2>
        <p className="mt-sm text-muted-foreground">
          Add your first plant to start tracking your watering schedule.
        </p>
      </div>
    </div>
  );
}

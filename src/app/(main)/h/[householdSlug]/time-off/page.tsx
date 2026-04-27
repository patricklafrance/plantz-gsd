import { redirect } from "next/navigation";
import { auth } from "../../../../../../auth";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentHousehold } from "@/features/household/context";
import { getHouseholdAvailabilities } from "@/features/household/queries";
import { AvailabilitySection } from "@/components/household/settings/availability-section";

type PageProps = {
  params: Promise<{ householdSlug: string }>;
};

export default async function TimeOffPage({ params }: PageProps) {
  const { householdSlug } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { household, role } = await getCurrentHousehold(householdSlug);
  const availabilities = await getHouseholdAvailabilities(household.id);

  const availabilityRows = availabilities.map((a) => ({
    id: a.id,
    userId: a.userId,
    userName: a.user.name,
    userEmail: a.user.email,
    startDate: a.startDate,
    endDate: a.endDate,
    reason: a.reason,
  }));

  return (
    <main className="max-w-2xl mx-auto px-4 py-8 space-y-8 pb-20 sm:pb-8">
      <header>
        <h1 className="text-2xl font-semibold outline-none" tabIndex={-1}>
          Time off
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Block dates when you can&apos;t water — vacation, travel, or anything
          else. The rotation will skip your turn during these dates.
        </p>
      </header>

      <Card>
        <CardContent className="space-y-4">
          <AvailabilitySection
            availabilities={availabilityRows}
            viewerUserId={session.user.id}
            viewerRole={role}
            householdId={household.id}
            householdSlug={householdSlug}
          />
        </CardContent>
      </Card>
    </main>
  );
}

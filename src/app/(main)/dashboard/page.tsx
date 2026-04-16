import { auth } from "../../../../auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { OnboardingBanner } from "@/components/onboarding/onboarding-banner";
import { AddPlantDialog } from "@/components/plants/add-plant-dialog";
import { getCatalog } from "@/features/plants/queries";
import { getRoomsForSelect } from "@/features/rooms/queries";
import { getDashboardPlants } from "@/features/watering/queries";
import { DashboardClient } from "@/components/watering/dashboard-client";
import { Leaf, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Suspense } from "react";

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      {[1, 2].map((section) => (
        <div key={section} className="space-y-2">
          <Skeleton className="h-5 w-24" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 p-4">
                <Skeleton className="h-10 w-10 rounded-md" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

async function DashboardContent({
  userId,
  catalog,
  rooms,
  isDemo,
}: {
  userId: string;
  catalog: Awaited<ReturnType<typeof getCatalog>>;
  rooms: Awaited<ReturnType<typeof getRoomsForSelect>>;
  isDemo: boolean;
}) {
  // Read timezone cookie for date boundaries
  const cookieStore = await cookies();
  const userTz = cookieStore.get("user_tz")?.value ?? "UTC";

  // Compute today boundaries using user's timezone
  const now = new Date();
  const localDateStr = now.toLocaleDateString("en-CA", { timeZone: userTz }); // "2026-04-14"
  const [year, month, day] = localDateStr.split("-").map(Number);
  const todayStart = new Date(Date.UTC(year, month - 1, day));
  const todayEnd = new Date(Date.UTC(year, month - 1, day + 1));

  // Fetch dashboard plants and plant count in parallel
  const [groups, plantCount] = await Promise.all([
    getDashboardPlants(userId, todayStart, todayEnd),
    db.plant.count({ where: { userId, archivedAt: null } }),
  ]);

  const hasPlants = plantCount > 0;
  const totalInGroups =
    groups.overdue.length +
    groups.dueToday.length +
    groups.upcoming.length +
    groups.recentlyWatered.length;
  const allCaughtUp =
    hasPlants &&
    groups.overdue.length === 0 &&
    groups.dueToday.length === 0 &&
    groups.upcoming.length === 0 &&
    totalInGroups > 0;

  // No plants: empty state with AddPlantDialog CTA
  if (!hasPlants) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 rounded-full bg-accent/10 p-6">
          <Leaf className="h-8 w-8 text-accent" />
        </div>
        <h2 className="text-xl font-semibold">No plants yet</h2>
        <p className="mt-2 text-muted-foreground">
          Add your first plant to start tracking your watering schedule.
        </p>
        <div className="mt-4">
          <AddPlantDialog catalog={catalog} rooms={rooms} />
        </div>
      </div>
    );
  }

  // Normal dashboard — show "all caught up" banner when nothing needs attention
  return (
    <div className="space-y-8">
      {allCaughtUp && (
        <div className="flex items-center gap-2 rounded-lg bg-accent/10 px-4 py-2">
          <CheckCircle2 className="h-5 w-5 text-accent shrink-0" />
          <p className="text-sm font-medium">
            All caught up! Check back when the next one is due.
          </p>
        </div>
      )}
      <DashboardClient groups={groups} isDemo={isDemo} />
    </div>
  );
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const [user, catalog, rooms] = await Promise.all([
    db.user.findUnique({
      where: { id: session.user.id },
      select: { onboardingCompleted: true },
    }),
    getCatalog(),
    getRoomsForSelect(session.user.id),
  ]);

  return (
    <div className="space-y-6">
      {!user?.onboardingCompleted && (
        <OnboardingBanner userId={session.user.id} />
      )}

      {/* Dashboard header */}
      <div className="flex items-center justify-between">
        <h1 tabIndex={-1} className="text-2xl font-semibold outline-none">Dashboard</h1>
        <AddPlantDialog catalog={catalog} rooms={rooms} />
      </div>

      {/* Dashboard content with Suspense loading skeleton */}
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent
          userId={session.user.id}
          catalog={catalog}
          rooms={rooms}
          isDemo={session.user.isDemo ?? false}
        />
      </Suspense>
    </div>
  );
}

import { auth } from "../../../../../../auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { differenceInDays } from "date-fns";
import { getCurrentHousehold } from "@/features/household/context";
import { OnboardingBanner } from "@/components/onboarding/onboarding-banner";
import { AddPlantDialog } from "@/components/plants/add-plant-dialog";
import { getCatalog } from "@/features/plants/queries";
import { getRoomsForSelect } from "@/features/rooms/queries";
import { getDashboardPlants } from "@/features/watering/queries";
import {
  getCurrentCycle,
  getCycleNotificationsForViewer,
  getHouseholdMembers,
} from "@/features/household/queries";
import { findNextAssignee } from "@/features/household/cycle";
import { getReminderCount } from "@/features/reminders/queries";
import { CycleStartBanner } from "@/components/household/cycle-start-banner";
import { ReassignmentBanner } from "@/components/household/reassignment-banner";
import { PassiveStatusBanner } from "@/components/household/passive-status-banner";
import { FallbackBanner } from "@/components/household/fallback-banner";
import { CycleCountdownBanner } from "@/components/household/cycle-countdown-banner";
import { CycleAssigneeActions } from "@/components/household/cycle-assignee-actions";
import { DashboardClient } from "@/components/watering/dashboard-client";
import { EmptyState } from "@/components/shared/empty-state";
import { TimezoneWarning } from "@/components/shared/timezone-warning";
import { Leaf, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Suspense } from "react";

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      {[1, 2].map((section) => (
        <div key={section} className="space-y-2">
          <Skeleton className="h-5 w-24" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
  householdId,
  householdSlug,
  catalog,
  rooms,
  isDemo,
}: {
  householdId: string;
  householdSlug: string;
  catalog: Awaited<ReturnType<typeof getCatalog>>;
  rooms: Awaited<ReturnType<typeof getRoomsForSelect>>;
  isDemo: boolean;
}) {
  // Read timezone cookie for date boundaries
  const cookieStore = await cookies();
  const userTz = cookieStore.get("user_tz")?.value ?? "UTC";

  // Compute today boundaries using user's timezone
  const now = new Date();
  const localDateStr = now.toLocaleDateString("en-CA", { timeZone: userTz });
  const [year, month, day] = localDateStr.split("-").map(Number);
  const todayStart = new Date(Date.UTC(year, month - 1, day));
  const todayEnd = new Date(Date.UTC(year, month - 1, day + 1));

  // Fetch dashboard plants and plant count in parallel (householdId-scoped per D-10)
  const [groups, plantCount] = await Promise.all([
    getDashboardPlants(householdId, todayStart, todayEnd),
    db.plant.count({ where: { householdId, archivedAt: null } }),
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
      <EmptyState
        icon={Leaf}
        iconVariant="accent"
        heading="No plants yet"
        body="Add your first plant to start tracking watering."
        action={<AddPlantDialog catalog={catalog} rooms={rooms} householdId={householdId} />}
      />
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
      <DashboardClient groups={groups} isDemo={isDemo} householdId={householdId} householdSlug={householdSlug} />
    </div>
  );
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ householdSlug: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { householdSlug } = await params;
  const { household } = await getCurrentHousehold(householdSlug);

  // Today-window in user's timezone (same idiom as layout chokepoint)
  const cookieStore = await cookies();
  const userTz = cookieStore.get("user_tz")?.value ?? household.timezone ?? "UTC";
  const now = new Date();
  const localDateStr = now.toLocaleDateString("en-CA", { timeZone: userTz });
  const [year, month, day] = localDateStr.split("-").map(Number);
  const todayStart = new Date(Date.UTC(year, month - 1, day));
  const todayEnd = new Date(Date.UTC(year, month - 1, day + 1));

  const [user, catalog, rooms, currentCycle, members, reminderCountForBanner] = await Promise.all([
    db.user.findUnique({
      where: { id: session.user.id },
      select: { onboardingCompleted: true, timezone: true },
    }),
    getCatalog(),
    getRoomsForSelect(household.id),
    getCurrentCycle(household.id),
    getHouseholdMembers(household.id),
    getReminderCount(household.id, session.user.id, todayStart, todayEnd),
  ]);

  // Fetch banner-feed data + next assignee only if a cycle exists.
  // NOTE: getCycleNotificationsForViewer was ALSO called by the parent layout (Plan 05-05 Task 1)
  // with identical args. Plan 05-02 Task 2 wraps that export with React.cache(), so this call
  // is a request-level cache hit — no duplicate DB query.
  let unreadEvent:
    | {
        id: string;
        type: string;
        cycleId: string | null;
        readAt: Date | null;
        priorAssignee: { name: string | null; email: string } | null;
      }
    | null = null;
  let nextAssignee: { userId: string; fallback: boolean } | null = null;

  if (currentCycle) {
    const cycleNotifications = await getCycleNotificationsForViewer(
      household.id,
      session.user.id,
      currentCycle.id,
    );
    unreadEvent =
      cycleNotifications.find((n) => n.readAt === null && n.cycleId === currentCycle.id) ?? null;

    // Next-assignee preview (D-14) — runs inside a short $transaction because
    // findNextAssignee reads availability in the same snapshot. This is a read-only tx.
    nextAssignee = await db.$transaction(async (tx) =>
      findNextAssignee(
        tx,
        household.id,
        members.map((m) => ({
          userId: m.userId,
          rotationOrder: m.rotationOrder,
          role: m.role,
        })),
        { assignedUserId: currentCycle.assignedUserId, endDate: currentCycle.endDate },
      ),
    );
  }

  const viewerIsAssignee = currentCycle?.assignedUserId === session.user.id;
  const currentMember = members.find((m) => m.userId === session.user.id);
  const viewerIsOwner = currentMember?.role === "OWNER";
  const owner = members.find((m) => m.role === "OWNER");
  // Phase 8.3: surface name + email separately so banners can render
  // [name] (email) with the name highlighted.
  const ownerName = owner ? (owner.userName ?? owner.userEmail ?? "An owner") : "An owner";
  const assignee = currentCycle?.assignedUserId
    ? members.find((m) => m.userId === currentCycle.assignedUserId)
    : null;
  const assigneeName = assignee?.userName ?? null;
  const assigneeEmail = assignee?.userEmail ?? null;
  const nextAssigneeMember = nextAssignee
    ? members.find((m) => m.userId === nextAssignee!.userId)
    : null;
  const nextAssigneeName = nextAssigneeMember?.userName ?? null;
  const nextAssigneeEmail = nextAssigneeMember?.userEmail ?? null;

  // Derive prior-assignee name + email for reassignment banner.
  // WR-02 (Phase 5 review): prefer the stored priorAssignee snapshot on the
  // notification row — it is correct by construction regardless of rotation
  // churn after emission. Fall back to the legacy rotation-predecessor walk
  // for notifications emitted before the schema change.
  let priorAssigneeName: string | null = null;
  let priorAssigneeEmail: string | null = null;
  if (currentCycle?.assignedUserId && unreadEvent?.type.startsWith("cycle_reassigned_")) {
    if (unreadEvent.priorAssignee) {
      priorAssigneeName = unreadEvent.priorAssignee.name ?? null;
      priorAssigneeEmail = unreadEvent.priorAssignee.email ?? null;
    } else {
      const sorted = [...members].sort((a, b) => a.rotationOrder - b.rotationOrder);
      const idx = sorted.findIndex((m) => m.userId === currentCycle.assignedUserId);
      const priorIdx = idx > 0 ? idx - 1 : sorted.length > 1 ? sorted.length - 1 : -1;
      if (priorIdx >= 0) {
        const prior = sorted[priorIdx];
        priorAssigneeName = prior.userName ?? null;
        priorAssigneeEmail = prior.userEmail ?? null;
      }
    }
  }

  // D-24 / D-25 — CycleCountdownBanner gate.
  // The banner renders only when the viewer is the current cycle's assignee,
  // the cycle is in the `active` state, AND there is no unread cycle_started
  // or cycle_reassigned_* event pending (those render CycleStartBanner or
  // ReassignmentBanner instead — mutual exclusion).
  const hasUnreadCycleEvent =
    unreadEvent !== null &&
    unreadEvent.readAt === null &&
    (unreadEvent.type === "cycle_started" ||
      unreadEvent.type.startsWith("cycle_reassigned_"));

  // Clamp to 0 for cycles whose endDate is already in the past but have not
  // yet been advanced by the cron (Pitfall 9). Avoids negative countdowns.
  const daysLeft = currentCycle
    ? Math.max(0, differenceInDays(currentCycle.endDate, new Date()))
    : 0;

  return (
    <div className="space-y-6">
      {!user?.onboardingCompleted && (
        <OnboardingBanner userId={session.user.id} householdId={household.id} />
      )}

      <TimezoneWarning storedTimezone={user?.timezone ?? null} />

      {/* D-11: Banner region — dashboard-only. D-13 render order. */}
      {currentCycle && (
        <div className="space-y-4">
          {/* Layer 1: FallbackBanner — D-15 first-in-order, destructive variant */}
          {(currentCycle.status === "paused" ||
            currentCycle.transitionReason === "all_unavailable_fallback") && (
            <FallbackBanner
              viewerIsOwner={viewerIsOwner}
              ownerName={ownerName}
              isPaused={currentCycle.status === "paused"}
            />
          )}

          {/* Layer 2: assignee-role event — mutually exclusive per D-19 unique index */}
          {viewerIsAssignee && unreadEvent?.type === "cycle_started" && (
            <CycleStartBanner
              dueCount={reminderCountForBanner}
              cycleEndDate={currentCycle.endDate}
            />
          )}
          {/* HNTF-03: unconditional render when viewer is assignee AND event type is cycle_reassigned_*.
              priorAssigneeName uses resolvedPriorName ("Someone" fallback when derivation fails)
              so the banner NEVER silently disappears. Matches Plan 05-04 CycleEventRow fallback. */}
          {viewerIsAssignee &&
            unreadEvent?.type.startsWith("cycle_reassigned_") && (
              <ReassignmentBanner
                priorAssigneeName={priorAssigneeName}
                priorAssigneeEmail={priorAssigneeEmail}
                reassignType={
                  unreadEvent.type.replace("cycle_reassigned_", "") as
                    | "manual_skip"
                    | "auto_skip"
                    | "member_left"
                }
                dueCount={reminderCountForBanner}
                cycleEndDate={currentCycle.endDate}
              />
            )}

          {/* D-24: CycleCountdownBanner — assignee steady-state, no unread event.
              Slots between the reassignment-layer and the non-assignee passive
              banner. Mutual-exclusive with CycleStart / Reassignment via the
              `!hasUnreadCycleEvent` half of the D-25 gate. */}
          {viewerIsAssignee &&
            currentCycle.status === "active" &&
            !hasUnreadCycleEvent && (
              <CycleCountdownBanner
                daysLeft={daysLeft}
                nextAssigneeName={nextAssigneeName}
                nextAssigneeEmail={nextAssigneeEmail}
                cycleEndDate={currentCycle.endDate}
                isSingleMember={members.length === 1}
              />
            )}

          {/* Phase 8.1 — assignee-only Snooze + Skip controls. Mounted whenever
              the viewer is the active assignee on an active cycle, regardless of
              which banner above is showing. */}
          {viewerIsAssignee && currentCycle.status === "active" && (
            <div className="flex justify-end">
              <CycleAssigneeActions
                householdId={household.id}
                householdSlug={householdSlug}
                isDemo={session.user.isDemo ?? false}
              />
            </div>
          )}

          {/* Layer 3: PassiveStatusBanner — non-assignee, no assignee event, multi-member, active cycle */}
          {!viewerIsAssignee &&
            !unreadEvent &&
            currentCycle.status === "active" &&
            members.length > 1 && (
              <PassiveStatusBanner
                assigneeName={assigneeName}
                assigneeEmail={assigneeEmail}
                nextAssigneeName={nextAssigneeName}
                nextAssigneeEmail={nextAssigneeEmail}
                nextIsFallbackOwner={nextAssignee?.fallback ?? false}
                memberCount={members.length}
                cycleEndDate={currentCycle.endDate}
              />
            )}
        </div>
      )}

      {/* Dashboard header */}
      <div className="flex items-center justify-between">
        <h1 tabIndex={-1} className="text-2xl font-semibold outline-none">Dashboard</h1>
        <AddPlantDialog catalog={catalog} rooms={rooms} householdId={household.id} />
      </div>

      {/* Dashboard content with Suspense loading skeleton */}
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent
          householdId={household.id}
          householdSlug={householdSlug}
          catalog={catalog}
          rooms={rooms}
          isDemo={session.user.isDemo ?? false}
        />
      </Suspense>
    </div>
  );
}

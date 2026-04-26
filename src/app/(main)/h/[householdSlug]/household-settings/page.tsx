import { redirect } from "next/navigation";
import { auth } from "../../../../../../auth";
import { db } from "@/lib/db";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentHousehold } from "@/features/household/context";
import {
  getCurrentCycle,
  getHouseholdInvitations,
  getHouseholdMembers,
  getUserHouseholds,
} from "@/features/household/queries";
import { GeneralForm } from "@/components/household/settings/general-form";
import { DefaultHouseholdToggle } from "@/components/household/settings/default-household-toggle";
import { MembersList } from "@/components/household/settings/members-list";
import { InvitationsCard } from "@/components/household/settings/invitations-card";
import { DangerZoneCard } from "@/components/household/settings/danger-zone-card";

/**
 * HSET-03 / D-01 / D-02 — Settings page composition.
 *
 * Server Component that assembles the five role-branched Card sections for
 * the household's settings page. Role branching per D-02:
 *   - OWNER: General (editable) | Members+Rotation (arrows+3-dot) |
 *            Invitations | My Availability | Danger Zone
 *   - MEMBER: General (read-only) | Members (read-only roster; no arrows;
 *             self-row 3-dot) | My Availability | Danger Zone (Leave only)
 *
 * Invitations card is entirely absent for MEMBER viewers — the server skips
 * the `getHouseholdInvitations` query too to save a DB round-trip.
 *
 * All child components receive `householdSlug` so their internal nav uses the
 * /h/[slug]/... prefix (Pitfall 17).
 */

type PageProps = {
  params: Promise<{ householdSlug: string }>;
};

export default async function SettingsPage({ params }: PageProps) {
  const { householdSlug } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  // getCurrentHousehold is React.cache()-wrapped, so this call dedups against
  // the parent layout's identical call (D-03 chokepoint invariant).
  const { household, role } = await getCurrentHousehold(householdSlug);

  const [members, invitations, counts, userHouseholds, activeCycle] =
    await Promise.all([
      getHouseholdMembers(household.id),
      role === "OWNER"
        ? getHouseholdInvitations(household.id)
        : Promise.resolve([]),
      // Plant + room counts feed DangerZoneCard's leave copy (D-02 Danger Zone
      // secondary paragraph + DestructiveLeaveDialog summary). Two light
      // db.*.count queries — cheap even for large households.
      Promise.all([
        db.plant.count({ where: { householdId: household.id } }),
        db.room.count({ where: { householdId: household.id } }),
      ]).then(([plantCount, roomCount]) => ({ plantCount, roomCount })),
      getUserHouseholds(session.user.id),
      getCurrentCycle(household.id),
    ]);

  // "Watering now" / "Up next" pills only when the cycle is actively rotating.
  // Paused (all-unavailable fallback) keeps the assignee but no forward motion,
  // so we suppress the pills to avoid implying rotation is in progress.
  const activeAssigneeUserId =
    activeCycle?.status === "active" ? activeCycle.assignedUserId : null;

  // Default-household toggle is only meaningful with 2+ memberships — a
  // single-membership user is auto-default with nothing to swap to.
  const showDefaultToggle = userHouseholds.length >= 2;
  const isDefaultHousehold =
    userHouseholds.find((uh) => uh.household.id === household.id)?.isDefault ??
    false;

  const ownerCount = members.filter((m) => m.role === "OWNER").length;
  const memberCount = members.length;

  // Reshape invitations for InvitationsCard's InvitationRow contract
  // (id + createdAt + creatorName). Raw Prisma rows include the `invitedBy`
  // join relation; map to the minimal shape the client component consumes.
  const invitationRows = invitations.map((inv) => ({
    id: inv.id,
    createdAt: inv.createdAt,
    creatorName: inv.invitedBy?.name ?? inv.invitedBy?.email ?? null,
  }));

  return (
    <main className="max-w-2xl mx-auto px-4 py-8 space-y-8 pb-20 sm:pb-8">
      <header>
        <h1 className="text-2xl font-semibold outline-none" tabIndex={-1}>
          Household settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{household.name}</p>
      </header>

      {/* Section 1: General (name / timezone / cycleDuration). Default-household
          toggle lives inline with the section heading. */}
      <Card>
        <CardHeader className="pb-4 flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-xl font-semibold">General</CardTitle>
          {showDefaultToggle && (
            <DefaultHouseholdToggle
              householdId={household.id}
              isDefault={isDefaultHousehold}
            />
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <GeneralForm
            household={{
              id: household.id,
              name: household.name,
              timezone: household.timezone,
              cycleDuration: household.cycleDuration,
            }}
            householdSlug={householdSlug}
            viewerRole={role}
          />
        </CardContent>
      </Card>

      {/* Section 2: Members + Rotation. */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-semibold">Members</CardTitle>
          <CardDescription>
            Rotation order determines who waters this cycle.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MembersList
            members={members.map((m) => ({
              userId: m.userId,
              userName: m.userName,
              userEmail: m.userEmail,
              role: m.role,
              rotationOrder: m.rotationOrder,
            }))}
            viewerUserId={session.user.id}
            viewerRole={role}
            householdId={household.id}
            householdSlug={householdSlug}
            householdName={household.name}
            ownerCount={ownerCount}
            activeAssigneeUserId={activeAssigneeUserId}
          />
        </CardContent>
      </Card>

      {/* Section 3: Invitations — OWNER only per D-02. */}
      {role === "OWNER" && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-semibold">
              Invitations
            </CardTitle>
            <CardDescription>
              Share an invite link to add members to this household.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <InvitationsCard
              invitations={invitationRows}
              householdId={household.id}
              householdSlug={householdSlug}
              householdName={household.name}
            />
          </CardContent>
        </Card>
      )}

      {/* Section 4: Danger Zone — DangerZoneCard renders its own Card + header. */}
      <DangerZoneCard
        viewerRole={role}
        viewerUserId={session.user.id}
        householdId={household.id}
        householdSlug={householdSlug}
        householdName={household.name}
        plantCount={counts.plantCount}
        roomCount={counts.roomCount}
        ownerCount={ownerCount}
        memberCount={memberCount}
      />
    </main>
  );
}

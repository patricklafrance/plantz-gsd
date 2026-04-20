import { cache } from "react";
import { db } from "@/lib/db";
import type { Cycle, Availability } from "@/generated/prisma/client";
import { hashInvitationToken } from "@/lib/crypto";

/**
 * D-17: Resolve a URL slug to a household identifier.
 *
 * Used by Server Components to translate `/h/[householdSlug]` URL params
 * into a `householdId` that can be passed to `requireHouseholdAccess()`.
 *
 * Returns null when the slug is unknown — the caller decides whether to
 * 404 or redirect. This function does NOT call `auth()`; authentication
 * and authorization are the guard's job (D-16/D-18).
 */
export async function resolveHouseholdBySlug(slug: string) {
  return db.household.findUnique({
    where: { slug },
    select: { id: true, name: true },
  });
}

/**
 * HSLD-03 (D-08): List every household the user belongs to with role + isDefault.
 * Sorted by membership.createdAt asc so the auto-created solo household
 * (created during signup via src/features/auth/actions.ts:78-85) appears first.
 *
 * isDefault surfaces the HouseholdMember.isDefault column added in Plan 02-01.
 * Phase 6 HSET-02 adds the write path to toggle default; Phase 2 only reads it.
 *
 * Security note (T-02-02-04): caller MUST pass session.user.id — this query
 * has no authz check itself. Phase 6 consumer MUST read userId from auth().
 */
export async function getUserHouseholds(userId: string) {
  const memberships = await db.householdMember.findMany({
    where: { userId },
    include: { household: true },
    orderBy: { createdAt: "asc" },
  });

  return memberships.map((m) => ({
    household: m.household,
    role: m.role as "OWNER" | "MEMBER",
    isDefault: m.isDefault,
    joinedAt: m.createdAt,
  }));
}

/**
 * Phase 6 consumer: dashboard cycle banner reads this inside the layout chokepoint.
 * Returns the most recent active-or-paused Cycle for the household, or null.
 * Caller is responsible for authorization (layout ran requireHouseholdAccess).
 *
 * Wrapped with React.cache() for request-level dedup AND snapshot consistency.
 * Within a single dashboard request this is called up to 4x (layout chokepoint,
 * getReminderCount, getReminderItems, dashboard page Server Component); without
 * cache() each call issues its own SELECT, and if a Server Action transitions
 * the cycle mid-request different call sites could observe different rows
 * (badge count derived from one cycle, banner from another). Matches the
 * request-caching pattern used by getUnreadCycleEventCount and
 * getCycleNotificationsForViewer in this module.
 */
export const getCurrentCycle = cache(
  async (householdId: string): Promise<Cycle | null> => {
    return db.cycle.findFirst({
      where: {
        householdId,
        status: { in: ["active", "paused"] },
      },
      orderBy: { cycleNumber: "desc" },
    });
  },
);

/**
 * D-28 — Badge-count query for the unified bell. Counts unread
 * HouseholdNotification rows for the viewer whose Cycle is currently active.
 *
 * Consumed by src/app/(main)/h/[householdSlug]/layout.tsx alongside
 * getReminderCount in a Promise.all to compute `totalCount = reminderCount + unreadCycleEventCount`.
 *
 * Wrapped with React.cache() for request-level dedup: any duplicate call
 * within a single request (e.g. a future header subcomponent) returns the
 * memoized Promise rather than issuing a second DB query.
 *
 * Security note: caller MUST resolve householdId via requireHouseholdAccess
 * (layout chokepoint already does this). Function trusts the caller.
 */
export const getUnreadCycleEventCount = cache(
  async (householdId: string, userId: string): Promise<number> => {
    return db.householdNotification.count({
      where: {
        householdId,
        recipientUserId: userId,
        readAt: null,
        cycle: { status: "active" },
      },
    });
  },
);

/**
 * D-29 — Banner-feeding query for the dashboard. Returns the viewer's
 * HouseholdNotification rows for a specific cycle, with joins the four
 * banner components need to render without extra queries:
 *   - cycle.endDate (CycleStartBanner, ReassignmentBanner meta)
 *   - cycle.transitionReason (FallbackBanner branch)
 *   - cycle.household.members (prior-assignee name for reassignment, owner name for fallback)
 *
 * D-06 derivational banner clearing: filter on the exact cycleId passed —
 * prior-cycle notifications are naturally excluded.
 *
 * Wrapped with React.cache() for request-level dedup. Plan 05-05 calls this
 * function TWICE per dashboard request — once in the layout chokepoint
 * (src/app/(main)/h/[householdSlug]/layout.tsx) to populate the bell's
 * cycleEvents prop, and once in the dashboard page Server Component
 * (src/app/(main)/h/[householdSlug]/dashboard/page.tsx) to look up the
 * current unread event for banner rendering. Both calls pass identical
 * args (household.id, session.user.id, currentCycle.id), so cache()
 * collapses them to a single DB read.
 *
 * Security note: caller MUST resolve householdId via requireHouseholdAccess
 * (dashboard page Server Component does this via getCurrentHousehold).
 */
export const getCycleNotificationsForViewer = cache(
  async (householdId: string, userId: string, cycleId: string) => {
    return db.householdNotification.findMany({
      where: {
        householdId,
        recipientUserId: userId,
        cycleId,
      },
      include: {
        // WR-02 (Phase 5 review): prior-assignee user joined directly from the
        // notification row for cycle_reassigned_* types. This is the authoritative
        // source for "who skipped" copy — the cycle.household.members fallback
        // walk is kept below for notifications emitted before the schema change
        // (priorAssigneeUserId NULL) and single-member edge cases.
        priorAssignee: { select: { name: true, email: true } },
        cycle: {
          include: {
            household: {
              include: {
                members: {
                  include: { user: { select: { name: true, email: true } } },
                  orderBy: { rotationOrder: "asc" },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  },
);

/**
 * D-08: all household members can view all members' availability.
 * Joined with `user.name` + `user.email` for display in the settings list.
 */
export async function getHouseholdAvailabilities(
  householdId: string,
): Promise<Array<Availability & { user: { name: string | null; email: string } }>> {
  return db.availability.findMany({
    where: { householdId },
    include: {
      user: { select: { name: true, email: true } },
    },
    orderBy: { startDate: "asc" },
  });
}

/**
 * INVT-04 / D-18: Resolve a raw invitation token to its full preview payload.
 * Hashes the raw URL segment, then findUnique by tokenHash (@unique index).
 *
 * Used by the public /join/[token] page Server Component to decide which of
 * the four D-09 branches to render. No auth call — anyone with the token
 * gets the preview (this IS the security model: possession of the token
 * authenticates intent to view the household's name).
 *
 * Returns null for unknown tokens. Caller renders Branch 1 (invalid) for null;
 * branch 2/3/4 decisions happen at the page based on invitation.revokedAt /
 * invitation.acceptedAt / a separate householdMember.findFirst call.
 *
 * Owner display: the household may have multiple OWNERs (D-10 co-owner model).
 * Preview shows the earliest-joining OWNER by createdAt ASC; if user.name is
 * null (possible for email-registered users), falls back to user.email. Final
 * fallback string "An owner" defends against schema edge cases.
 */
export async function resolveInvitationByToken(rawToken: string): Promise<{
  invitation: {
    id: string;
    householdId: string;
    tokenHash: string;
    invitedByUserId: string | null;
    invitedEmail: string | null;
    revokedAt: Date | null;
    acceptedAt: Date | null;
    acceptedByUserId: string | null;
    createdAt: Date;
  };
  household: {
    id: string;
    name: string;
    slug: string;
  };
  ownerName: string;
  memberCount: number;
} | null> {
  const tokenHash = hashInvitationToken(rawToken);

  const invitation = await db.invitation.findUnique({
    where: { tokenHash },
    include: {
      household: {
        include: {
          _count: { select: { members: true } },
          members: {
            where: { role: "OWNER" },
            orderBy: { createdAt: "asc" },
            take: 1,
            include: { user: { select: { name: true, email: true } } },
          },
        },
      },
    },
  });

  if (!invitation) return null;

  const ownerMember = invitation.household.members[0];
  const ownerName =
    ownerMember?.user.name ?? ownerMember?.user.email ?? "An owner";
  const memberCount = invitation.household._count.members;

  return {
    invitation: {
      id: invitation.id,
      householdId: invitation.householdId,
      tokenHash: invitation.tokenHash,
      invitedByUserId: invitation.invitedByUserId,
      invitedEmail: invitation.invitedEmail,
      revokedAt: invitation.revokedAt,
      acceptedAt: invitation.acceptedAt,
      acceptedByUserId: invitation.acceptedByUserId,
      createdAt: invitation.createdAt,
    },
    household: {
      id: invitation.household.id,
      name: invitation.household.name,
      slug: invitation.household.slug,
    },
    ownerName,
    memberCount,
  };
}

/**
 * INVT-02 / D-17: List active (non-revoked, non-accepted) invitations for a household.
 * Ordered createdAt DESC so the most recent link appears first. Includes the
 * inviter's display name for the Phase 6 settings UI.
 *
 * Security note: caller MUST enforce authorization (requireHouseholdAccess) —
 * this helper does not. Phase 6 settings page layout already wraps in the
 * /h/[householdSlug]/layout.tsx chokepoint, which runs the guard.
 */
export async function getHouseholdInvitations(householdId: string) {
  return db.invitation.findMany({
    where: {
      householdId,
      revokedAt: null,
      acceptedAt: null,
    },
    orderBy: { createdAt: "desc" },
    include: {
      invitedBy: { select: { name: true, email: true } },
    },
  });
}

/**
 * INVT-06 / D-19: List members of a household for the Phase 6 settings UI.
 * Ordered rotationOrder ASC to match the rotation-list display order.
 *
 * Returns a mapped shape ({ userId, userName, userEmail, role, rotationOrder, joinedAt })
 * rather than the raw Prisma row so consumers don't depend on the internal column
 * naming (`createdAt` becomes the public `joinedAt`).
 *
 * Security note: caller MUST enforce authorization (any household member can
 * call — role check not required). Phase 6 layout chokepoint already runs
 * requireHouseholdAccess.
 */
export async function getHouseholdMembers(householdId: string): Promise<Array<{
  userId: string;
  userName: string | null;
  userEmail: string;
  role: "OWNER" | "MEMBER";
  rotationOrder: number;
  joinedAt: Date;
}>> {
  const memberships = await db.householdMember.findMany({
    where: { householdId },
    orderBy: { rotationOrder: "asc" },
    include: { user: { select: { name: true, email: true } } },
  });

  return memberships.map((m) => ({
    userId: m.userId,
    userName: m.user.name,
    userEmail: m.user.email,
    role: m.role as "OWNER" | "MEMBER",
    rotationOrder: m.rotationOrder,
    joinedAt: m.createdAt,
  }));
}

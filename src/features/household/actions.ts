"use server";

import { auth, unstable_update } from "../../../auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { format as formatDate } from "date-fns";
import { generateHouseholdSlug } from "@/lib/slug";
import {
  createHouseholdSchema,
  createAvailabilitySchema,
  deleteAvailabilitySchema,
  skipCurrentCycleSchema,
  createInvitationSchema,
  revokeInvitationSchema,
  acceptInvitationSchema,
  leaveHouseholdSchema,
  removeMemberSchema,
  promoteMemberSchema,
  demoteMemberSchema,
} from "./schema";
import { generateInvitationToken, hashInvitationToken } from "@/lib/crypto";
import { computeInitialCycleBoundaries, transitionCycle } from "./cycle";
import { findOverlappingPeriod } from "./availability";
import { requireHouseholdAccess, ForbiddenError } from "./guards";
import { HOUSEHOLD_PATHS } from "./paths";

/**
 * HSLD-02 (D-06): Create a secondary household, atomically inserting the
 * Household row and an OWNER HouseholdMember for the current user.
 *
 * Per D-04 / Pitfall 16 note: this action does NOT call requireHouseholdAccess
 * — creating a new household is by definition not action on an EXISTING household,
 * so there is no membership to verify. Session + demo gate + Zod parse are the
 * only precondition checks; the $transaction is atomic.
 *
 * Slug generation mirrors the collision loop in `registerUser`
 * (src/features/auth/actions.ts) — bounded at 10 attempts with the DB
 * unique-constraint as the final guard.
 */
export async function createHousehold(data: unknown) {
  // Step 1: session
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  // Step 2: demo-mode guard (unchanged from v1 pattern)
  if (session.user.isDemo) {
    return { error: "Demo mode — sign up to save your changes." };
  }

  // Step 3: Zod parse
  const parsed = createHouseholdSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  const userId = session.user.id;

  // Step 4 (skipped — see JSDoc)
  // Step 5 + 6: $transaction — slug loop + household.create + member.create(OWNER, isDefault: false)
  const household = await db.$transaction(async (tx) => {
    let slug: string;
    let attempts = 0;
    while (true) {
      slug = generateHouseholdSlug();
      const existing = await tx.household.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (!existing) break;
      // Throw after 10 total attempts — the `>= 9` bound with post-increment
      // means the 10th failing findUnique triggers the error, matching the
      // "after 10 attempts" message exactly.
      if (attempts++ >= 9) {
        throw new Error("Slug generation failed after 10 attempts");
      }
    }

    // WR-01: single source of truth for the new household's cycle duration +
    // timezone. Passed to both household.create and computeInitialCycleBoundaries
    // so a future edit cannot desync Cycle #1's boundaries from the household row.
    const cycleDuration = 7;
    const cycleTimezone = parsed.data.timezone ?? "UTC";

    const created = await tx.household.create({
      data: {
        name: parsed.data.name,
        slug,
        timezone: cycleTimezone,
        cycleDuration,
        rotationStrategy: "sequential",
      },
    });

    await tx.householdMember.create({
      data: {
        userId,
        householdId: created.id,
        role: "OWNER",
        rotationOrder: 0,
        isDefault: false, // secondary household — does not override existing default
      },
    });

    // D-01: Cycle #1 eager creation. Every household always has an active cycle.
    const { anchorDate, startDate, endDate } = computeInitialCycleBoundaries(
      new Date(),
      cycleTimezone,
      cycleDuration,
    );
    await tx.cycle.create({
      data: {
        householdId: created.id,
        cycleNumber: 1,
        anchorDate,
        cycleDuration,
        startDate,
        endDate,
        status: "active",
        assignedUserId: userId,
        memberOrderSnapshot: [{ userId, rotationOrder: 0 }],
      },
    });

    return created;
  });

  // Step 7: no revalidatePath — Phase 2 has no UI consumer (D-07). Phase 6's
  // settings form will revalidate its own path from the form action's route.
  return { success: true, household };
}

/**
 * AVLB-04 / D-14: active assignee manually skips their current cycle.
 * 7-step template. Only the current assignee may call this.
 */
export async function skipCurrentCycle(data: unknown) {
  // Step 1: session
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  // Step 2: demo guard
  if (session.user.isDemo) {
    return { error: "Demo mode — sign up to save your changes." };
  }

  // Step 3: Zod parse
  const parsed = skipCurrentCycleSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  // Step 4: live household access check
  try {
    await requireHouseholdAccess(parsed.data.householdId);
  } catch (err) {
    if (err instanceof ForbiddenError) return { error: err.message };
    throw err;
  }

  // Step 5: load current cycle and assert caller is the assignee
  const currentCycle = await db.cycle.findFirst({
    where: {
      householdId: parsed.data.householdId,
      status: { in: ["active", "paused"] },
    },
    orderBy: { cycleNumber: "desc" },
    select: { id: true, assignedUserId: true, status: true },
  });
  if (!currentCycle) {
    return { error: "No active cycle found for this household." };
  }
  if (currentCycle.assignedUserId !== session.user.id) {
    return { error: "Only the active assignee can skip this cycle." };
  }

  // Step 6: shared transition function (manual_skip). This is the single
  // cycle-mutation path — we do NOT touch Cycle rows directly here.
  await transitionCycle(parsed.data.householdId, "manual_skip");

  // Step 7: revalidate dashboard so the clicking user sees the new banner immediately.
  revalidatePath(HOUSEHOLD_PATHS.dashboard, "page");
  return { success: true };
}

/**
 * AVLB-01 / D-06 / Pitfall 11 + 12: create an availability period.
 * 7-step template with overlap precheck.
 */
export async function createAvailability(data: unknown) {
  // Step 1: session
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  // Step 2: demo guard
  if (session.user.isDemo) {
    return { error: "Demo mode — sign up to save your changes." };
  }

  // Step 3: Zod parse (refinements enforce startDate >= today + endDate > startDate)
  const parsed = createAvailabilitySchema.safeParse(data);
  if (!parsed.success) {
    // WR-03: only surface messages we authored via `.refine()` on the date
    // fields. For base parse errors (cuid, min-length, etc.) return the
    // generic message to avoid leaking internal Zod wording.
    const firstIssue = parsed.error.issues[0];
    const isDateRefinement =
      firstIssue?.path[0] === "startDate" || firstIssue?.path[0] === "endDate";
    return {
      error: isDateRefinement && firstIssue?.message
        ? firstIssue.message
        : "Invalid input.",
    };
  }

  // Step 4: live household access check
  try {
    await requireHouseholdAccess(parsed.data.householdId);
  } catch (err) {
    if (err instanceof ForbiddenError) return { error: err.message };
    throw err;
  }

  // Step 5: D-06 overlap precheck — reject if this caller already has an
  // availability period intersecting the requested range.
  const overlap = await findOverlappingPeriod(
    session.user.id,
    parsed.data.householdId,
    parsed.data.startDate,
    parsed.data.endDate,
  );
  if (overlap) {
    const s = formatDate(overlap.startDate, "MMM d, yyyy");
    const e = formatDate(overlap.endDate, "MMM d, yyyy");
    return {
      error: `You already have an availability period covering those dates (${s} → ${e}). Delete it first, or pick non-overlapping dates.`,
    };
  }

  // Step 6: insert
  await db.availability.create({
    data: {
      userId: session.user.id,
      householdId: parsed.data.householdId,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      reason: parsed.data.reason ?? null,
    },
  });

  // Step 7: revalidate the settings page so the new row appears.
  revalidatePath(HOUSEHOLD_PATHS.settings, "page");
  return { success: true };
}

/**
 * AVLB-02 / D-07 / D-09: delete availability; owning member OR household owner.
 */
export async function deleteAvailability(data: unknown) {
  // Step 1: session
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  // Step 2: demo guard
  if (session.user.isDemo) {
    return { error: "Demo mode — sign up to save your changes." };
  }

  // Step 3: Zod parse
  const parsed = deleteAvailabilitySchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  // Step 4+5: fetch row (needed to resolve householdId), then live access +
  // D-09 dual-auth (row.userId === session.user.id || role === "OWNER").
  const row = await db.availability.findUnique({
    where: { id: parsed.data.availabilityId },
    select: { id: true, userId: true, householdId: true },
  });
  if (!row) return { error: "Availability period not found." };

  try {
    const { role } = await requireHouseholdAccess(row.householdId);
    // D-09: owning member OR household owner
    if (row.userId !== session.user.id && role !== "OWNER") {
      throw new ForbiddenError(
        "You can only delete your own availability periods.",
      );
    }
  } catch (err) {
    if (err instanceof ForbiddenError) return { error: err.message };
    throw err;
  }

  // Step 6: delete
  await db.availability.delete({ where: { id: row.id } });

  // Step 7: revalidate settings
  revalidatePath(HOUSEHOLD_PATHS.settings, "page");
  return { success: true };
}

/**
 * INVT-01 / D-16: Generate a new shareable invitation link.
 * OWNER-gated (role check at Step 5). Writes only tokenHash (SHA-256 of raw token).
 * Raw token is returned once and never persisted (Pitfall 10 §1 binding).
 */
export async function createInvitation(data: unknown) {
  // Step 1: session
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  // Step 2: demo-mode guard (Phase 4 copy per UI-SPEC)
  if (session.user.isDemo) {
    return {
      error:
        "This action is disabled in demo mode. Sign up to get your own household.",
    };
  }

  // Step 3: Zod parse
  const parsed = createInvitationSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  // Step 4: live household access
  let access: Awaited<ReturnType<typeof requireHouseholdAccess>>;
  try {
    access = await requireHouseholdAccess(parsed.data.householdId);
  } catch (err) {
    if (err instanceof ForbiddenError) return { error: err.message };
    throw err;
  }

  // Step 5: role authz (OWNER only)
  if (access.role !== "OWNER") {
    return { error: "Only household owners can generate invite links." };
  }

  // Step 6: write — persist tokenHash only; return raw token to caller
  const { rawToken, tokenHash } = generateInvitationToken();
  const invitation = await db.invitation.create({
    data: {
      householdId: parsed.data.householdId,
      tokenHash,
      invitedByUserId: session.user.id,
    },
    select: { id: true },
  });

  // Step 7: revalidate settings page (Phase 6 invite list consumer)
  revalidatePath(HOUSEHOLD_PATHS.settings, "page");
  return {
    success: true as const,
    token: rawToken,
    invitationId: invitation.id,
  };
}

/**
 * INVT-02 / D-16: Revoke an invitation. OWNER-gated.
 * Per D-16: idempotent on already-revoked (returns success, no-op);
 * errors on already-accepted with UI-SPEC verbatim copy.
 */
export async function revokeInvitation(data: unknown) {
  // Step 1: session
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  // Step 2: demo-mode guard
  if (session.user.isDemo) {
    return {
      error:
        "This action is disabled in demo mode. Sign up to get your own household.",
    };
  }

  // Step 3: Zod parse
  const parsed = revokeInvitationSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  // Step 4: live household access
  let access: Awaited<ReturnType<typeof requireHouseholdAccess>>;
  try {
    access = await requireHouseholdAccess(parsed.data.householdId);
  } catch (err) {
    if (err instanceof ForbiddenError) return { error: err.message };
    throw err;
  }

  // Step 5: role authz (OWNER only)
  if (access.role !== "OWNER") {
    return { error: "Only household owners can revoke invite links." };
  }

  // Step 6: load + branch + write
  const existing = await db.invitation.findUnique({
    where: { id: parsed.data.invitationId },
    select: { id: true, householdId: true, revokedAt: true, acceptedAt: true },
  });
  if (!existing || existing.householdId !== parsed.data.householdId) {
    return { error: "Invitation not found." };
  }
  if (existing.acceptedAt !== null) {
    return { error: "Can't revoke an already-accepted invite." };
  }
  if (existing.revokedAt !== null) {
    // Idempotent: already revoked — no-op, report success
    return { success: true as const };
  }

  await db.invitation.update({
    where: { id: parsed.data.invitationId },
    data: { revokedAt: new Date() },
  });

  // Step 7: revalidate settings page
  revalidatePath(HOUSEHOLD_PATHS.settings, "page");
  return { success: true as const };
}

/**
 * INVT-04 / D-16: Accept an invitation. Atomic via updateMany + count guard
 * (Pitfall 10 §2 binding). Appends new member to rotation end (rotationOrder =
 * max + 1) per D-16 and Pitfall 9 §B; does NOT reset cycle pointer.
 *
 * Call graph:
 *   Step 1–3: session / demo / Zod (standard 7-step)
 *   Step 4 SKIPPED: acceptInvitation has no household scope pre-check (that's the point)
 *   Step 5: pre-read + branch detection (unknown / revoked / used / already-member) —
 *           returns UI-SPEC verbatim error strings per D-09
 *   Step 6: db.$transaction { updateMany + count guard + aggregate + create }
 *   Step 6.5 (POST-transaction): unstable_update to refresh JWT (Pitfall 16)
 *   Step 7: revalidatePath on dashboard
 */
export async function acceptInvitation(data: unknown) {
  // Steps 1–3
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };
  if (session.user.isDemo) {
    return {
      error:
        "This action is disabled in demo mode. Sign up to get your own household.",
    };
  }
  const parsed = acceptInvitationSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  // Step 5a: branch detection (outside transaction — needed for UI-SPEC verbatim errors)
  const tokenHash = hashInvitationToken(parsed.data.token);
  const invitation = await db.invitation.findUnique({
    where: { tokenHash },
    include: { household: { select: { id: true, slug: true } } },
  });
  if (!invitation) return { error: "This invite link isn't valid." };
  if (invitation.revokedAt !== null)
    return { error: "This invite was revoked." };
  if (invitation.acceptedAt !== null)
    return { error: "This invite has already been used." };

  // Step 5b: already-member check
  const existingMembership = await db.householdMember.findFirst({
    where: { householdId: invitation.householdId, userId: session.user.id },
    select: { id: true },
  });
  if (existingMembership) {
    return { error: "You're already in this household." };
  }

  // Step 6: atomic updateMany + member insert inside a single $transaction
  const householdId = invitation.householdId;
  const userId = session.user.id;
  try {
    await db.$transaction(async (tx) => {
      const updateResult = await tx.invitation.updateMany({
        where: { tokenHash, acceptedAt: null, revokedAt: null },
        data: { acceptedAt: new Date(), acceptedByUserId: userId },
      });
      if (updateResult.count === 0) {
        // Race loss: another concurrent call took the row (Pitfall 10 §2 guard)
        throw new AcceptRaceError("This invite has already been used.");
      }
      const maxOrder = await tx.householdMember.aggregate({
        where: { householdId },
        _max: { rotationOrder: true },
      });
      const nextOrder = (maxOrder._max.rotationOrder ?? -1) + 1;
      await tx.householdMember.create({
        data: {
          householdId,
          userId,
          role: "MEMBER",
          rotationOrder: nextOrder,
          isDefault: false,
        },
      });
    });
  } catch (err) {
    if (err instanceof AcceptRaceError) {
      return { error: err.message };
    }
    throw err;
  }

  // Step 6.5: JWT refresh AFTER the transaction commits (Pitfall 16 — never inside tx)
  // activeHouseholdId lives on session.user per auth.ts callbacks.session shape.
  await unstable_update({ user: { activeHouseholdId: householdId } });

  // Step 7: revalidate dashboard (Phase 5/6 will consume the new membership immediately)
  revalidatePath(HOUSEHOLD_PATHS.dashboard, "page");
  return {
    success: true as const,
    redirectTo: `/h/${invitation.household.slug}/dashboard`,
  };
}

/**
 * Local typed error for the $transaction short-circuit (Pitfall 10 §2 race guard).
 * Thrown inside the transaction callback to short-circuit on concurrent-accept race loss.
 */
class AcceptRaceError extends Error {
  readonly name = "AcceptRaceError" as const;
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, AcceptRaceError.prototype);
  }
}

/**
 * INVT-05 / D-13 / D-14 / D-16: Leave a household the caller is a member of.
 * Last-OWNER in multi-member household → blocked per D-13.
 * Sole-member + last-OWNER → terminal case: Household.delete + cascade per D-14.
 * Active assignee leaving → transitionCycle(..., "member_left") per Phase 3 D-18.
 * Calls unstable_update after the DB write to refresh the caller's JWT.
 */
export async function leaveHousehold(data: unknown) {
  // Step 1: session
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  // Step 2: demo-mode guard
  if (session.user.isDemo) {
    return {
      error:
        "This action is disabled in demo mode. Sign up to get your own household.",
    };
  }

  // Step 3: Zod parse
  const parsed = leaveHouseholdSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  // Step 4: live household access (caller must be a member)
  let access: Awaited<ReturnType<typeof requireHouseholdAccess>>;
  try {
    access = await requireHouseholdAccess(parsed.data.householdId);
  } catch (err) {
    if (err instanceof ForbiddenError) return { error: err.message };
    throw err;
  }

  const userId = session.user.id;
  const householdId = parsed.data.householdId;

  // Step 5a: last-OWNER pre-check per D-13
  // Count OWNERs excluding the caller: if 0 and there are other members, block.
  const otherOwnerCount = await db.householdMember.count({
    where: {
      householdId,
      role: "OWNER",
      userId: { not: userId },
    },
  });
  const totalMemberCount = await db.householdMember.count({
    where: { householdId },
  });

  const callerIsOwner = access.role === "OWNER";
  const isSoleMember = totalMemberCount === 1;
  const wouldBeLastOwnerBlocked =
    callerIsOwner && otherOwnerCount === 0 && !isSoleMember;

  if (wouldBeLastOwnerBlocked) {
    return {
      error:
        "You're the only owner. Promote another member to owner first, then try again.",
    };
  }

  // Step 6: write
  // D-14 terminal: sole member leaves, delete the entire household.
  // The callerIsOwner && otherOwnerCount === 0 guard is redundant when isSoleMember
  // is true — if there's only one member and they're leaving, no one remains.
  // The wouldBeLastOwnerBlocked pre-check (above) still correctly prevents a sole
  // OWNER in a multi-member household from leaving without first promoting someone.
  if (isSoleMember) {
    await db.household.delete({ where: { id: householdId } });
  } else {
    // Step 6a: if caller is the active assignee, transition cycle FIRST (own tx)
    const currentCycle = await db.cycle.findFirst({
      where: { householdId, status: { in: ["active", "paused"] } },
      select: { assignedUserId: true },
    });
    if (currentCycle?.assignedUserId === userId) {
      await transitionCycle(householdId, "member_left");
    }

    // Step 6b: member delete + availability cancel in a single tx
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    await db.$transaction(async (tx) => {
      await tx.availability.deleteMany({
        where: {
          userId,
          householdId,
          startDate: { gte: todayStart },
        },
      });
      await tx.householdMember.delete({
        where: { householdId_userId: { householdId, userId } },
      });
    });
  }

  // Step 6.5: unstable_update — pick another household or null
  const remaining = await db.householdMember.findFirst({
    where: { userId, householdId: { not: householdId } },
    select: { householdId: true },
    orderBy: { isDefault: "desc" },
  });
  await unstable_update({ user: { activeHouseholdId: remaining?.householdId ?? undefined } });

  // Step 7: revalidate
  revalidatePath(HOUSEHOLD_PATHS.dashboard, "page");
  revalidatePath(HOUSEHOLD_PATHS.settings, "page");
  return { success: true as const };
}

/**
 * INVT-06 / D-16: Remove a non-OWNER member from a household.
 * Self-target is REJECTED — callers must use leaveHousehold for the self case
 * so unstable_update fires correctly per D-16.5.
 *
 * Last-OWNER guard (Pitfall 6): OWNER count EXCLUDES the target user; if 0
 * other OWNERs exist and target is OWNER, block. Error uses the target's
 * display name so the toast tells the caller which member blocks.
 */
export async function removeMember(data: unknown) {
  // Steps 1–3
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };
  if (session.user.isDemo) {
    return {
      error:
        "This action is disabled in demo mode. Sign up to get your own household.",
    };
  }
  const parsed = removeMemberSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  const { householdId, targetUserId } = parsed.data;

  // Self-target guard (before role check — clearer error for the common mistake)
  if (targetUserId === session.user.id) {
    return { error: "To leave a household, use Leave instead of Remove." };
  }

  // Step 4 + 5: live access + OWNER role gate
  let access: Awaited<ReturnType<typeof requireHouseholdAccess>>;
  try {
    access = await requireHouseholdAccess(householdId);
  } catch (err) {
    if (err instanceof ForbiddenError) return { error: err.message };
    throw err;
  }
  if (access.role !== "OWNER") {
    return { error: "Only household owners can remove members." };
  }

  // Fetch target with role + display info
  const target = await db.householdMember.findFirst({
    where: { householdId, userId: targetUserId },
    include: { user: { select: { name: true, email: true } } },
  });
  if (!target) return { error: "Member not found in this household." };

  // Last-OWNER guard per Pitfall 6: count OWNERs excluding the target
  if (target.role === "OWNER") {
    const otherOwnerCount = await db.householdMember.count({
      where: { householdId, role: "OWNER", userId: { not: targetUserId } },
    });
    if (otherOwnerCount === 0) {
      const displayName =
        target.user.name ?? target.user.email ?? "The target member";
      return {
        error: `${displayName} is the only owner. Promote another member before removing them.`,
      };
    }
  }

  // Active-assignee transition (outside own tx — RESEARCH §Pattern 5)
  const currentCycle = await db.cycle.findFirst({
    where: { householdId, status: { in: ["active", "paused"] } },
    select: { assignedUserId: true },
  });
  if (currentCycle?.assignedUserId === targetUserId) {
    await transitionCycle(householdId, "member_left");
  }

  // Member delete + availability cancel
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  await db.$transaction(async (tx) => {
    await tx.availability.deleteMany({
      where: {
        userId: targetUserId,
        householdId,
        startDate: { gte: todayStart },
      },
    });
    await tx.householdMember.delete({
      where: { householdId_userId: { householdId, userId: targetUserId } },
    });
  });

  // NO unstable_update for the removed user (D-16.5 binding) — their next
  // request hits requireHouseholdAccess and returns ForbiddenError.

  revalidatePath(HOUSEHOLD_PATHS.settings, "page");
  revalidatePath(HOUSEHOLD_PATHS.dashboard, "page");
  return { success: true as const };
}

/**
 * INVT-06 / D-11: Promote a MEMBER to OWNER. OWNER-gated.
 * Idempotent: promoting an existing OWNER is a no-op (not an error).
 */
export async function promoteToOwner(data: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };
  if (session.user.isDemo) {
    return {
      error:
        "This action is disabled in demo mode. Sign up to get your own household.",
    };
  }
  const parsed = promoteMemberSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  const { householdId, targetUserId } = parsed.data;

  let access: Awaited<ReturnType<typeof requireHouseholdAccess>>;
  try {
    access = await requireHouseholdAccess(householdId);
  } catch (err) {
    if (err instanceof ForbiddenError) return { error: err.message };
    throw err;
  }
  if (access.role !== "OWNER") {
    return { error: "Only household owners can promote members." };
  }

  const target = await db.householdMember.findFirst({
    where: { householdId, userId: targetUserId },
    select: { role: true },
  });
  if (!target) return { error: "Member not found in this household." };
  if (target.role === "OWNER") {
    // Idempotent per D-11
    return { success: true as const };
  }

  await db.householdMember.update({
    where: { householdId_userId: { householdId, userId: targetUserId } },
    data: { role: "OWNER" },
  });

  revalidatePath(HOUSEHOLD_PATHS.settings, "page");
  return { success: true as const };
}

/**
 * INVT-06 / D-12: Demote an OWNER to MEMBER. OWNER-gated.
 * Blocked when it would leave 0 OWNERs in the household.
 * Idempotent on already-MEMBER target.
 */
export async function demoteToMember(data: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };
  if (session.user.isDemo) {
    return {
      error:
        "This action is disabled in demo mode. Sign up to get your own household.",
    };
  }
  const parsed = demoteMemberSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input." };

  const { householdId, targetUserId } = parsed.data;

  let access: Awaited<ReturnType<typeof requireHouseholdAccess>>;
  try {
    access = await requireHouseholdAccess(householdId);
  } catch (err) {
    if (err instanceof ForbiddenError) return { error: err.message };
    throw err;
  }
  if (access.role !== "OWNER") {
    return { error: "Only household owners can demote other owners." };
  }

  const target = await db.householdMember.findFirst({
    where: { householdId, userId: targetUserId },
    select: { role: true },
  });
  if (!target) return { error: "Member not found in this household." };
  if (target.role === "MEMBER") {
    // Idempotent: already a MEMBER — no-op
    return { success: true as const };
  }

  // Last-OWNER guard: count OWNERs excluding target
  const otherOwnerCount = await db.householdMember.count({
    where: { householdId, role: "OWNER", userId: { not: targetUserId } },
  });
  if (otherOwnerCount === 0) {
    return {
      error:
        "Can't demote the last owner. Promote another member to owner first.",
    };
  }

  await db.householdMember.update({
    where: { householdId_userId: { householdId, userId: targetUserId } },
    data: { role: "MEMBER" },
  });

  revalidatePath(HOUSEHOLD_PATHS.settings, "page");
  return { success: true as const };
}

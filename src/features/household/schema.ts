import { z } from "zod/v4";
import { startOfDay } from "date-fns";
import { TRANSITION_REASONS, NOTIFICATION_TYPES } from "./constants";

/**
 * Household member role. Used by Phase 2 (createHousehold/membership actions),
 * Phase 4 (invitation accept), Phase 6 (settings UI), and Phase 7 (demo seed).
 * Mirrors the `role` string column on HouseholdMember (Plan 02 schema).
 */
export const householdRoleSchema = z.enum(["OWNER", "MEMBER"]);
export type HouseholdRole = z.infer<typeof householdRoleSchema>;

/**
 * Rotation strategy. Per D-12, only "sequential" is supported in v1.
 * Future strategies (e.g., "load-balanced") would extend this enum.
 */
export const rotationStrategySchema = z.enum(["sequential"]);
export type RotationStrategy = z.infer<typeof rotationStrategySchema>;

/**
 * HSLD-02 (D-06): Input schema for createHousehold Server Action.
 * cycleDuration, rotationStrategy, and slug are NOT user-input — hard-coded
 * in the action body to prevent mass-assignment (T-02-02-02).
 */
export const createHouseholdSchema = z.object({
  name: z.string().min(1, "Household name is required.").max(80),
  timezone: z.string().optional(),
});
export type CreateHouseholdInput = z.infer<typeof createHouseholdSchema>;

/**
 * D-04 / D-18: string-union schemas for cycle-transition reasons and
 * notification types. Backed by the TRANSITION_REASONS / NOTIFICATION_TYPES
 * arrays in ./constants so a single source of truth drives code + validation.
 */
export const transitionReasonSchema = z.enum(TRANSITION_REASONS);
export type TransitionReason = z.infer<typeof transitionReasonSchema>;

export const notificationTypeSchema = z.enum(NOTIFICATION_TYPES);
export type NotificationType = z.infer<typeof notificationTypeSchema>;

/**
 * AVLB-01 / D-06 / Pitfall 12: availability period shape.
 * - startDate >= today (Pitfall 12 — past dates rejected)
 * - endDate > startDate
 * - householdSlug threaded through for revalidatePath per Phase 2 D-04
 */
export const createAvailabilitySchema = z
  .object({
    householdId: z.cuid(),
    householdSlug: z.string().min(1),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    reason: z.string().max(200).optional(),
  })
  .refine((d) => d.endDate > d.startDate, {
    message: "End date must be after start date.",
    path: ["endDate"],
  })
  // Note: compares against server-local "today" (typically UTC on serverless).
  // Users within ±12h are effectively unaffected; far-east users may see a
  // one-day-off edge at wall-clock midnight. Phase 6 may thread household
  // timezone through to make this timezone-aware.
  .refine((d) => d.startDate >= startOfDay(new Date()), {
    message: "Availability cannot start in the past.",
    path: ["startDate"],
  });
export type CreateAvailabilityInput = z.infer<typeof createAvailabilitySchema>;

/**
 * AVLB-02 / D-07: delete-only availability. availabilityId cuid + slug for
 * revalidatePath.
 */
export const deleteAvailabilitySchema = z.object({
  availabilityId: z.cuid(),
  householdSlug: z.string().min(1),
});
export type DeleteAvailabilityInput = z.infer<typeof deleteAvailabilitySchema>;

/**
 * D-14: skipCurrentCycle input. Hidden householdId cuid + slug (Phase 2 D-04).
 */
export const skipCurrentCycleSchema = z.object({
  householdId: z.cuid(),
  householdSlug: z.string().min(1),
});
export type SkipCurrentCycleInput = z.infer<typeof skipCurrentCycleSchema>;

/**
 * INVT-01 / D-16: createInvitation input. OWNER-gated at the action layer.
 * `householdSlug` surfaces in revalidatePath; `householdId` is the authz key.
 */
export const createInvitationSchema = z.object({
  householdId: z.cuid(),
  householdSlug: z.string().min(1),
});
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;

/**
 * INVT-02 / D-16: revokeInvitation input. Per D-16 discretion (grep-consistency),
 * householdId is a hidden field on the form even though it could be derived
 * from the Invitation row. OWNER-gated at the action layer.
 */
export const revokeInvitationSchema = z.object({
  invitationId: z.cuid(),
  householdId: z.cuid(),
  householdSlug: z.string().min(1),
});
export type RevokeInvitationInput = z.infer<typeof revokeInvitationSchema>;

/**
 * INVT-04 / D-16: acceptInvitation input. NOT household-gated (that's the point —
 * the caller proves membership intent by holding the raw token, not by being in
 * the household yet). Token is an opaque string; DO NOT parse its internal structure.
 */
export const acceptInvitationSchema = z.object({
  // Raw token is always 64 hex chars (randomBytes(32).toString("hex"))
  token: z.string().regex(/^[0-9a-f]{64}$/, "Invalid invitation token format."),
});
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;

/**
 * INVT-05 / D-16: leaveHousehold input. Caller is the subject (session.user.id);
 * householdId is the household the caller leaves. Last-OWNER pre-check runs at
 * the action layer (D-13).
 */
export const leaveHouseholdSchema = z.object({
  householdId: z.cuid(),
  householdSlug: z.string().min(1),
});
export type LeaveHouseholdInput = z.infer<typeof leaveHouseholdSchema>;

/**
 * INVT-06 / D-16: removeMember input. OWNER-gated. `targetUserId` is the member
 * being removed. Self-target is REJECTED at the action layer — use
 * leaveHousehold for the self case (D-16 removeMember rationale).
 */
export const removeMemberSchema = z.object({
  householdId: z.cuid(),
  householdSlug: z.string().min(1),
  targetUserId: z.cuid(),
});
export type RemoveMemberInput = z.infer<typeof removeMemberSchema>;

/**
 * INVT-06 / D-11: promoteToOwner input. OWNER-gated. Idempotent at the action
 * layer (promoting an existing OWNER is a no-op, not an error).
 */
export const promoteMemberSchema = z.object({
  householdId: z.cuid(),
  householdSlug: z.string().min(1),
  targetUserId: z.cuid(),
});
export type PromoteMemberInput = z.infer<typeof promoteMemberSchema>;

/**
 * INVT-06 / D-12: demoteToMember input. OWNER-gated. Self-demote allowed only
 * if another OWNER exists after the change (enforced at the action layer).
 * Shape is identical to promoteMemberSchema; kept as a separate export for
 * grep-friendliness and future divergence.
 */
export const demoteMemberSchema = z.object({
  householdId: z.cuid(),
  householdSlug: z.string().min(1),
  targetUserId: z.cuid(),
});
export type DemoteMemberInput = z.infer<typeof demoteMemberSchema>;

/**
 * HNTF-01 / D-20 — markNotificationsRead input. Mark-read is fired via
 * useTransition from the NotificationBell dropdown onOpenChange handler;
 * it is NOT a form submission. householdSlug is carried for revalidatePath.
 *
 * notificationIds is an explicit array (Claude's Discretion resolved) —
 * grep-ability + decoupling from cycleId filter logic in the caller.
 * The action's updateMany predicate (`recipientUserId: session.user.id,
 * readAt: null`) makes cross-user attempts a zero-count write, not an
 * error, and makes re-opens safe.
 *
 * recipientUserId is NOT accepted from input — actions.ts reads it from session.
 */
export const markNotificationsReadSchema = z.object({
  householdId: z.cuid(),
  householdSlug: z.string().min(1),
  notificationIds: z.array(z.cuid()).min(1),
});
export type MarkNotificationsReadInput = z.infer<typeof markNotificationsReadSchema>;

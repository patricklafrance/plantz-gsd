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
    householdId: z.string().cuid(),
    householdSlug: z.string().min(1),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    reason: z.string().max(200).optional(),
  })
  .refine((d) => d.endDate > d.startDate, {
    message: "End date must be after start date.",
    path: ["endDate"],
  })
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
  availabilityId: z.string().cuid(),
  householdSlug: z.string().min(1),
});
export type DeleteAvailabilityInput = z.infer<typeof deleteAvailabilitySchema>;

/**
 * D-14: skipCurrentCycle input. Hidden householdId cuid + slug (Phase 2 D-04).
 */
export const skipCurrentCycleSchema = z.object({
  householdId: z.string().cuid(),
  householdSlug: z.string().min(1),
});
export type SkipCurrentCycleInput = z.infer<typeof skipCurrentCycleSchema>;

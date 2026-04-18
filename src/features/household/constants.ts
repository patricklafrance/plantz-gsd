/**
 * Phase 3 string-union domains. Single source of truth used by:
 *   - Cycle.transitionReason values (D-04)
 *   - HouseholdNotification.type values (D-18)
 *   - Zod enums in schema.ts
 *   - notification-type mapping in cycle.ts
 *
 * No Prisma enums — matches the Cycle.status / HouseholdMember.role string convention.
 */
export const TRANSITION_REASONS = [
  "cycle_end",
  "manual_skip",
  "auto_skip_unavailable",
  "member_left",
  "all_unavailable_fallback",
  "paused_resumed",
] as const;
export type TransitionReason = (typeof TRANSITION_REASONS)[number];

export const NOTIFICATION_TYPES = [
  "cycle_started",
  "cycle_reassigned_manual_skip",
  "cycle_reassigned_auto_skip",
  "cycle_reassigned_member_left",
  "cycle_fallback_owner",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

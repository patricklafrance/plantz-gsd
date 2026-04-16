import { z } from "zod/v4";

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

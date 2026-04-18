import { describe, test } from "vitest";

/**
 * AVLB-04 manual skip Server Action (mocked Prisma + mocked auth). Wave 3 (03-04) fills.
 */
describe("skipCurrentCycle (AVLB-04, D-14)", () => {
  test.todo("non-member caller → returns { error } via ForbiddenError from requireHouseholdAccess");
  test.todo("member but not current assignee → returns { error } (explicit session.user.id === assignedUserId assertion)");
  test.todo("current assignee → calls transitionCycle(householdId, 'manual_skip')");
  test.todo("demo user → returns { error: 'Demo mode — sign up to save your changes.' }");
  test.todo("successful skip → revalidatePath called with HOUSEHOLD_PATHS.dashboard");
});

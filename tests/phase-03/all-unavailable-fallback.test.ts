import { describe, test, afterAll } from "vitest";
import { EMAIL_PREFIX } from "./fixtures";

/**
 * AVLB-05 all-unavailable fallback — two scenarios (Wave 2 fills).
 */
describe("transitionCycle all-unavailable fallback (AVLB-05)", () => {
  test.todo("owner available: new cycle active with owner as assignee; transitionReason='all_unavailable_fallback'; notification type='cycle_fallback_owner'");
  test.todo("owner also unavailable: new cycle status='paused'; assignedUserId=null; zero notifications emitted");
  test.todo("both scenarios record outgoing transitionReason='all_unavailable_fallback' (not the caller's hint)");
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
afterAll(() => { void EMAIL_PREFIX; });

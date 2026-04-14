import { describe, test } from "vitest";

describe("RegisterForm component (Phase 2)", () => {
  test.todo("renders email, password, and confirm password fields");
  test.todo("shows inline error for invalid email on submit");
  test.todo("shows inline error for password shorter than 6 characters");
  test.todo("shows inline error when passwords do not match");
  test.todo("disables all fields and shows loading spinner during submission");
  test.todo("displays cross-link to login page");
  test.todo("calls registerUser server action with form values on valid submit");
  test.todo("shows toast notification on server error response");
});

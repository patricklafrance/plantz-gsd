import { test } from "@playwright/test";

test.describe("authentication flow (Phase 2)", () => {
  test.fixme("unauthenticated user visiting / is redirected to /login", async ({ page }) => {
    // AUTH-05: Route protection
  });

  test.fixme("user can register with email and password and lands on /dashboard", async ({ page }) => {
    // AUTH-01: Registration + D-03: auto-login redirect
  });

  test.fixme("user can log in with existing credentials", async ({ page }) => {
    // AUTH-02: Login with persistent session
  });

  test.fixme("user can log out and is redirected to /login", async ({ page }) => {
    // AUTH-03: Logout
  });

  test.fixme("new user sees onboarding banner on dashboard", async ({ page }) => {
    // AUTH-04: Onboarding after first login
  });

  test.fixme("user can complete onboarding by selecting plant count range", async ({ page }) => {
    // AUTH-04: Onboarding completion + D-07: range buttons
  });

  test.fixme("login page shows error toast for wrong credentials", async ({ page }) => {
    // AUTH-02: Error handling
  });

  test.fixme("register page shows inline validation errors", async ({ page }) => {
    // AUTH-01: Client-side validation + D-02
  });
});

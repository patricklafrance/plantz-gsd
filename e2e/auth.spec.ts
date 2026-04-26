import { test, expect } from "@playwright/test";

/**
 * Phase 8.5 — Critical-path: register → onboarding → dashboard, and login.
 *
 * Each spec mints a unique email so reruns against the same DB don't collide.
 * Database reset is the runner's responsibility; tests assume the demo user
 * (demo@plantz.app) exists per `npx prisma db seed`.
 */

const uniqueEmail = (label: string) =>
  `e2e-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;

test.describe("auth + onboarding (Phase 8.5)", () => {
  test("unauthenticated user visiting / lands on /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
    await expect(
      page.getByRole("heading", { name: /sign in/i }),
    ).toBeVisible();
  });

  test("register form requires the new name field (Phase 8.2)", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByLabel("Your name")).toBeVisible();
    // Submit without filling name — inline validation should block it.
    await page.getByLabel("Email").fill(uniqueEmail("namegate"));
    await page.getByLabel("Password", { exact: true }).fill("password123");
    await page.getByLabel("Confirm password").fill("password123");
    await page.getByRole("button", { name: /create account/i }).click();
    // Either an inline message or staying on /register proves the form
    // didn't reach the auto-login redirect.
    await expect(page).toHaveURL(/\/register/);
  });

  test("user can register with a name, lands on /h/<slug>/dashboard with derived household name", async ({
    page,
  }) => {
    const email = uniqueEmail("register");
    await page.goto("/register");
    await page.getByLabel("Your name").fill("Pat");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill("password123");
    await page.getByLabel("Confirm password").fill("password123");
    await page.getByRole("button", { name: /create account/i }).click();

    await page.waitForURL(/\/h\/[A-Za-z0-9]+\/dashboard/, { timeout: 15000 });

    // Phase 8.2: derived household name should appear in the user menu / chrome.
    // Open the user menu (avatar button) to surface the household name.
    await page.getByRole("button", { name: /user menu/i }).click();
    await expect(page.getByText(/Pat's plants/i)).toBeVisible();
  });

  test("demo login lands on dashboard without credentials", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: /explore without signing up/i }).click();
    await page.waitForURL(/\/h\/[A-Za-z0-9]+\/dashboard/, { timeout: 15000 });
    await expect(
      page.getByRole("heading", { name: /dashboard/i }),
    ).toBeVisible();
  });
});

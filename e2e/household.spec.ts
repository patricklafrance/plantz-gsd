import { test, expect } from "@playwright/test";

/**
 * Phase 8.5 — Critical-path: household switcher round-trip via the
 * UserMenu, plus the cycle-snooze + skip controls visibility for the active
 * assignee on a freshly-registered solo household.
 */

const uniqueEmail = (label: string) =>
  `e2e-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;

async function registerFreshUser(page: import("@playwright/test").Page, name: string) {
  await page.goto("/register");
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email").fill(uniqueEmail(name.toLowerCase()));
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByLabel("Confirm password").fill("password123");
  await page.getByRole("button", { name: /create account/i }).click();
  await page.waitForURL(/\/h\/[A-Za-z0-9]+\/dashboard/, { timeout: 15000 });
}

test("solo-household assignee sees Snooze + Skip controls (Phase 8.1)", async ({ page }) => {
  await registerFreshUser(page, "SoloOwner");

  // Solo household: registered user is the active cycle assignee. The
  // CycleAssigneeActions row mounts below the cycle-countdown banner.
  await expect(
    page.getByRole("button", { name: /snooze cycle/i }),
  ).toBeVisible({ timeout: 10000 });
  await expect(
    page.getByRole("button", { name: /skip cycle/i }),
  ).toBeVisible();
});

test("snooze action surfaces a success toast (Phase 8.1)", async ({ page }) => {
  await registerFreshUser(page, "Snoozer");

  // Open the snooze dropdown and pick "3 days".
  await page.getByRole("button", { name: /snooze cycle/i }).click();
  await page.getByRole("menuitem", { name: "3 days" }).click();

  // sonner renders toasts as live regions; assert the success copy lands.
  await expect(page.getByText(/cycle ends 3 days later/i)).toBeVisible({
    timeout: 5000,
  });
});

test("preferences page exposes a theme selector (Phase 8.4)", async ({ page }) => {
  await registerFreshUser(page, "ThemeUser");
  // Navigate via the user menu rather than typing the URL — keeps the
  // assertion close to the production flow.
  await page.getByRole("button", { name: /user menu/i }).click();
  await page.getByRole("menuitem", { name: /account preferences/i }).click();

  await page.waitForURL(/\/preferences/);
  await expect(page.getByRole("heading", { name: /appearance/i })).toBeVisible();
  await expect(page.getByRole("radio", { name: /^light$/i })).toBeVisible();
  await expect(page.getByRole("radio", { name: /^dark$/i })).toBeVisible();
  await expect(page.getByRole("radio", { name: /^system$/i })).toBeVisible();

  // Pick dark, confirm <html> gets the .dark class.
  await page.getByRole("radio", { name: /^dark$/i }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
});

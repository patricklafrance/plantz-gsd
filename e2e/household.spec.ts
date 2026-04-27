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

  // Single-click Snooze — the action defers the cycle by one cycle duration
  // (default 7 days for new households).
  await page.getByRole("button", { name: /snooze cycle/i }).click();

  // sonner renders toasts as live regions; assert the success copy lands.
  await expect(page.getByText(/snoozed — cycle pushed by/i)).toBeVisible({
    timeout: 5000,
  });
});

test("user menu exposes inline appearance toggle (Phase 8.4)", async ({ page }) => {
  await registerFreshUser(page, "ThemeUser");

  await page.getByRole("button", { name: /user menu/i }).click();
  // The inline toggle is a 3-button radiogroup labeled "Appearance" inside
  // the dropdown content. Pick dark, then confirm html.dark applies.
  const darkBtn = page.getByRole("radio", { name: /dark theme/i });
  await expect(darkBtn).toBeVisible();
  await darkBtn.click();
  await expect(page.locator("html")).toHaveClass(/dark/);
});

test("user-menu Settings group has Household / Availabilities / Account", async ({ page }) => {
  await registerFreshUser(page, "Settler");

  await page.getByRole("button", { name: /user menu/i }).click();
  await expect(page.getByRole("menuitem", { name: /^Household$/ })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: /^Availabilities$/ })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: /^Account$/ })).toBeVisible();

  // Account links to /preferences (page title "Preferences")
  await page.getByRole("menuitem", { name: /^Account$/ }).click();
  await page.waitForURL(/\/preferences/);
  await expect(page.getByRole("heading", { name: /^Preferences$/ })).toBeVisible();
});

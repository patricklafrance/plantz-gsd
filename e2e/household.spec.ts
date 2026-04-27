import { test, expect } from "@playwright/test";

/**
 * Phase 8.5 — Critical-path: cycle skip controls and the user-menu Settings
 * group on a freshly-registered household.
 *
 * Skip-my-turn is intentionally hidden on solo households (no one to hand
 * off to). The skip behavior with confirmation + reassignment is exercised
 * in invite.spec.ts where a second user is in the household.
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

test("solo-household assignee does NOT see a Skip button (Phase 8.1)", async ({ page }) => {
  await registerFreshUser(page, "SoloOwner");

  // Cycle banner renders, but with a single member there is nobody to hand
  // off to — so the action slot is empty. The button must not be in the DOM.
  await expect(page.getByText(/on rotation/i)).toBeVisible({ timeout: 10000 });
  await expect(
    page.getByRole("button", { name: /skip my turn/i }),
  ).toHaveCount(0);
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

test("user-menu Settings group has Household / Time off / Account", async ({ page }) => {
  await registerFreshUser(page, "Settler");

  await page.getByRole("button", { name: /user menu/i }).click();
  await expect(page.getByRole("menuitem", { name: /^Household$/ })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: /^Time off$/ })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: /^Account$/ })).toBeVisible();

  // Account links to the preferences page.
  await page.getByRole("menuitem", { name: /^Account$/ }).click();
  await page.waitForURL(/\/preferences/);
});

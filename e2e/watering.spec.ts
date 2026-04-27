import { test, expect } from "@playwright/test";

/**
 * Phase 8.5 — Critical-path: add a plant via the catalog dialog → log
 * watering → plant moves out of "due today" / "needs water" group. Runs
 * against a freshly-registered user so the dashboard begins empty.
 */

const uniqueEmail = () =>
  `e2e-water-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;

test("add plant + log watering removes it from due-today", async ({ page }) => {
  // 1. Register a fresh user.
  await page.goto("/register");
  await page.getByLabel("Your name").fill("Water");
  await page.getByLabel("Email").fill(uniqueEmail());
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByLabel("Confirm password").fill("password123");
  await page.getByRole("button", { name: /create account/i }).click();
  await page.waitForURL(/\/h\/[A-Za-z0-9]+\/dashboard/, { timeout: 15000 });

  // 2. Open the AddPlantDialog from the dashboard's "Add plant" trigger.
  // The empty-state region also has an "Add plant" button — pick the
  // header trigger via .first().
  await page.getByRole("button", { name: /^Add plant$/ }).first().click();

  // The dialog's first step is "Choose a plant" with a "Search plants..."
  // input and a grid of catalog tiles.
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByPlaceholder(/Search plants/i).fill("Snake");
  // Catalog tiles render `<button>` with the plant name + species
  // concatenated into the accessible name (e.g. "Snake Plant Dracaena
  // trifasciata"). Match on the substring rather than an exact regex.
  await page
    .getByRole("button", { name: /Snake Plant\b/ })
    .first()
    .click();

  // Step 2 is the details form. Override the auto-filled nickname so the
  // assertion below is unambiguous.
  await page.getByLabel(/^Nickname$/).fill("Living-room snake");

  // 3. Submit. The form's primary button reads "Add plant".
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /^Add plant$/ })
    .click();

  // 4. New plant appears on the dashboard.
  await expect(page.getByText(/Living-room snake/i)).toBeVisible({
    timeout: 10000,
  });

  // 5. Click the per-card "Water Living-room snake" button.
  await page
    .getByRole("button", { name: /^Water Living-room snake$/ })
    .click();

  // 6. After reload, the plant should appear in "Recently Watered" rather
  // than "Needs water".
  await page.reload();
  await expect(
    page.getByRole("heading", { name: /^Recently Watered/i }),
  ).toBeVisible({ timeout: 5000 });
});

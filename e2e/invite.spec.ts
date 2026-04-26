import { test, expect } from "@playwright/test";

/**
 * Phase 8.5 — Critical-path: owner generates an invite link, a second user
 * accepts it, and the household membership reflects both members in the
 * settings page.
 *
 * The full cycle-handoff at the cycle boundary requires either time-travel
 * or a backdated cycle seed; that is left to a follow-up integration test.
 * This spec covers the invitation accept side of the contract.
 */

const uniqueEmail = (label: string) =>
  `e2e-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;

test("owner invites + second user accepts → both appear in members list", async ({
  browser,
}) => {
  const ownerCtx = await browser.newContext();
  const ownerPage = await ownerCtx.newPage();
  const inviteeCtx = await browser.newContext();
  const inviteePage = await inviteeCtx.newPage();

  // 1. Owner registers
  await ownerPage.goto("/register");
  await ownerPage.getByLabel("Your name").fill("Owner");
  await ownerPage.getByLabel("Email").fill(uniqueEmail("owner"));
  await ownerPage.getByLabel("Password", { exact: true }).fill("password123");
  await ownerPage.getByLabel("Confirm password").fill("password123");
  await ownerPage.getByRole("button", { name: /create account/i }).click();
  await ownerPage.waitForURL(/\/h\/[A-Za-z0-9]+\/dashboard/, { timeout: 15000 });

  // 2. Owner opens household-settings → invitations card
  await ownerPage.getByRole("button", { name: /user menu/i }).click();
  await ownerPage.getByRole("menuitem", { name: /household settings/i }).click();
  await ownerPage.waitForURL(/household-settings/);

  // 3. Owner generates invite link
  await ownerPage.getByRole("button", { name: /generate.*link|new invite|invite/i }).first().click();

  // The token is rendered as a copyable URL — grab it from a code/input element.
  const linkLocator = ownerPage.locator("text=/\\/join\\/[0-9a-f]{64}/").first();
  await expect(linkLocator).toBeVisible({ timeout: 5000 });
  const linkText = (await linkLocator.textContent())?.trim() ?? "";
  const tokenMatch = linkText.match(/\/join\/([0-9a-f]{64})/);
  expect(tokenMatch).not.toBeNull();
  const token = tokenMatch![1];

  // 4. Invitee registers + accepts via /join/{token}
  await inviteePage.goto("/register");
  await inviteePage.getByLabel("Your name").fill("Invitee");
  await inviteePage.getByLabel("Email").fill(uniqueEmail("invitee"));
  await inviteePage.getByLabel("Password", { exact: true }).fill("password123");
  await inviteePage.getByLabel("Confirm password").fill("password123");
  await inviteePage.getByRole("button", { name: /create account/i }).click();
  await inviteePage.waitForURL(/\/h\/[A-Za-z0-9]+\/dashboard/, { timeout: 15000 });

  await inviteePage.goto(`/join/${token}`);
  await inviteePage.getByRole("button", { name: /accept|join/i }).first().click();

  // 5. Invitee lands on the owner's household dashboard
  await inviteePage.waitForURL(/\/h\/[A-Za-z0-9]+\/dashboard/, { timeout: 15000 });

  // 6. Owner reloads settings — Invitee row should show up in the members list
  await ownerPage.reload();
  await expect(ownerPage.getByText(/Invitee/i)).toBeVisible({ timeout: 5000 });

  await ownerCtx.close();
  await inviteeCtx.close();
});

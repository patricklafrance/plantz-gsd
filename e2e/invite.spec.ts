import { test, expect } from "@playwright/test";

/**
 * Phase 8.5 — Critical-path: owner generates an invite link, a second user
 * accepts it, the household membership reflects both members, and the
 * skip-my-turn flow reassigns the cycle in place with the receiver getting
 * a notification.
 */

const uniqueEmail = (label: string) =>
  `e2e-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;

async function registerOnNewPage(
  page: import("@playwright/test").Page,
  name: string,
) {
  await page.goto("/register");
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email").fill(uniqueEmail(name.toLowerCase()));
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByLabel("Confirm password").fill("password123");
  await page.getByRole("button", { name: /create account/i }).click();
  await page.waitForURL(/\/h\/[A-Za-z0-9]+\/dashboard/, { timeout: 15000 });
}

test("owner invites + invitee accepts → both appear in members list", async ({
  browser,
}) => {
  const ownerCtx = await browser.newContext();
  const ownerPage = await ownerCtx.newPage();
  const inviteeCtx = await browser.newContext();
  const inviteePage = await inviteeCtx.newPage();

  // 1. Owner registers and lands on dashboard.
  await registerOnNewPage(ownerPage, "Owner");

  // 2. Owner opens user menu → "Household" → /h/{slug}/household-settings.
  await ownerPage.getByRole("button", { name: /user menu/i }).click();
  await ownerPage.getByRole("menuitem", { name: /^Household$/ }).click();
  await ownerPage.waitForURL(/household-settings/);

  // 3. Owner clicks "Invite people" → dialog → "Create invite link".
  await ownerPage.getByRole("button", { name: /^Invite people$/ }).click();
  await ownerPage.getByRole("button", { name: /^Create invite link$/ }).click();

  // The invite URL is the value of a readonly textbox labeled "Invite link".
  const linkInput = ownerPage.getByRole("textbox", { name: /^Invite link$/ });
  await expect(linkInput).toBeVisible({ timeout: 5000 });
  const url = await linkInput.inputValue();
  const tokenMatch = url.match(/\/join\/([0-9a-f]{64})/);
  expect(tokenMatch).not.toBeNull();
  const token = tokenMatch![1];

  // 4. Invitee registers (auto-redirects to invite acceptance after register).
  await inviteePage.goto(`/join/${token}`);
  await inviteePage.getByRole("button", { name: /create account/i }).click();
  await inviteePage.getByLabel("Your name").fill("Invitee");
  await inviteePage.getByLabel("Email").fill(uniqueEmail("invitee"));
  await inviteePage.getByLabel("Password", { exact: true }).fill("password123");
  await inviteePage.getByLabel("Confirm password").fill("password123");
  await inviteePage.getByRole("button", { name: /create account/i }).click();

  // After register the join page returns; click Accept.
  await inviteePage.getByRole("button", { name: /accept and join/i }).click();
  await inviteePage.waitForURL(/\/h\/[A-Za-z0-9]+\/dashboard/, { timeout: 15000 });

  // 5. Owner reloads settings — Invitee row appears in the members list.
  await ownerPage.reload();
  await expect(ownerPage.getByText(/Invitee/i).first()).toBeVisible({
    timeout: 5000,
  });

  await ownerCtx.close();
  await inviteeCtx.close();
});

test("skip-my-turn reassigns the cycle in place with confirmation toast (Phase 8.1)", async ({
  browser,
}) => {
  const ownerCtx = await browser.newContext();
  const ownerPage = await ownerCtx.newPage();
  const inviteeCtx = await browser.newContext();
  const inviteePage = await inviteeCtx.newPage();

  // 1. Owner registers; invitee accepts.
  await registerOnNewPage(ownerPage, "OwnerSkip");
  await ownerPage.getByRole("button", { name: /user menu/i }).click();
  await ownerPage.getByRole("menuitem", { name: /^Household$/ }).click();
  await ownerPage.waitForURL(/household-settings/);
  await ownerPage.getByRole("button", { name: /^Invite people$/ }).click();
  await ownerPage.getByRole("button", { name: /^Create invite link$/ }).click();
  const linkInput = ownerPage.getByRole("textbox", { name: /^Invite link$/ });
  const url = await linkInput.inputValue();
  const token = url.match(/\/join\/([0-9a-f]{64})/)![1];

  await inviteePage.goto(`/join/${token}`);
  await inviteePage.getByRole("button", { name: /create account/i }).click();
  await inviteePage.getByLabel("Your name").fill("InviteeSkip");
  await inviteePage.getByLabel("Email").fill(uniqueEmail("inviteeskip"));
  await inviteePage.getByLabel("Password", { exact: true }).fill("password123");
  await inviteePage.getByLabel("Confirm password").fill("password123");
  await inviteePage.getByRole("button", { name: /create account/i }).click();
  await inviteePage.getByRole("button", { name: /accept and join/i }).click();
  await inviteePage.waitForURL(/\/h\/[A-Za-z0-9]+\/dashboard/, { timeout: 15000 });

  // 2. Owner returns to dashboard and clicks Skip my turn.
  const ownerSlugMatch = ownerPage.url().match(/\/h\/([A-Za-z0-9]+)\//);
  expect(ownerSlugMatch).not.toBeNull();
  await ownerPage.goto(`/h/${ownerSlugMatch![1]}/dashboard`);
  await ownerPage.getByRole("button", { name: /^Skip my turn$/ }).click();

  // AlertDialog: confirm the skip via the dialog's "Skip my turn" button.
  await expect(ownerPage.getByRole("alertdialog")).toBeVisible();
  await ownerPage
    .getByRole("alertdialog")
    .getByRole("button", { name: /^Skip my turn$/ })
    .click();

  // 3. Success toast.
  await expect(
    ownerPage.getByText(/passed to the next member/i),
  ).toBeVisible({ timeout: 5000 });

  // 4. Owner banner now shows the invitee as the active assignee.
  await expect(
    ownerPage.getByText("InviteeSkip", { exact: true }).first(),
  ).toBeVisible({ timeout: 5000 });
  await expect(ownerPage.getByText(/is watering this cycle/i)).toBeVisible();

  // 5. Invitee reloads — bell badge shows 1 unread + their banner says they
  // are now covering.
  await inviteePage.reload();
  await expect(
    inviteePage.getByRole("button", { name: /^1 notifications$/ }),
  ).toBeVisible({ timeout: 5000 });
  await expect(
    inviteePage.getByText(/skipped — you're covering/i),
  ).toBeVisible();

  await ownerCtx.close();
  await inviteeCtx.close();
});

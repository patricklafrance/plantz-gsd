import { test, expect } from "@playwright/test";

test("home page loads without errors", async ({ page }) => {
  await page.goto("/");
  await expect(page).not.toHaveTitle(/Error/);
  await expect(page.locator("body")).toBeVisible();
});

test("unauthenticated / redirects to login with sign-in heading", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await expect(
    page.getByRole("heading", { name: "Sign in to your account" }),
  ).toBeVisible();
});

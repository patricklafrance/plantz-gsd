import { test, expect } from "@playwright/test";

test("home page loads without errors", async ({ page }) => {
  await page.goto("/");
  await expect(page).not.toHaveTitle(/Error/);
  await expect(page.locator("body")).toBeVisible();
});

test("home page displays Plantz heading", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Plantz" })).toBeVisible();
});

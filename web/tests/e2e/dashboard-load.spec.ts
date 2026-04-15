import { test, expect } from "@playwright/test";

test.describe("Dashboard smoke", () => {
  test("loads and renders hero + rings + meal cards", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText("Today", { exact: true })).toBeVisible();
    await expect(page.getByText("Calories").first()).toBeVisible();
    await expect(page.getByText("Protein").first()).toBeVisible();
    await expect(page.getByText("Carbs").first()).toBeVisible();
    await expect(page.getByText("Fat").first()).toBeVisible();
    await expect(page.getByText("Fiber").first()).toBeVisible();
    await expect(page.getByText("Breakfast").first()).toBeVisible();
    await expect(page.getByText("Lunch").first()).toBeVisible();
    await expect(page.getByText("Dinner").first()).toBeVisible();
    await expect(page.getByText("Pre-Sleep").first()).toBeVisible();
  });

  test("compact floating bar appears after scrolling past hero", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForTimeout(500);
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(300);
    const floatingBar = page.locator("text=/P$/").locator("..").locator("..");
    await expect(floatingBar.first()).toBeVisible();
  });
});

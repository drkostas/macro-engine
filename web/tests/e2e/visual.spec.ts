import { test, expect } from "@playwright/test";

test.describe("Visual regression @visual", () => {
  test("dashboard hero at 1440x900", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dashboard?date=2026-04-14");
    // Allow fonts + data to settle
    await page.waitForTimeout(2500);
    // Screenshot the Today card (second top-level child of main)
    const hero = page.locator("main > div").nth(1);
    await expect(hero).toHaveScreenshot("dashboard-hero.png", {
      maxDiffPixelRatio: 0.02,
    });
  });
});

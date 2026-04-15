import { test, expect } from "@playwright/test";

test("log a meal via recent suggestion", async ({ page }) => {
  await page.goto("/dashboard");
  await page.waitForTimeout(1500);

  // Find an empty slot that has "Recent" suggestions. Dinner or Pre-Sleep usually do.
  // Look for the card containing "Recent" eyebrow text.
  const recentSection = page.locator("text=Recent").first();
  if (!(await recentSection.isVisible())) {
    test.skip(true, "No recent meals available in test data");
    return;
  }

  // Count meals in that slot card before logging
  const card = recentSection.locator("xpath=ancestor::div[contains(@class, 'rounded-2xl')][1]");
  const beforeText = await card.textContent();

  // Click the first recent meal button below "Recent" label
  const recentButtons = card.locator('button[class*="bg-base/30"], button[class*="hover:bg-surface-elevated"]');
  const firstRecent = recentButtons.first();
  if (!(await firstRecent.isVisible())) {
    test.skip(true, "No recent meal buttons found");
    return;
  }

  await firstRecent.click();

  // After logging, the card should change (meal added or composer opens).
  await page.waitForTimeout(1500);
  const afterText = await card.textContent();
  expect(afterText).not.toBe(beforeText);
});

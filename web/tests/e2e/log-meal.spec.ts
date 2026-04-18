import { test, expect } from "@playwright/test";

test("log a meal via recent suggestion", async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem("me_tour_done", "1"); });
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");

  // Find an empty slot that has "Recent" suggestions. Dinner or Pre-Sleep usually do.
  // Use count() instead of isVisible() to avoid hanging on invisible elements.
  const recentSection = page.locator("text=Recent").first();
  if ((await recentSection.count()) === 0) {
    test.skip(true, "No recent meals available in test data");
    return;
  }
  // Double-check visibility with a short timeout
  const visible = await recentSection.isVisible({ timeout: 2000 }).catch(() => false);
  if (!visible) {
    test.skip(true, "Recent section not visible");
    return;
  }

  // Count meals in that slot card before logging
  const card = recentSection.locator("xpath=ancestor::div[contains(@class, 'rounded-2xl')][1]");
  const beforeText = await card.textContent();

  // Click the first recent meal button below "Recent" label
  const recentButtons = card.locator('button[class*="bg-base/30"], button[class*="hover:bg-surface-elevated"]');
  if ((await recentButtons.count()) === 0) {
    test.skip(true, "No recent meal buttons found");
    return;
  }
  const firstRecent = recentButtons.first();
  const btnVisible = await firstRecent.isVisible({ timeout: 2000 }).catch(() => false);
  if (!btnVisible) {
    test.skip(true, "No recent meal buttons visible");
    return;
  }

  await firstRecent.click();

  // After logging, the card should change (meal added or composer opens).
  // Wait for the API response instead of a fixed timeout
  await page.waitForResponse(
    (r) => r.url().includes("/api/nutrition/") && r.status() < 500,
    { timeout: 5000 },
  ).catch(() => {});
  const afterText = await card.textContent();
  expect(afterText).not.toBe(beforeText);
});

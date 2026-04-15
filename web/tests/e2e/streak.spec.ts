import { test, expect } from "@playwright/test";

// Read-only: asks the API for current streak and expects the badge to be
// present iff streak >= 2. No DB mutations — we trust the existing data.

test.describe("Streak badge", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => { localStorage.setItem("me_tour_done", "1"); });
  });

  test("renders badge when streak is 2+", async ({ page }) => {
    await page.goto("/dashboard");
    const resp = await page.evaluate(() =>
      fetch("/api/nutrition/streak").then((r) => r.json()),
    );
    const streak = Number(resp?.streak ?? 0);

    const badge = page.getByRole("status", { name: /^Streak \d+ days$/ });
    if (streak >= 2) {
      await expect(badge).toBeVisible();
      await expect(badge).toHaveText(new RegExp(`${streak} days`));
    } else {
      await expect(badge).toHaveCount(0);
    }
  });
});

import { test, expect } from "@playwright/test";

// Read-only: confirms that whichever milestones the API reports as achieved
// are rendered on the settings page under the "Milestones" section. We do
// not mutate user_milestones from the test.

test.describe("Milestones", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => { localStorage.setItem("me_tour_done", "1"); });
  });

  test("settings page lists achieved milestones with counts", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForTimeout(600);

    const milestonesTab = page.getByRole("button", { name: "Milestones" }).first();
    await milestonesTab.click();
    await page.waitForTimeout(600);

    const resp = await page.evaluate(() =>
      fetch("/api/nutrition/milestones").then((r) => r.json()),
    );
    const all: Array<{ id: string; label: string; achieved: boolean }> = resp?.all ?? [];
    expect(all.length).toBeGreaterThan(0);

    const achieved = all.filter((m) => m.achieved);
    const header = page.getByText(
      new RegExp(`${achieved.length} of ${all.length} unlocked`),
    );
    await expect(header).toBeVisible();

    // The first achieved milestone's label should be visible in the grid.
    if (achieved.length > 0) {
      await expect(page.getByText(achieved[0].label).first()).toBeVisible();
    }
  });
});

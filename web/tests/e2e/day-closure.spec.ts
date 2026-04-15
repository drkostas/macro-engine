import { test, expect } from "@playwright/test";

test.describe("Day closure celebration modal", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => { localStorage.setItem("me_tour_done", "1"); });
    // Reopen today if it was closed by a previous test run
    await page.goto("/dashboard");
    await page.waitForTimeout(1500);
    const today = new Date().toISOString().split("T")[0];
    await page.evaluate(async (d) => {
      await fetch("/api/nutrition/reopen-day", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: d }),
      }).catch(() => {});
    }, today);
  });

  test("shows after clicking Close day on an active day with meals", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForTimeout(2000);

    const closeBtn = page.getByRole("button", { name: "Close day" });
    const hasCloseBtn = await closeBtn.isVisible().catch(() => false);
    if (!hasCloseBtn) {
      test.skip(true, "Day is already closed or has no meals to close");
      return;
    }

    await closeBtn.click();
    const dialog = page.getByRole("dialog", { name: "Day complete" });
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Should show "Day closed" eyebrow
    await expect(dialog.getByText("Day closed")).toBeVisible();
    // Ate / Target / Burn summary
    await expect(dialog.getByText("Ate")).toBeVisible();
    await expect(dialog.getByText("Target")).toBeVisible();
    await expect(dialog.getByText("Burn")).toBeVisible();
    // Done button
    await expect(dialog.getByRole("button", { name: "Done" })).toBeVisible();
  });

  test("Done button closes the modal", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForTimeout(2000);

    const closeBtn = page.getByRole("button", { name: "Close day" });
    const hasCloseBtn = await closeBtn.isVisible().catch(() => false);
    if (!hasCloseBtn) {
      test.skip(true, "Day already closed");
      return;
    }

    await closeBtn.click();
    const dialog = page.getByRole("dialog", { name: "Day complete" });
    await expect(dialog).toBeVisible({ timeout: 5000 });

    await dialog.getByRole("button", { name: "Done" }).click();
    await expect(dialog).not.toBeVisible();
  });

  test("clicking backdrop dismisses the modal", async ({ page }) => {
    // Force-show modal via local state by simulating API response — use direct interaction instead.
    // If we can't close the day (already closed), skip.
    await page.goto("/dashboard");
    await page.waitForTimeout(2000);
    const closeBtn = page.getByRole("button", { name: "Close day" });
    const hasCloseBtn = await closeBtn.isVisible().catch(() => false);
    if (!hasCloseBtn) {
      test.skip(true, "Day already closed");
      return;
    }
    await closeBtn.click();
    const dialog = page.getByRole("dialog", { name: "Day complete" });
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Click near the top-left corner (backdrop)
    await page.mouse.click(10, 10);
    await expect(dialog).not.toBeVisible();
  });
});

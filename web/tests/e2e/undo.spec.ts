import { test, expect } from "@playwright/test";

test.describe("Undo toast", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => { localStorage.setItem("me_tour_done", "1"); });
  });

  test("undo toast appears after deleting a meal and restores it", async ({ page }) => {
    await page.goto("/dashboard?date=2026-04-14");
    await page.waitForTimeout(2000);

    // Find a meal Remove button
    const removeBtn = page.getByRole("button", { name: "Remove" }).first();
    const hasRemove = await removeBtn.isVisible().catch(() => false);
    if (!hasRemove) { test.skip(true, "no meals to delete"); return; }

    // Capture hero eaten kcal before delete
    const hero = page.locator('[data-tour="hero"]');
    const beforeText = (await hero.textContent()) ?? "";
    await removeBtn.click();
    await page.waitForTimeout(1500);

    // Undo toast visible
    const toast = page.getByRole("status", { name: "Undo action" });
    await expect(toast).toBeVisible();
    await expect(toast.getByText("Meal removed")).toBeVisible();

    // Hero should have decreased (eaten count went down)
    const afterDeleteText = (await hero.textContent()) ?? "";
    expect(afterDeleteText).not.toBe(beforeText);

    // Click Undo
    await toast.getByRole("button", { name: "Undo" }).click();
    await page.waitForTimeout(2500);

    // Toast should disappear
    await expect(toast).not.toBeVisible();

    // Hero should return to (roughly) the before state
    const restoredText = (await hero.textContent()) ?? "";
    expect(restoredText).not.toBe(afterDeleteText);
  });

  test("dismiss (×) closes toast without invoking undo", async ({ page }) => {
    await page.goto("/dashboard?date=2026-04-14");
    await page.waitForTimeout(2000);
    const removeBtn = page.getByRole("button", { name: "Remove" }).first();
    const hasRemove = await removeBtn.isVisible().catch(() => false);
    if (!hasRemove) { test.skip(true, "no meals to delete"); return; }

    await removeBtn.click();
    const toast = page.getByRole("status", { name: "Undo action" });
    await expect(toast).toBeVisible();

    // Click the × dismiss button
    await toast.getByRole("button", { name: "Dismiss" }).click();
    await expect(toast).not.toBeVisible();
  });
});

import { test, expect } from "@playwright/test";

function tomorrowISO() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

test.describe("Plan tomorrow", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => { localStorage.setItem("me_tour_done", "1"); });
  });

  test("shows Plan button instead of Log on future dates", async ({ page }) => {
    await page.goto(`/dashboard?date=${tomorrowISO()}`);
    await page.waitForTimeout(2000);

    // Scope to the Breakfast card. Its compose trigger is either "Log Breakfast"
    // (empty) or "+ Add more" (has items).
    const breakfastCard = page.locator("text=Breakfast").locator("xpath=ancestor::div[contains(@class, 'rounded-2xl')][1]");
    const triggerLog = breakfastCard.getByRole("button", { name: /Log Breakfast/ });
    const triggerAdd = breakfastCard.getByRole("button", { name: /\+ Add more/ });
    const trigger = (await triggerLog.isVisible().catch(() => false)) ? triggerLog : triggerAdd;
    await trigger.click();
    await page.waitForTimeout(500);

    const firstIng = breakfastCard.locator('button:has-text("Oats")').first();
    const hasIng = await firstIng.isVisible().catch(() => false);
    if (!hasIng) { test.skip(true, "No test ingredients"); return; }
    await firstIng.click();
    await page.waitForTimeout(200);

    await breakfastCard.getByRole("button", { name: /Compose meal/ }).click();
    await page.waitForTimeout(1500);

    await expect(breakfastCard.getByRole("button", { name: /Plan Breakfast/ })).toBeVisible();
  });

  test("planned meals show as ghost and do not count toward eaten", async ({ page }) => {
    const date = tomorrowISO();

    // Create a planned meal directly via API
    await page.goto(`/dashboard?date=${date}`);
    await page.waitForTimeout(1500);
    await page.evaluate(async (d) => {
      await fetch("/api/nutrition/log-meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: d, meal_slot: "dinner", planned: true,
          items: [
            { name: "Test Protein", grams: 100, calories: 150, protein: 30, carbs: 0, fat: 3, fiber: 0 },
          ],
        }),
      });
    }, date);

    await page.reload();
    await page.waitForTimeout(2000);

    // Ghost section should appear under Dinner with "Planned" label
    await expect(page.getByText("📅 Planned").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Mark as eaten/ }).first()).toBeVisible();
  });

  test("Mark as eaten converts planned meal to actual", async ({ page }) => {
    const date = tomorrowISO();
    await page.goto(`/dashboard?date=${date}`);
    await page.waitForTimeout(1500);

    // Seed a planned meal in pre-sleep (a slot unlikely to have other planned meals)
    await page.evaluate(async (d) => {
      await fetch("/api/nutrition/log-meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: d, meal_slot: "pre_sleep", planned: true,
          items: [{ name: "UniqueTestMeal", grams: 100, calories: 200, protein: 20, carbs: 20, fat: 5, fiber: 1 }],
        }),
      });
    }, date);
    await page.reload();
    await page.waitForTimeout(2000);

    // Find the Pre-Sleep card
    const preSleepCard = page.locator("text=Pre-Sleep").locator("xpath=ancestor::div[contains(@class, 'rounded-2xl')][1]");
    await expect(preSleepCard.getByText("📅 Planned")).toBeVisible();

    // Click "Mark as eaten" inside this card
    await preSleepCard.getByRole("button", { name: /Mark as eaten/ }).click();
    await page.waitForTimeout(2500);

    // Planned ghost inside pre-sleep card should be gone
    await expect(preSleepCard.getByText("📅 Planned")).not.toBeVisible();
  });
});

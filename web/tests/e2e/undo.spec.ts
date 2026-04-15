import { test, expect } from "@playwright/test";

// Use a dedicated test date far from any real logged days.
// Seed and clean up a disposable meal per test so we never touch the user's data.
const TEST_DATE = "2020-01-15";

async function seedTestMeal(page: import("@playwright/test").Page, slot = "lunch") {
  await page.evaluate(async ({ date, slot }) => {
    // Ensure nutrition_day exists then insert a throwaway meal
    await fetch("/api/nutrition/log-meal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        meal_slot: slot,
        source: "undo_test",
        items: [
          { name: "UndoTestFood", grams: 100, calories: 250, protein: 20, carbs: 25, fat: 8, fiber: 1 },
        ],
      }),
    });
  }, { date: TEST_DATE, slot });
}

async function cleanupTestMeals(page: import("@playwright/test").Page) {
  await page.evaluate(async ({ date }) => {
    const r = await fetch(`/api/nutrition/plan?date=${date}`);
    const data = await r.json();
    const all = Object.values(data.mealsBySlot ?? {}).flat() as Array<{ id: number; items?: Array<{ name?: string }> }>;
    for (const m of all) {
      // Only delete test meals (by the sentinel food name we seeded)
      const isTest = (m.items ?? []).some((i) => i.name === "UndoTestFood");
      if (isTest) {
        await fetch(`/api/nutrition/log-meal?id=${m.id}`, { method: "DELETE" });
      }
    }
  }, { date: TEST_DATE });
}

test.describe("Undo toast", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => { localStorage.setItem("me_tour_done", "1"); });
  });

  test.afterEach(async ({ page }) => {
    await cleanupTestMeals(page);
  });

  test("undo toast appears after deleting a meal and restores it", async ({ page }) => {
    await page.goto(`/dashboard?date=${TEST_DATE}`);
    await page.waitForTimeout(1500);
    await seedTestMeal(page, "lunch");
    await page.reload();
    await page.waitForTimeout(2000);

    // Find the Remove button in the Lunch card specifically
    const lunchCard = page.locator("text=Lunch").locator("xpath=ancestor::div[contains(@class, 'rounded-2xl')][1]");
    const removeBtn = lunchCard.getByRole("button", { name: "Remove" }).first();
    await expect(removeBtn).toBeVisible();

    await removeBtn.click();
    await page.waitForTimeout(1000);

    const toast = page.getByRole("status", { name: "Undo action" });
    await expect(toast).toBeVisible();
    await expect(toast.getByText("Meal removed")).toBeVisible();

    await toast.getByRole("button", { name: "Undo" }).click();
    await page.waitForTimeout(2500);
    await expect(toast).not.toBeVisible();
  });

  test("dismiss (×) closes toast without invoking undo", async ({ page }) => {
    await page.goto(`/dashboard?date=${TEST_DATE}`);
    await page.waitForTimeout(1500);
    await seedTestMeal(page, "dinner");
    await page.reload();
    await page.waitForTimeout(2000);

    const dinnerCard = page.locator("text=Dinner").locator("xpath=ancestor::div[contains(@class, 'rounded-2xl')][1]");
    const removeBtn = dinnerCard.getByRole("button", { name: "Remove" }).first();
    await expect(removeBtn).toBeVisible();

    await removeBtn.click();
    const toast = page.getByRole("status", { name: "Undo action" });
    await expect(toast).toBeVisible();

    await toast.getByRole("button", { name: "Dismiss" }).click();
    await expect(toast).not.toBeVisible();
    // The test meal remains deleted — afterEach cleanup handles anything left.
  });
});

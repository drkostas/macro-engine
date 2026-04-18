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
    await page.waitForLoadState("networkidle");
    await seedTestMeal(page, "lunch");
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Find the Remove button in the Lunch card specifically
    const lunchCard = page.locator("text=Lunch").locator("xpath=ancestor::div[contains(@class, 'rounded-2xl')][1]");
    const removeBtn = lunchCard.getByRole("button", { name: "Remove" }).first();
    await expect(removeBtn).toBeVisible();

    // Listen for the delete API call
    const deleteResponse = page.waitForResponse(
      (r) => r.url().includes("/api/nutrition/log-meal") && r.request().method() === "DELETE",
      { timeout: 5000 },
    );
    await removeBtn.click();
    await deleteResponse;

    const toast = page.getByRole("status", { name: "Undo action" });
    await expect(toast).toBeVisible();
    await expect(toast.getByText("Meal removed")).toBeVisible();

    await toast.getByRole("button", { name: "Undo" }).click();
    // Wait for undo API call to complete
    await page.waitForResponse(
      (r) => r.url().includes("/api/nutrition/") && r.request().method() === "POST",
      { timeout: 5000 },
    ).catch(() => {});
    await expect(toast).not.toBeVisible({ timeout: 5000 });
  });

  test("dismiss (x) closes toast without invoking undo", async ({ page }) => {
    await page.goto(`/dashboard?date=${TEST_DATE}`);
    await page.waitForLoadState("networkidle");
    await seedTestMeal(page, "dinner");
    await page.reload();
    await page.waitForLoadState("networkidle");

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

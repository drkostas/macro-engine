import { test, expect } from "@playwright/test";

test.describe("Natural-language meal logging", () => {
  test.beforeEach(async ({ page }) => {
    // Disable the service worker in tests so page.route can intercept /api/ calls.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "serviceWorker", {
        configurable: true,
        get: () => undefined,
      });
    });
    await page.addInitScript(() => { localStorage.setItem("me_tour_done", "1"); });
  });

  test("'Describe a meal' button visible in composer", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Open any empty meal slot. Pre-Sleep is most likely empty.
    const preSleepLog = page.getByRole("button", { name: /Log Pre-Sleep/ }).first();
    if (!(await preSleepLog.isVisible().catch(() => false))) {
      test.skip(true, "No empty slots to test");
      return;
    }
    await preSleepLog.click();
    await expect(page.getByRole("button", { name: /Describe a meal/ })).toBeVisible();
  });

  test("parsed items populate composer when API succeeds", async ({ page }) => {
    let routeFired = false;
    await page.route((url) => url.pathname === "/api/nutrition/parse-nl", async (route) => {
      routeFired = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [
            { name: "Test Chicken", grams: 200, calories: 330, protein: 62, carbs: 0, fat: 7, fiber: 0 },
            { name: "Test Rice", grams: 160, calories: 210, protein: 4, carbs: 46, fat: 0.5, fiber: 0.6 },
          ],
        }),
      });
    });

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Use a future date for a consistently empty slot (no test data)
    const tomorrow = new Date(Date.now() + 2 * 86_400_000).toISOString().split("T")[0];
    await page.goto(`/dashboard?date=${tomorrow}`);
    await page.waitForLoadState("networkidle");

    const logBtn = page.getByRole("button", { name: /Plan Breakfast|Log Breakfast/ }).first();
    if (!(await logBtn.isVisible().catch(() => false))) {
      test.skip(true, "Breakfast slot not empty on test date");
      return;
    }
    await logBtn.click();
    await expect(page.getByRole("button", { name: /Describe a meal/ })).toBeVisible();

    await page.getByRole("button", { name: /Describe a meal/ }).click();
    await page.locator("textarea").first().fill("200g chicken and rice");
    const responsePromise = page.waitForResponse(
      (r) => r.url().includes("/api/nutrition/parse-nl") && r.request().method() === "POST",
      { timeout: 10_000 },
    );
    await page.getByRole("button", { name: "Add to meal" }).click();
    const resp = await responsePromise;
    expect(resp.status()).toBe(200);
    expect(routeFired).toBe(true);

    // "Test Chicken" appears both in the VariationStrip (auto-named variation)
    // and in the ingredient editor list. `.first()` matches whichever renders first.
    await expect(page.getByText("Test Chicken").first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Test Rice").first()).toBeVisible();
  });

  test("shows error message when API returns 503 (gateway missing)", async ({ page }) => {
    await page.route((url) => url.pathname === "/api/nutrition/parse-nl", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "AI Gateway not configured. Set AI_GATEWAY_API_KEY." }),
      });
    });

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const preSleepLog = page.getByRole("button", { name: /Log Pre-Sleep/ }).first();
    if (!(await preSleepLog.isVisible().catch(() => false))) {
      test.skip(true, "No empty slots");
      return;
    }
    await preSleepLog.click();
    await expect(page.getByRole("button", { name: /Describe a meal/ })).toBeVisible();

    await page.getByRole("button", { name: /Describe a meal/ }).click();
    await page.locator("textarea").first().fill("whatever");
    await page.getByRole("button", { name: "Add to meal" }).click();

    await expect(page.getByText(/AI parsing disabled|AI Gateway not configured/)).toBeVisible();
  });
});

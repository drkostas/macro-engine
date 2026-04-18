import { test, expect, request } from "@playwright/test";

// Use an isolated sentinel test date — far from any real logged day.
// Any meal on this date is, by construction, test fallout and safe to delete.
// The date itself is the sentinel: 2020-02-20 predates the project so no real
// meal can exist there.
const TEST_DATE = "2020-02-20";
const SENTINEL_SLOT = "lunch";
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3457";

/**
 * Delete every meal on TEST_DATE. Uses Playwright's APIRequestContext so it
 * works even if the page is unstable (dev overlay open, mid-navigation).
 * Safe because TEST_DATE is sentinel-isolated — no real meal can exist there.
 */
async function cleanupTestMeals() {
  const ctx = await request.newContext({ baseURL: BASE_URL });
  try {
    const planResp = await ctx.get(`/api/nutrition/plan?date=${TEST_DATE}`);
    if (!planResp.ok()) return;
    const data = await planResp.json();
    const all = Object.values(data.mealsBySlot ?? {}).flat() as Array<{
      id: number;
      items?: Array<{ name?: string }> | string;
    }>;
    for (const m of all) {
      // The sentinel check: items on this isolated date are test fallout by construction.
      await ctx.delete(`/api/nutrition/log-meal?id=${m.id}`);
    }
  } finally {
    await ctx.dispose();
  }
}

test.describe("Meal variations", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("me_tour_done", "1");
    });
    // Start with a clean slate — in case a prior failing run left residue.
    await cleanupTestMeals();
  });

  test.afterEach(async () => {
    await cleanupTestMeals();
  });

  test("draft two variations, switch active, log V2 via per-row button", async ({ page }) => {
    await page.goto(`/dashboard?date=${TEST_DATE}`);
    await page.waitForLoadState("networkidle");

    // Dismiss any Next.js dev error overlay that may have auto-opened
    // (pre-existing hydration warnings in dev — not part of this feature).
    await page.keyboard.press("Escape").catch(() => { /* ignore */ });
    await page.waitForTimeout(200);

    // 1) Open the Lunch composer via the slot's "Log Lunch" button.
    const logLunchBtn = page.getByRole("button", { name: /^Log Lunch$/ }).first();
    await expect(logLunchBtn).toBeVisible();
    await logLunchBtn.click();

    // 2) Confirm the VariationStrip rendered with V1.
    await expect(page.getByText(/Variations/i).first()).toBeVisible();
    await expect(page.getByText(/^V1$/).first()).toBeVisible();

    // 3) Click "+ New variation" — V2 should appear.
    const addBtn = page.getByRole("button", { name: /new variation/i });
    await expect(addBtn).toBeVisible();
    await addBtn.click();
    await expect(page.getByText(/^V2$/).first()).toBeVisible();

    // After adding V2, it becomes the active variation automatically
    // (handleAddVariation sets activeId = new variation's id).
    // We still click V2's row to exercise the switch path — clicking an
    // already-active row is a no-op but verifies the selector works.
    // Re-switching from V1 first to test the switch flow:
    // Click V1 → switches back to V1; then click V2 → switches to V2.
    const v1Row = page.getByText(/^V1$/).first();
    await v1Row.click();
    await page.waitForTimeout(200);
    const v2Row = page.getByText(/^V2$/).first();
    await v2Row.click();
    await page.waitForTimeout(200);

    // 4) Add at least one ingredient to V2 by clicking any ingredient
    //    row in the "My Ingredients" picker. Each ingredient renders two
    //    buttons: a star (aria-label "Favorite <name>") and an unlabeled
    //    toggle button whose accessible name is the ingredient name + the
    //    macro summary ("Protein Powder (whey) 375 | 75P"). We match any
    //    button whose name contains the kcal | protein macro pattern, which
    //    is unique to picker rows and excludes strip rows.
    const ingredientBtn = page
      .getByRole("button", { name: /\d+ \| \d+P$/ })
      .first();
    await expect(ingredientBtn).toBeVisible();
    await ingredientBtn.click();
    await page.waitForTimeout(200); // UI state update

    // 5) Click "Compose meal" to move V2 into the compose phase.
    const composeBtn = page.getByRole("button", { name: /compose meal/i });
    await expect(composeBtn).toBeVisible();
    await composeBtn.click();

    // Wait for compose phase to render
    await expect(page.getByRole("button", { name: /^Log V2$/ })).toBeVisible({ timeout: 5000 });

    // Dismiss any dev overlay that may have popped up after state changes.
    await page.keyboard.press("Escape").catch(() => { /* ignore */ });
    await page.waitForTimeout(200);

    // 6) Click the per-row "Log V2" button in the VariationStrip.
    const logV2 = page.getByRole("button", { name: /^Log V2$/ });
    await expect(logV2).toBeVisible();
    await logV2.click();

    // 7) Wait for the POST /log-meal to complete by listening for its response.
    await page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/nutrition/log-meal") &&
        resp.request().method() === "POST" &&
        resp.status() === 201,
      { timeout: 10_000 },
    );

    // Allow the UI to refresh after the API call
    await page.waitForLoadState("networkidle");

    // 8) Verify a meal was logged for lunch on TEST_DATE via the plan endpoint.
    const plan = await page.evaluate(async ({ date }) => {
      const r = await fetch(`/api/nutrition/plan?date=${date}`, { cache: "no-store" });
      return r.json();
    }, { date: TEST_DATE });

    const lunchMeals = plan.mealsBySlot?.[SENTINEL_SLOT] ?? [];
    expect(lunchMeals.length).toBeGreaterThan(0);
    // And the logged meal has real macros (proving it wasn't an empty log).
    const firstMeal = lunchMeals[0];
    expect(Number(firstMeal.calories)).toBeGreaterThan(0);
  });
});

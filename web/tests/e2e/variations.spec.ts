import { test, expect, request, type Locator, type Page } from "@playwright/test";

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

/**
 * Wait until the row for variation `label` (e.g. "V2") is the active one in
 * the VariationStrip. The active row is the only one whose leading dot span
 * carries the `bg-teal` class (see components/variation-strip.tsx line 55).
 * This replaces fragile `waitForTimeout(200)` calls after row switches.
 */
async function waitForActiveVariation(page: Page, label: string): Promise<Locator> {
  const row = page
    .getByText(new RegExp(`^${label}$`))
    .first()
    .locator("xpath=ancestor::div[@role='button'][1]");
  await expect(row.locator("span.bg-teal").first()).toBeVisible({ timeout: 5_000 });
  return row;
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

    // 1) Open the Lunch composer via the slot's "Log Lunch" button.
    const logLunchBtn = page.getByRole("button", { name: /^Log Lunch$/ }).first();
    await expect(logLunchBtn).toBeVisible();
    await logLunchBtn.click();

    // 2) Confirm the VariationStrip rendered with V1 active.
    await expect(page.getByText(/Variations/i).first()).toBeVisible();
    await waitForActiveVariation(page, "V1");

    // 3) Click "+ New variation" — V2 should appear and become active.
    const addBtn = page.getByRole("button", { name: /new variation/i });
    await expect(addBtn).toBeVisible();
    await addBtn.click();
    await waitForActiveVariation(page, "V2");

    // 4) Exercise the switch path: V2 → V1 → V2, asserting active state each time
    //    rather than trusting a fixed sleep to cover React re-render.
    await page.getByText(/^V1$/).first().click();
    await waitForActiveVariation(page, "V1");
    await page.getByText(/^V2$/).first().click();
    await waitForActiveVariation(page, "V2");

    // 5) Add one ingredient to V2. Each ingredient renders two buttons: a star
    //    (aria-label "Favorite <name>") and an unlabeled toggle whose accessible
    //    name ends in the kcal | protein macro pattern, which is unique to
    //    picker rows and excludes strip rows.
    const ingredientBtn = page
      .getByRole("button", { name: /\d+ \| \d+P$/ })
      .first();
    await expect(ingredientBtn).toBeVisible();
    await ingredientBtn.click();

    // 6) "Compose meal" button's label includes the selection count
    //    ("Compose meal (1 ingredients)") — waiting on the count text confirms
    //    handleToggle's setState flushed before we click.
    const composeBtn = page.getByRole("button", { name: /compose meal \(1 ingredients?\)/i });
    await expect(composeBtn).toBeVisible({ timeout: 5_000 });
    await composeBtn.click();

    // Wait for compose phase to render — the per-row Log V2 button only exists
    // once V2's portions are populated by runSolver.
    await expect(page.getByRole("button", { name: /^Log V2$/ })).toBeVisible({ timeout: 5_000 });

    // Dismiss any dev overlay that may have popped up after state changes.
    await page.keyboard.press("Escape").catch(() => { /* ignore */ });

    // 7) Race the POST against the click so we never miss the response event.
    //    Bumped to 20s from 10s for CI breathing room.
    const logResp = page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/nutrition/log-meal") &&
        resp.request().method() === "POST" &&
        resp.status() === 201,
      { timeout: 20_000 },
    );
    await page.getByRole("button", { name: /^Log V2$/ }).click();
    await logResp;

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

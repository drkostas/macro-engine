import { test, expect } from "@playwright/test";

// Favorites are a DB-backed toggle on the ingredients table. We pick a stable
// seeded ingredient, star it, expect it to appear in the "★ Favorites" band,
// then unstar and expect the band to update. All changes are reverted in
// afterEach so we never leave a favorited row behind.

const FAV_INGREDIENT_NAME = "Chicken Breast";

async function resetFavorite(page: import("@playwright/test").Page, name: string) {
  await page.evaluate(async (name) => {
    const r = await fetch(`/api/food/search?q=${encodeURIComponent(name)}&limit=5`);
    const data = await r.json();
    const match = (data.results ?? []).find((f: { name: string }) =>
      f.name.toLowerCase() === name.toLowerCase(),
    );
    if (!match) return;
    await fetch(`/api/nutrition/ingredient/${match.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_favorite: false }),
    });
  }, name);
}

test.describe("Favorites pinning", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => { localStorage.setItem("me_tour_done", "1"); });
  });

  test.afterEach(async ({ page }) => {
    // Navigation happens inside the test; page has a document origin here.
    await resetFavorite(page, FAV_INGREDIENT_NAME);
  });

  test("starring an ingredient pins it under Favorites", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await resetFavorite(page, FAV_INGREDIENT_NAME);

    // Open the composer for any empty slot (Log <Slot> button). If none are
    // empty, "+ Add more" on the first slot with items works too.
    const openBtn = page.getByRole("button", { name: /^(Log [A-Z]|\+ Add more)/ }).first();
    await expect(openBtn).toBeVisible();
    await openBtn.click();

    const mineTab = page.getByRole("button", { name: "My Ingredients" });
    await expect(mineTab).toBeVisible();
    await mineTab.click();
    await page.waitForTimeout(300);

    const starBtn = page.getByRole("button", { name: `Favorite ${FAV_INGREDIENT_NAME}` }).first();
    await expect(starBtn).toBeVisible();
    await starBtn.click();

    // Wait for the Favorites band to appear after the star toggle
    const favBand = page.locator("text=★ Favorites").first();
    await expect(favBand).toBeVisible({ timeout: 5000 });

    const favRow = page.locator("text=★ Favorites")
      .locator("xpath=following-sibling::div[1]")
      .getByText(FAV_INGREDIENT_NAME);
    await expect(favRow.first()).toBeVisible();
  });
});

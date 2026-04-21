import { test, expect, request } from "@playwright/test";

// Favorites are a DB-backed toggle on the ingredients table. We pick a stable
// seeded ingredient by its exact name + id, unstar it to establish a known
// baseline, then star it and assert the "★ Favorites" band appears.
//
// The seed (web/db/seed.sql) contains exactly one pre-favorited ingredient:
//   id=chicken_breast_raw, name="Chicken Breast (raw)"
// So we use that as the fixture and normalize to `is_favorite=false` before
// the test body so the starring action is always a false→true transition.

const FAV_INGREDIENT_NAME = "Chicken Breast (raw)";
const FAV_INGREDIENT_ID = "chicken_breast_raw";
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3457";

async function setFavorite(isFavorite: boolean) {
  const ctx = await request.newContext({ baseURL: BASE_URL });
  try {
    await ctx.patch(`/api/nutrition/ingredient/${FAV_INGREDIENT_ID}`, {
      headers: { "Content-Type": "application/json" },
      data: { is_favorite: isFavorite },
    });
  } finally {
    await ctx.dispose();
  }
}

test.describe("Favorites pinning", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => { localStorage.setItem("me_tour_done", "1"); });
    // Normalize: the seed ships this ingredient pre-favorited, so explicitly
    // unstar before the test body. This makes the starring action under test
    // an unambiguous false→true transition regardless of prior test fallout.
    await setFavorite(false);
  });

  test.afterEach(async () => {
    await setFavorite(false);
  });

  test("starring an ingredient pins it under Favorites", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Open the composer for any empty slot.
    const openBtn = page.getByRole("button", { name: /^(Log [A-Z]|\+ Add more)/ }).first();
    await expect(openBtn).toBeVisible();
    await openBtn.click();

    const mineTab = page.getByRole("button", { name: "My Ingredients" });
    await expect(mineTab).toBeVisible();
    await mineTab.click();

    // Locate the star button with `exact: true` so we don't match the
    // "Unfavorite …" label by substring if the ingredient happens to already
    // be favorited from prior test fallout.
    const starBtn = page.getByRole("button", {
      name: `Favorite ${FAV_INGREDIENT_NAME}`,
      exact: true,
    });
    await expect(starBtn).toBeVisible({ timeout: 10_000 });

    // Race the PATCH response against the click. The id is a string slug
    // (`chicken_breast_raw`), not a number — match anything after the segment.
    const patchPromise = page.waitForResponse(
      (resp) =>
        resp.url().includes(`/api/nutrition/ingredient/${FAV_INGREDIENT_ID}`) &&
        resp.request().method() === "PATCH" &&
        resp.ok(),
      { timeout: 15_000 },
    );
    await starBtn.click();
    await patchPromise;

    // Component flips aria-label optimistically — waiting on this confirms
    // favOverrides propagated before asserting on the Favorites band.
    await expect(
      page.getByRole("button", {
        name: `Unfavorite ${FAV_INGREDIENT_NAME}`,
        exact: true,
      }),
    ).toBeVisible({ timeout: 10_000 });

    const favBand = page.locator("text=★ Favorites").first();
    await expect(favBand).toBeVisible({ timeout: 15_000 });

    const favRow = page.locator("text=★ Favorites")
      .locator("xpath=following-sibling::div[1]")
      .getByText(FAV_INGREDIENT_NAME);
    await expect(favRow.first()).toBeVisible();
  });
});

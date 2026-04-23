import { test, expect } from "@playwright/test";

/**
 * M10-era settings page — the new "Injury & Race" section consolidates
 * Injury / Taper / Climate config in one place.
 */

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3457";

test.describe("/settings Injury & Race section", () => {
  test.beforeEach(async ({ page, request }) => {
    // Reset state so the section renders the empty-state cards.
    const injRes = await request.get(`${BASE_URL}/api/nutrition/injury`);
    const injBody = await injRes.json();
    if (injBody.injury) {
      await request.patch(`${BASE_URL}/api/nutrition/injury`, {
        data: { id: injBody.injury.id },
      });
    }
    await request.post(`${BASE_URL}/api/nutrition/taper`, { data: { race_date: null } });
    await request.post(`${BASE_URL}/api/nutrition/climate`, { data: { env: "normal" } });
    // Dismiss onboarding tour.
    await page.addInitScript(() => {
      try { localStorage.setItem("me_tour_done", "1"); } catch { /* ignore */ }
    });
  });

  test("Injury & Race tab renders all three cards", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /Injury & Race/i }).click();
    await expect(page.getByTestId("nutrition-context-section")).toBeVisible();

    // All three cards mount.
    await expect(page.getByTestId("injury-card")).toBeVisible();
    await expect(page.getByTestId("taper-card")).toBeVisible();
    await expect(page.getByTestId("climate-card")).toBeVisible();
  });

  test("POST injury via API → refreshing the section shows active state",
    async ({ page, request }) => {
      const today = new Date().toISOString().split("T")[0];
      await request.post(`${BASE_URL}/api/nutrition/injury`, {
        data: { injury_date: today, type: "acl" },
      });

      await page.goto("/settings");
      await page.waitForLoadState("networkidle");
      await page.getByRole("button", { name: /Injury & Race/i }).click();

      // InjuryCard in its active state shows the type pill.
      await expect(page.getByRole("button", { name: /Mark recovered/i })).toBeVisible();
    },
  );
});

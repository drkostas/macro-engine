import { test, expect, type APIRequestContext } from "@playwright/test";

/**
 * M10-era dashboard integration — StatusRow + expand flow + TrackingTabs.
 * Runs against the real dev server + seeded test DB.
 */

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3457";

async function clearInjury(req: APIRequestContext) {
  // Mark any active injury as recovered so the DB starts clean.
  const res = await req.get(`${BASE_URL}/api/nutrition/injury`);
  const body = await res.json();
  if (body.injury) {
    await req.patch(`${BASE_URL}/api/nutrition/injury`, {
      data: { id: body.injury.id },
    });
  }
}

async function clearRace(req: APIRequestContext) {
  await req.post(`${BASE_URL}/api/nutrition/taper`, {
    data: { race_date: null },
  });
}

async function clearClimate(req: APIRequestContext) {
  await req.post(`${BASE_URL}/api/nutrition/climate`, {
    data: { env: "normal" },
  });
}

test.describe("Dashboard integration", () => {
  test.beforeEach(async ({ page, request }) => {
    await clearInjury(request);
    await clearRace(request);
    await clearClimate(request);
    // Dismiss the onboarding tour dialog — it overlays the dashboard with
    // a full-viewport backdrop that intercepts pointer events.
    await page.addInitScript(() => {
      try { localStorage.setItem("me_tour_done", "1"); } catch { /* ignore */ }
    });
  });

  test("StatusRow hidden when all statuses inactive", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    // Zero pills should render
    await expect(page.getByTestId("status-pill-injury")).toHaveCount(0);
    await expect(page.getByTestId("status-pill-taper")).toHaveCount(0);
    await expect(page.getByTestId("status-pill-climate")).toHaveCount(0);
  });

  test("POST injury → pill appears → click expands → mark recovered → pill disappears",
    async ({ page, request }) => {
      // Seed an active injury via the API.
      const today = new Date().toISOString().split("T")[0];
      await request.post(`${BASE_URL}/api/nutrition/injury`, {
        data: {
          injury_date: today,
          type: "acl",
          rehab_kcal: 300,
          pre_injury_protein_g_per_kg: 2.0,
        },
      });

      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      // Pill renders
      const pill = page.getByTestId("status-pill-injury");
      await expect(pill).toBeVisible();
      await expect(pill).toHaveAttribute("data-expanded", "false");

      // Click → expand. Full InjuryCard mounts below.
      await pill.click();
      await expect(pill).toHaveAttribute("data-expanded", "true");
      await expect(page.getByTestId("injury-card")).toBeVisible();

      // Mark recovered from the expanded card.
      await page.getByRole("button", { name: /Mark recovered/i }).click();

      // After fetchPlan refresh the pill goes away.
      await expect(page.getByTestId("status-pill-injury")).toHaveCount(0, {
        timeout: 5000,
      });
    },
  );

  test("TrackingTabs: Week default, Progress + Year switch content",
    async ({ page }) => {
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      // Week body renders the weekly wrap-up card by default.
      await expect(page.getByTestId("weekly-wrapup-card")).toBeVisible();
      await expect(page.getByTestId("progression-card")).toHaveCount(0);

      // Switch to Progress — weekly hides, progression appears.
      await page.getByRole("button", { name: /^Progress$/ }).click();
      await expect(page.getByTestId("progression-card")).toBeVisible();
      await expect(page.getByTestId("weekly-wrapup-card")).toHaveCount(0);

      // Switch to Year — progression hides, year review appears.
      await page.getByRole("button", { name: /^Year$/ }).click();
      await expect(page.getByTestId("year-review-card")).toBeVisible();
      await expect(page.getByTestId("progression-card")).toHaveCount(0);

      // Back to Week.
      await page.getByRole("button", { name: /^Week$/ }).click();
      await expect(page.getByTestId("weekly-wrapup-card")).toBeVisible();
      await expect(page.getByTestId("year-review-card")).toHaveCount(0);
    },
  );

  test("⚙ setup menu offers Altitude/Heat/Cold climate options when climate is normal",
    async ({ page, request }) => {
      // Seed an injury so the StatusRow renders (it's hidden when all statuses empty).
      const today = new Date().toISOString().split("T")[0];
      await request.post(`${BASE_URL}/api/nutrition/injury`, {
        data: { injury_date: today, type: "acl" },
      });

      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      const setupBtn = page.getByTestId("status-setup-button");
      await expect(setupBtn).toBeVisible();
      await setupBtn.click();

      // Popover exposes climate options because climate is normal.
      await expect(page.getByRole("button", { name: /^Altitude$/ })).toBeVisible();
      await expect(page.getByRole("button", { name: /^Heat$/ })).toBeVisible();
      await expect(page.getByRole("button", { name: /^Cold$/ })).toBeVisible();

      // Pick Altitude → climate pill appears after refresh.
      await page.getByRole("button", { name: /^Altitude$/ }).click();
      await expect(page.getByTestId("status-pill-climate")).toBeVisible({
        timeout: 5000,
      });
    },
  );
});

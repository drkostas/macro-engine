import { test, expect } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3457";

async function clearProfile() {
  const resp = await fetch(`${BASE}/api/test/clear-profile`, { method: "POST" });
  if (!resp.ok) throw new Error(`clear-profile failed: ${resp.status}`);
}

async function restoreProfile() {
  const resp = await fetch(`${BASE}/api/nutrition/onboard`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      weight_kg: 80,
      height_cm: 177,
      age: 30,
      sex: "male",
      goal: "lose",
      tdee_estimate: 2400,
      daily_deficit: 500,
      estimated_bf_pct: 18,
      target_bf_pct: 15,
      estimated_ffm_kg: 65.6,
      protein_g_per_kg: 2.2,
      fat_g_per_kg: 0.8,
      step_goal: 10000,
    }),
  });
  if (!resp.ok) throw new Error(`restore profile failed: ${resp.status}`);
}

test.describe("First-run onboarding gate", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => { localStorage.setItem("me_tour_done", "1"); });
  });

  test.afterEach(async () => {
    // Always restore profile so other tests aren't affected
    await restoreProfile();
  });

  test("redirects /dashboard to /onboard when no profile exists", async ({ page }) => {
    await clearProfile();
    await page.goto("/dashboard");
    await page.waitForURL("**/onboard**");
    expect(page.url()).toContain("/onboard");
  });

  test("onboard form creates profile and redirects to dashboard", async ({ page }) => {
    await clearProfile();
    await page.goto("/onboard");
    await expect(page.getByText("Set Up Your Profile")).toBeVisible();

    // Fields have defaults, just click submit
    await page.getByRole("button", { name: "Calculate My Targets" }).click();

    // Should redirect to dashboard and show "Today"
    await page.waitForURL("**/dashboard**", { timeout: 15000 });
    await expect(page.getByText("Today", { exact: true })).toBeVisible({ timeout: 10000 });
  });
});

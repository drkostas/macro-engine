import { test, expect } from "@playwright/test";

test.describe("Onboarding tour", () => {
  test("shows on first visit and walks through all 6 steps", async ({ page }) => {
    await page.addInitScript(() => { localStorage.removeItem("me_tour_done"); });
    await page.goto("/dashboard");
    // Tour auto-opens after 500ms
    await expect(page.getByRole("dialog", { name: "Onboarding tour" })).toBeVisible({ timeout: 3000 });
    await expect(page.getByText("Step 1 of 6")).toBeVisible();

    for (let i = 2; i <= 6; i++) {
      await page.getByRole("button", { name: "Next →" }).click();
      await expect(page.getByText(`Step ${i} of 6`)).toBeVisible();
    }

    await page.getByRole("button", { name: "Finish" }).click();
    await expect(page.getByRole("dialog", { name: "Onboarding tour" })).not.toBeVisible();

    const flag = await page.evaluate(() => localStorage.getItem("me_tour_done"));
    expect(flag).toBe("1");
  });

  test("does not show on subsequent visits", async ({ page }) => {
    await page.addInitScript(() => { localStorage.setItem("me_tour_done", "1"); });
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("dialog", { name: "Onboarding tour" })).not.toBeVisible();
  });

  test("Skip button closes tour immediately and sets flag", async ({ page }) => {
    await page.addInitScript(() => { localStorage.removeItem("me_tour_done"); });
    await page.goto("/dashboard");
    const dialog = page.getByRole("dialog", { name: "Onboarding tour" });
    await expect(dialog).toBeVisible({ timeout: 3000 });
    await dialog.getByRole("button", { name: "Skip" }).click();
    await expect(dialog).not.toBeVisible();
    const flag = await page.evaluate(() => localStorage.getItem("me_tour_done"));
    expect(flag).toBe("1");
  });
});

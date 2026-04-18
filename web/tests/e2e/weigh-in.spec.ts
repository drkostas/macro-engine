import { test, expect } from "@playwright/test";

test.describe("Weigh-in widget", () => {
  test.beforeEach(async ({ page }) => {
    // Skip the tour for this suite
    await page.addInitScript(() => { localStorage.setItem("me_tour_done", "1"); });
  });

  test("shows current weight as an edit button", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("button", { name: "Update weight" })).toBeVisible();
  });

  test("opens inline editor and saves a new weight", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Capture the current weight from the button
    const editBtn = page.getByRole("button", { name: "Update weight" });
    const beforeText = (await editBtn.textContent()) ?? "";

    await editBtn.click();
    const input = page.locator('input[type="number"]').first();
    await expect(input).toBeVisible();

    // Pick a value that is guaranteed different from before
    const currentKg = parseFloat(beforeText);
    const newWeight = Number.isFinite(currentKg) && currentKg !== 74.2 ? 74.2 : 73.7;
    await input.fill(String(newWeight));

    // Intercept the API call to confirm it fired with the right payload
    const savePromise = page.waitForResponse(
      (r) => r.url().endsWith("/api/nutrition/weigh-in") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Save" }).click();
    const resp = await savePromise;
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.ok).toBe(true);
    expect(body.weight_kg).toBe(newWeight);

    // Widget collapses
    await expect(input).not.toBeVisible({ timeout: 5000 });
    await expect(editBtn).toBeVisible();

    // Eventually the button text should update to the new weight (after fetchPlan refresh)
    await expect(editBtn).toContainText(newWeight.toFixed(1), { timeout: 10_000 });
  });

  test("Cancel aborts without saving", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const editBtn = page.getByRole("button", { name: "Update weight" });
    const beforeText = await editBtn.textContent();

    await editBtn.click();
    const input = page.locator('input[type="number"]').first();
    await input.fill("99.9");
    await page.getByRole("button", { name: "Cancel" }).click();

    await expect(input).not.toBeVisible();
    // Button text should be unchanged
    expect(await editBtn.textContent()).toBe(beforeText);
  });
});

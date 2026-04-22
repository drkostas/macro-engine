import { test, expect } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3457";

test.describe("/api/nutrition/climate", () => {
  test.beforeEach(async ({ request: req }) => {
    // Reset to normal.
    await req.post(`${BASE_URL}/api/nutrition/climate`, {
      data: { env: "normal" },
    });
  });

  test("GET normal returns zero adjustments", async ({ request: req }) => {
    const res = await req.get(`${BASE_URL}/api/nutrition/climate`);
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.climate.env).toBe("normal");
    expect(body.climate.adjustment.extraFluidMl).toBe(0);
  });

  test("POST altitude surfaces iron + fluid + carb bumps", async ({ request: req }) => {
    const post = await req.post(`${BASE_URL}/api/nutrition/climate`, {
      data: { env: "altitude" },
    });
    expect(post.ok()).toBe(true);
    const get = await req.get(`${BASE_URL}/api/nutrition/climate`);
    const body = await get.json();
    expect(body.climate.env).toBe("altitude");
    expect(body.climate.adjustment.ironTargetMg).toBeGreaterThanOrEqual(10);
    expect(body.climate.adjustment.extraFluidMl).toBe(500);
    expect(body.climate.adjustment.extraCarbG).toBeGreaterThan(0);
  });

  test("POST heat with sweat opts persists and computes sodium", async ({ request: req }) => {
    const post = await req.post(`${BASE_URL}/api/nutrition/climate`, {
      data: { env: "heat", sweat_l_per_hour: 1.5, hours: 2 },
    });
    expect(post.ok()).toBe(true);
    const body = await post.json();
    expect(body.climate.adjustment.extraFluidMl).toBe(3000);
    expect(body.climate.adjustment.extraSodiumMg).toBe(2250);
  });

  test("POST unknown env → 400", async ({ request: req }) => {
    const res = await req.post(`${BASE_URL}/api/nutrition/climate`, {
      data: { env: "tropic" },
    });
    expect(res.status()).toBe(400);
  });
});

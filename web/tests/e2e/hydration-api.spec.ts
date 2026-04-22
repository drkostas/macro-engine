import { test, expect } from "@playwright/test";

// Smoke test for /api/nutrition/hydration against the real test-seeded DB.
// The seed ships one baseline 500ml water drink today.

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3457";

test.describe("/api/nutrition/hydration", () => {
  test("GET returns targets + logs + totals", async ({ request: req }) => {
    const res = await req.get(`${BASE_URL}/api/nutrition/hydration`);
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.targets.waterBeverageMl).toBeGreaterThan(0);
    expect(body.targets.sodiumMg).toBeGreaterThan(0);
    expect(Array.isArray(body.logs)).toBe(true);
    expect(body.effectiveMl).toBeGreaterThanOrEqual(0);
  });

  test("POST a drink → GET reflects it", async ({ request: req }) => {
    const post = await req.post(`${BASE_URL}/api/nutrition/hydration`, {
      data: { volume_ml: 250 },
    });
    expect(post.status()).toBe(201);
    const postBody = await post.json();
    expect(postBody.effective_ml).toBe(250);

    const get = await req.get(`${BASE_URL}/api/nutrition/hydration`);
    const body = await get.json();
    expect(body.logs.length).toBeGreaterThan(0);
  });

  test("POST with alcohol applies penalty", async ({ request: req }) => {
    const res = await req.post(`${BASE_URL}/api/nutrition/hydration`, {
      data: { volume_ml: 500, ethanol_g: 20 },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.effective_ml).toBe(300);
  });

  test("POST with non-positive volume returns 400", async ({ request: req }) => {
    const res = await req.post(`${BASE_URL}/api/nutrition/hydration`, {
      data: { volume_ml: 0 },
    });
    expect(res.status()).toBe(400);
  });
});

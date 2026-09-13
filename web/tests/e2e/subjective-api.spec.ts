import { test, expect } from "@playwright/test";

// Smoke test for /api/nutrition/subjective against the real test-seeded DB.
// The CI seed ships a baseline Hooper row at CURRENT_DATE - 1 day.

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3457";

test.describe("/api/nutrition/subjective", () => {
  test("GET returns today/recent/alert shape", async ({ request: req }) => {
    const res = await req.get(`${BASE_URL}/api/nutrition/subjective`);
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect("today" in body).toBe(true);
    expect(Array.isArray(body.recent)).toBe(true);
    expect(body.alert.alertLevel).toMatch(/^(normal|elevated|high)$/);
  });

  test("POST morning_hooper → GET today reflects it", async ({ request: req }) => {
    const post = await req.post(`${BASE_URL}/api/nutrition/subjective`, {
      data: { morning_hooper: { fatigue: 3, sleep: 3, stress: 2, soreness: 3 } },
    });
    expect(post.status()).toBe(201);

    const get = await req.get(`${BASE_URL}/api/nutrition/subjective`);
    const body = await get.json();
    expect(body.today).not.toBeNull();
    expect(body.today.morning_hooper.fatigue).toBe(3);
  });

  test("POST rejects empty body", async ({ request: req }) => {
    const res = await req.post(`${BASE_URL}/api/nutrition/subjective`, {
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  test("POST rejects hooper outside 1-7", async ({ request: req }) => {
    const res = await req.post(`${BASE_URL}/api/nutrition/subjective`, {
      data: { morning_hooper: { fatigue: 0, sleep: 3, stress: 2, soreness: 3 } },
    });
    expect(res.status()).toBe(400);
  });
});

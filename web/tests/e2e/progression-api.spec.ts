import { test, expect } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3457";

test.describe("/api/nutrition/progression", () => {
  test("GET defaults to 30-day window", async ({ request: req }) => {
    const res = await req.get(`${BASE_URL}/api/nutrition/progression`);
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.progression.windowDays).toBe(30);
  });

  test("GET accepts 60 and 90", async ({ request: req }) => {
    for (const w of [60, 90]) {
      const res = await req.get(`${BASE_URL}/api/nutrition/progression?window=${w}`);
      expect(res.ok()).toBe(true);
      const body = await res.json();
      expect(body.progression.windowDays).toBe(w);
    }
  });

  test("GET with invalid window → 400", async ({ request: req }) => {
    const res = await req.get(`${BASE_URL}/api/nutrition/progression?window=45`);
    expect(res.status()).toBe(400);
  });
});

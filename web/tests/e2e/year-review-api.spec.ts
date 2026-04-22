import { test, expect } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3457";

test.describe("/api/nutrition/year-review", () => {
  test("GET defaults to current year", async ({ request: req }) => {
    const res = await req.get(`${BASE_URL}/api/nutrition/year-review`);
    expect(res.ok()).toBe(true);
    const body = await res.json();
    const currentYear = new Date().getUTCFullYear();
    expect(body.review.year).toBe(currentYear);
    expect(body.review.months).toHaveLength(12);
  });

  test("GET with ?year=2026", async ({ request: req }) => {
    const res = await req.get(`${BASE_URL}/api/nutrition/year-review?year=2026`);
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.review.year).toBe(2026);
  });

  test("GET with malformed ?year → 400", async ({ request: req }) => {
    const res = await req.get(`${BASE_URL}/api/nutrition/year-review?year=abc`);
    expect(res.status()).toBe(400);
  });

  test("GET with out-of-range ?year → 400", async ({ request: req }) => {
    const res = await req.get(`${BASE_URL}/api/nutrition/year-review?year=10001`);
    expect(res.status()).toBe(400);
  });
});

import { test, expect } from "@playwright/test";

// Smoke test for /api/nutrition/ffm-anchor against the real test-seeded DB.
// The CI seed ships a baseline NHANES anchor 30 days old; we layer a Navy tape
// anchor on top and assert the most-recent-wins contract end-to-end.

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3457";

test.describe("/api/nutrition/ffm-anchor", () => {
  test("GET returns the seeded baseline anchor with sigma 3.0", async ({ request: req }) => {
    const res = await req.get(`${BASE_URL}/api/nutrition/ffm-anchor`);
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.current).toBeDefined();
    // The seed ships NHANES at -30 days (sigma 3.0).
    expect(body.current.method).toBe("nhanes");
    expect(body.current.sigma_kg).toBe(3.0);
    // Fresh (≤12wk) → effective sigma equals base.
    expect(body.current.effective_sigma_kg).toBe(3.0);
  });

  test("POST a newer Navy tape anchor → GET current reflects it", async ({ request: req }) => {
    const today = new Date().toISOString().split("T")[0];
    const post = await req.post(`${BASE_URL}/api/nutrition/ffm-anchor`, {
      data: { date: today, method: "navy", ffm_kg: 56.5 },
    });
    expect(post.status()).toBe(201);
    const postBody = await post.json();
    expect(postBody.anchor.sigma_kg).toBe(2.2);

    const get = await req.get(`${BASE_URL}/api/nutrition/ffm-anchor`);
    const body = await get.json();
    expect(body.current.method).toBe("navy");
    expect(body.current.ffm_kg).toBe(56.5);
  });

  test("POST with unknown method returns 400", async ({ request: req }) => {
    const res = await req.post(`${BASE_URL}/api/nutrition/ffm-anchor`, {
      data: { date: "2026-04-22", method: "bogus", ffm_kg: 56.5 },
    });
    expect(res.status()).toBe(400);
  });

  test("POST with non-positive ffm_kg returns 400", async ({ request: req }) => {
    const res = await req.post(`${BASE_URL}/api/nutrition/ffm-anchor`, {
      data: { date: "2026-04-22", method: "navy", ffm_kg: -1 },
    });
    expect(res.status()).toBe(400);
  });
});

import { test, expect } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3457";

test.describe("/api/nutrition/taper", () => {
  test.beforeEach(async ({ request: req }) => {
    // Reset: clear race_date
    await req.post(`${BASE_URL}/api/nutrition/taper`, {
      data: { race_date: null },
    });
  });

  test("GET with no race_date → { taper: null }", async ({ request: req }) => {
    const res = await req.get(`${BASE_URL}/api/nutrition/taper`);
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.taper).toBeNull();
  });

  test("POST future race → GET reflects with phase + targets", async ({ request: req }) => {
    const race = new Date();
    race.setUTCDate(race.getUTCDate() + 5);
    const raceIso = race.toISOString().split("T")[0];
    const post = await req.post(`${BASE_URL}/api/nutrition/taper`, {
      data: { race_date: raceIso },
    });
    expect(post.ok()).toBe(true);
    const get = await req.get(`${BASE_URL}/api/nutrition/taper`);
    const body = await get.json();
    expect(body.taper).not.toBeNull();
    expect(body.taper.raceDate).toBe(raceIso);
    // 5 days out → intensity_taper, carbs = 7 g/kg
    expect(body.taper.phase).toBe("intensity_taper");
    expect(body.taper.carbGPerKg).toBe(7);
  });

  test("POST null clears race_date", async ({ request: req }) => {
    await req.post(`${BASE_URL}/api/nutrition/taper`, {
      data: { race_date: "2026-06-01" },
    });
    await req.post(`${BASE_URL}/api/nutrition/taper`, {
      data: { race_date: null },
    });
    const get = await req.get(`${BASE_URL}/api/nutrition/taper`);
    const body = await get.json();
    expect(body.taper).toBeNull();
  });

  test("POST with malformed date → 400", async ({ request: req }) => {
    const res = await req.post(`${BASE_URL}/api/nutrition/taper`, {
      data: { race_date: "05/01/2026" },
    });
    expect(res.status()).toBe(400);
  });
});

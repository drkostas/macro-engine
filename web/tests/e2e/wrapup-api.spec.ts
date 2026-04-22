import { test, expect } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3457";

test.describe("/api/nutrition/wrapup", () => {
  test("GET returns wrapup shape", async ({ request: req }) => {
    const res = await req.get(`${BASE_URL}/api/nutrition/wrapup`);
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.wrapup).toBeDefined();
    expect(body.wrapup.adherencePct).toBeTypeOf("number");
    expect(body.wrapup.grade).toMatch(/^[ABCDF]$/);
    expect(body.takeaway).toBeTypeOf("string");
  });

  test("GET with ?end accepts ISO date", async ({ request: req }) => {
    const res = await req.get(`${BASE_URL}/api/nutrition/wrapup?end=2026-04-14`);
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.wrapup.weekEnd).toBe("2026-04-14");
  });

  test("GET with bad ?end falls back to today", async ({ request: req }) => {
    const res = await req.get(`${BASE_URL}/api/nutrition/wrapup?end=not-a-date`);
    expect(res.ok()).toBe(true);
  });
});

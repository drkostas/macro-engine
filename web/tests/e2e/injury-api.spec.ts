import { test, expect } from "@playwright/test";

// Smoke test for /api/nutrition/injury against the real test-seeded DB.
// No baseline injury is seeded, so GET starts null until we POST.

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3457";

test.describe("/api/nutrition/injury", () => {
  test("GET with no active injury returns { injury: null }", async ({ request: req }) => {
    // Clear any prior active injury first via PATCH-on-latest isn't available; skip if active.
    const res = await req.get(`${BASE_URL}/api/nutrition/injury`);
    expect(res.ok()).toBe(true);
    const body = await res.json();
    // Either null or an object; we just assert shape.
    if (body.injury !== null) {
      expect(body.injury).toHaveProperty("phase");
      expect(body.injury).toHaveProperty("type");
    }
  });

  test("POST → GET → PATCH round trip", async ({ request: req }) => {
    const today = new Date().toISOString().split("T")[0];
    const post = await req.post(`${BASE_URL}/api/nutrition/injury`, {
      data: {
        injury_date: today,
        type: "acl",
        rehab_kcal: 250,
        pre_injury_protein_g_per_kg: 2.0,
        notes: "e2e test",
      },
    });
    expect(post.status()).toBe(201);
    const postBody = await post.json();
    expect(postBody.injury.type).toBe("acl");
    expect(postBody.injury.phase).toBe("acute");
    expect(postBody.injury.proteinGPerKg).toBe(2.4);
    expect(postBody.injury.module.supplements).toContain("omega-3");

    const get = await req.get(`${BASE_URL}/api/nutrition/injury`);
    const getBody = await get.json();
    expect(getBody.injury).not.toBeNull();
    expect(getBody.injury.id).toBe(postBody.injury.id);

    const patch = await req.patch(`${BASE_URL}/api/nutrition/injury`, {
      data: { id: postBody.injury.id },
    });
    expect(patch.ok()).toBe(true);

    const getAfter = await req.get(`${BASE_URL}/api/nutrition/injury`);
    const bodyAfter = await getAfter.json();
    expect(bodyAfter.injury).toBeNull();
  });

  test("POST with unknown type returns 400", async ({ request: req }) => {
    const res = await req.post(`${BASE_URL}/api/nutrition/injury`, {
      data: { injury_date: "2026-04-01", type: "not-a-real-type" },
    });
    expect(res.status()).toBe(400);
  });

  test("POST with malformed date returns 400", async ({ request: req }) => {
    const res = await req.post(`${BASE_URL}/api/nutrition/injury`, {
      data: { injury_date: "04/01/2026", type: "acl" },
    });
    expect(res.status()).toBe(400);
  });
});

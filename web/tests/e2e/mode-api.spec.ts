import { test, expect, request } from "@playwright/test";

// Smoke test for /api/nutrition/mode against the real (test-seeded) database.
// The CI seed puts the profile in `standard` mode at BF 15% (tier T3).

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3457";

test.describe("/api/nutrition/mode", () => {
  test.beforeEach(async () => {
    // Reset to standard between tests so order doesn't matter.
    const ctx = await request.newContext({ baseURL: BASE_URL });
    try {
      await ctx.post("/api/nutrition/mode", { data: { mode: "standard" } });
    } finally {
      await ctx.dispose();
    }
  });

  test("GET returns current mode, config, and per-mode transitions", async ({ request: req }) => {
    const res = await req.get(`${BASE_URL}/api/nutrition/mode`);
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.current).toBe("standard");
    expect(body.config.tierAllowed).toContain("T3"); // seed is T3
    // At T3, Aggressive is tier-blocked — availability gate flags it.
    expect(body.availableTransitions.aggressive.allowed).toBe(false);
    expect(body.availableTransitions.aggressive.reason).toBe("mode_not_available");
    // Maintenance is always allowed.
    expect(body.availableTransitions.maintenance.allowed).toBe(true);
    // Bulk requires reverse bridge from a cut mode.
    expect(body.availableTransitions.bulk.allowed).toBe(false);
    expect(body.availableTransitions.bulk.reason).toBe("requires_reverse_bridge");
    expect(body.availableTransitions.bulk.requiresBridge).toBe("reverse");
  });

  test("POST blocks disallowed transition with 409 + typed reason", async ({ request: req }) => {
    const res = await req.post(`${BASE_URL}/api/nutrition/mode`, {
      data: { mode: "aggressive" },
    });
    expect(res.status()).toBe(409);
    const body = await res.json();
    expect(body.reason).toBe("mode_not_available");
  });

  test("POST accepts legal transition and updates current mode", async ({ request: req }) => {
    const res = await req.post(`${BASE_URL}/api/nutrition/mode`, {
      data: { mode: "maintenance" },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.current).toBe("maintenance");

    const after = await req.get(`${BASE_URL}/api/nutrition/mode`);
    const afterBody = await after.json();
    expect(afterBody.current).toBe("maintenance");
  });

  test("POST with unknown mode returns 400", async ({ request: req }) => {
    const res = await req.post(`${BASE_URL}/api/nutrition/mode`, {
      data: { mode: "nope" },
    });
    expect(res.status()).toBe(400);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// #270: in production the route answered 500 "getaddrinfo ENOTFOUND pg.gkos.dev" because it opened
// SOMA_DATABASE_URL with postgres.js. Over the gateway it must read soma and answer 200.
const writes: string[] = [];
vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  return {
    ...real,
    getDb: () => (strings: TemplateStringsArray) => {
      writes.push(strings.join("?"));
      return Promise.resolve([]);
    },
  };
});
const postgresMock = vi.fn();
vi.mock("postgres", () => ({ default: postgresMock }));

describe("GET /api/garmin/sync over the gateway", () => {
  beforeEach(() => {
    writes.length = 0;
    vi.stubEnv("SOMA_DATABASE_URL", "postgresql://soma_ro:pw@pg.gkos.dev/soma?sslmode=require");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        const { query } = JSON.parse(String(init.body)) as { query: string };
        if (query.includes("daily_health_summary"))
          return Response.json({ rows: [{ date: "2026-10-01", total_steps: 9000, bmr_kilocalories: 1700, active_kilocalories: 500, total_kilocalories: 2200, resting_heart_rate: 48 }] });
        if (query.includes("nutrition_profile")) return Response.json({ rows: [{ step_goal: 10000 }] });
        if (query.includes("weight_log")) return Response.json({ rows: [{ date: "2026-10-01", weight_grams: 75200, body_fat_pct: null, source_type: "HEALTH_CONNECT" }] });
        return Response.json({ rows: [] });
      }),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("reads soma through the gateway and answers 200", async () => {
    const { GET } = await import("@/app/api/garmin/sync/route");
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(postgresMock).not.toHaveBeenCalled();
    expect(body.synced.latestWeight).toBeCloseTo(75.2);
    expect(body.synced.stepGoal).toBe(10000);
    expect(writes.length).toBeGreaterThan(0);
  });
});

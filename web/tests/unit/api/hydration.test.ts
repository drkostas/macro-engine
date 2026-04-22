import { describe, it, expect, vi, beforeEach } from "vitest";

type QueryHandler = (query: string, values: unknown[]) => unknown[];
let queryHandler: QueryHandler = () => [];
const executedQueries: { query: string; values: unknown[] }[] = [];

vi.mock("@/lib/db", () => ({
  getDb: () => (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.join("?");
    executedQueries.push({ query, values });
    return Promise.resolve(queryHandler(query, values));
  },
}));

import { GET, POST } from "@/app/api/nutrition/hydration/route";
import { NextRequest } from "next/server";

function makePost(body: unknown) {
  return new NextRequest("http://localhost/api/nutrition/hydration", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const TODAY = new Date().toISOString().split("T")[0];

function profileRow() {
  return { id: 1, weight_kg: 74.2 };
}

describe("POST /api/nutrition/hydration", () => {
  beforeEach(() => {
    executedQueries.length = 0;
    queryHandler = (query) => {
      if (query.includes("FROM nutrition_profile")) return [profileRow()];
      if (query.includes("FROM hydration_log")) {
        return [{ date: TODAY, logs: [], sodium_mg: 0 }];
      }
      if (query.includes("INSERT INTO hydration_log")) {
        return [{ date: TODAY, logs: [], sodium_mg: 0 }];
      }
      if (query.includes("UPDATE hydration_log")) return [];
      return [];
    };
  });

  it("rejects missing volume_ml", async () => {
    const res = await POST(makePost({}));
    expect(res.status).toBe(400);
  });

  it("rejects non-positive volume_ml", async () => {
    const res = await POST(makePost({ volume_ml: 0 }));
    expect(res.status).toBe(400);
  });

  it("accepts plain water drink", async () => {
    const res = await POST(makePost({ volume_ml: 500 }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.effective_ml).toBe(500);
  });

  it("applies alcohol penalty to effective_ml", async () => {
    const res = await POST(makePost({ volume_ml: 500, ethanol_g: 20 }));
    const body = await res.json();
    expect(body.effective_ml).toBe(300);
  });

  it("adds sodium_mg to running total", async () => {
    const res = await POST(makePost({ volume_ml: 500, sodium_mg: 300 }));
    expect(res.status).toBe(201);
    const sodiumUpdate = executedQueries.find((q) =>
      q.query.includes("UPDATE hydration_log") && q.query.includes("sodium_mg"),
    );
    expect(sodiumUpdate).toBeDefined();
  });
});

describe("GET /api/nutrition/hydration", () => {
  beforeEach(() => {
    executedQueries.length = 0;
  });

  it("returns targets from profile weight and empty log", async () => {
    queryHandler = (query) => {
      if (query.includes("FROM nutrition_profile")) return [profileRow()];
      if (query.includes("FROM hydration_log")) return [];
      return [];
    };
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.targets.waterBeverageMl).toBe(2078); // 28 × 74.2
    expect(body.targets.sodiumMg).toBe(1500);
    expect(body.effectiveMl).toBe(0);
    expect(Array.isArray(body.logs)).toBe(true);
    expect(body.logs).toHaveLength(0);
  });

  it("accumulates effective_ml across logged drinks", async () => {
    queryHandler = (query) => {
      if (query.includes("FROM nutrition_profile")) return [profileRow()];
      if (query.includes("FROM hydration_log")) {
        return [{
          date: TODAY,
          logs: [
            { ts: "2026-04-22T08:00:00Z", volume_ml: 500, ethanol_g: 0, caffeine_mg: 0 },
            { ts: "2026-04-22T10:00:00Z", volume_ml: 300, ethanol_g: 0, caffeine_mg: 0 },
          ],
          sodium_mg: 0,
        }];
      }
      return [];
    };
    const res = await GET();
    const body = await res.json();
    expect(body.effectiveMl).toBe(800);
    expect(body.logs).toHaveLength(2);
  });

  it("returns 404 when no profile", async () => {
    queryHandler = () => [];
    const res = await GET();
    expect(res.status).toBe(404);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

type Row = Record<string, unknown>;
type QueryHandler = (query: string, values: unknown[]) => Row[] | Promise<Row[]>;

let queryHandler: QueryHandler = () => [];

vi.mock("@/lib/db", () => ({
  getDb: () =>
    (strings: TemplateStringsArray, ...values: unknown[]) => {
      const query = strings.join("?");
      return Promise.resolve(queryHandler(query, values));
    },
}));

import { GET } from "@/app/api/nutrition/progression/route";
import { NextRequest } from "next/server";

describe("GET /api/nutrition/progression", () => {
  beforeEach(() => {
    queryHandler = () => [];
  });

  it("defaults to window=30 when not specified", async () => {
    queryHandler = (q) => {
      if (q.includes("FROM nutrition_profile")) return [{ weight_kg: 75 }];
      return [];
    };
    const req = new NextRequest("http://localhost/api/nutrition/progression");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.progression.windowDays).toBe(30);
  });

  it("accepts window=60", async () => {
    queryHandler = (q) => {
      if (q.includes("FROM nutrition_profile")) return [{ weight_kg: 75 }];
      return [];
    };
    const req = new NextRequest("http://localhost/api/nutrition/progression?window=60");
    const res = await GET(req);
    const body = await res.json();
    expect(body.progression.windowDays).toBe(60);
  });

  it("rejects invalid window", async () => {
    const req = new NextRequest("http://localhost/api/nutrition/progression?window=45");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("aggregates real data into ProgressionWindow shape", async () => {
    queryHandler = (q) => {
      if (q.includes("FROM nutrition_profile")) return [{ weight_kg: 75 }];
      if (q.includes("FROM nutrition_day")) {
        return Array.from({ length: 30 }, (_, i) => ({
          date: `2026-03-${String(1 + i).padStart(2, "0")}`,
          target_calories: 2000,
          actual_calories: 2050,
          tdee_used: 2500,
          status: "closed",
          training_day_type: i % 2 === 0 ? "run" : "rest",
        }));
      }
      if (q.includes("FROM weight_log")) {
        return [
          { date: "2026-03-01", weight_grams: 76000 },
          { date: "2026-03-30", weight_grams: 74500 },
        ];
      }
      return [];
    };
    const req = new NextRequest("http://localhost/api/nutrition/progression?window=30");
    const res = await GET(req);
    const body = await res.json();
    expect(body.progression.windowDays).toBe(30);
    expect(body.progression.adherenceAvgPct).toBe(100);
    expect(body.progression.weightDeltaKg).toBeCloseTo(-1.5, 1);
    expect(body.progression.avgDailyDeficit).toBe(450);
    expect(body.progression.trainingDays).toBeGreaterThan(0);
  });
});

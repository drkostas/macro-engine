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

import { GET } from "@/app/api/nutrition/year-review/route";
import { NextRequest } from "next/server";

describe("GET /api/nutrition/year-review", () => {
  beforeEach(() => {
    queryHandler = () => [];
  });

  it("defaults to current year when ?year missing", async () => {
    const currentYear = new Date().getUTCFullYear();
    const req = new NextRequest("http://localhost/api/nutrition/year-review");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.review.year).toBe(currentYear);
  });

  it("rejects malformed year", async () => {
    const req = new NextRequest("http://localhost/api/nutrition/year-review?year=abc");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("rejects out-of-range year", async () => {
    const req = new NextRequest("http://localhost/api/nutrition/year-review?year=10001");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("aggregates nutrition_day + meal_log + weight_log into review", async () => {
    queryHandler = (q) => {
      if (q.includes("FROM nutrition_day")) {
        return Array.from({ length: 30 }, (_, i) => ({
          date: `2026-01-${String(1 + i).padStart(2, "0")}`,
          target_calories: 2000,
          actual_calories: 2050,
          status: "closed",
          training_day_type: i % 2 === 0 ? "run" : "rest",
        }));
      }
      if (q.includes("FROM meal_log")) {
        return Array.from({ length: 30 }, (_, i) => ({
          date: `2026-01-${String(1 + i).padStart(2, "0")}`,
          total_protein: 145,
        }));
      }
      if (q.includes("FROM weight_log")) {
        return [
          { date: "2026-01-01", weight_grams: 80000 },
          { date: "2026-01-30", weight_grams: 78500 },
        ];
      }
      return [];
    };
    const req = new NextRequest("http://localhost/api/nutrition/year-review?year=2026");
    const res = await GET(req);
    const body = await res.json();
    expect(body.review.year).toBe(2026);
    expect(body.review.totalDaysTracked).toBe(30);
    expect(body.review.overallAdherencePct).toBe(100);
    expect(body.review.avgProteinG).toBe(145);
    expect(body.review.weightDeltaKg).toBeCloseTo(-1.5, 1);
    expect(body.review.months).toHaveLength(12);
    expect(body.review.months[0].daysTracked).toBe(30);
  });
});

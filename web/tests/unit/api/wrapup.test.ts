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

import { GET } from "@/app/api/nutrition/wrapup/route";
import { NextRequest } from "next/server";

describe("GET /api/nutrition/wrapup", () => {
  beforeEach(() => {
    queryHandler = () => [];
  });

  it("returns wrapup shape with empty data", async () => {
    queryHandler = (q) => {
      if (q.includes("FROM nutrition_profile")) return [{ weight_kg: 75 }];
      return [];
    };
    const req = new NextRequest("http://localhost/api/nutrition/wrapup?end=2026-04-14");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.wrapup).toBeDefined();
    expect(body.wrapup.adherencePct).toBe(0);
    expect(body.takeaway).toBeTypeOf("string");
  });

  it("aggregates 7-day window with adherence + grade", async () => {
    queryHandler = (q) => {
      if (q.includes("FROM nutrition_profile")) return [{ weight_kg: 75 }];
      if (q.includes("FROM nutrition_day")) {
        return Array.from({ length: 7 }, (_, i) => ({
          date: `2026-04-${String(8 + i).padStart(2, "0")}`,
          target_calories: 2000,
          actual_calories: 2050,
          status: "closed",
          training_day_type: i % 2 === 0 ? "run" : "rest",
        }));
      }
      if (q.includes("FROM meal_log")) {
        // 150g protein per day
        return Array.from({ length: 7 }, (_, i) => ({
          date: `2026-04-${String(8 + i).padStart(2, "0")}`,
          total_protein: 150,
        }));
      }
      if (q.includes("FROM weight_log")) {
        return [
          { date: "2026-04-08", weight_grams: 75000 },
          { date: "2026-04-14", weight_grams: 74500 },
        ];
      }
      return [];
    };
    const req = new NextRequest("http://localhost/api/nutrition/wrapup?end=2026-04-14");
    const res = await GET(req);
    const body = await res.json();
    expect(body.wrapup.adherencePct).toBe(100);
    expect(body.wrapup.grade).toBe("A");
    expect(body.wrapup.daysClosed).toBe(7);
    expect(body.wrapup.avgProteinG).toBe(150);
    expect(body.wrapup.avgProteinGPerKg).toBeCloseTo(2.0, 1);
    expect(body.wrapup.weightDeltaKg).toBeCloseTo(-0.5, 2);
    expect(body.wrapup.trainingDays).toBeGreaterThan(0);
  });

  it("defaults to today's window when no ?end param", async () => {
    queryHandler = (q) => {
      if (q.includes("FROM nutrition_profile")) return [{ weight_kg: 75 }];
      return [];
    };
    const req = new NextRequest("http://localhost/api/nutrition/wrapup");
    const res = await GET(req);
    expect(res.status).toBe(200);
  });
});

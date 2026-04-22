import { describe, it, expect, vi, beforeEach } from "vitest";

type Row = Record<string, unknown>;
type QueryHandler = (query: string, values: unknown[]) => Row[] | Promise<Row[]>;

let queryHandler: QueryHandler = () => [];

vi.mock("@/lib/db", () => ({
  getDb: () => {
    // Neon's `sql` is a tagged template function. We emulate it by joining the
    // raw strings and passing the values array to our QueryHandler.
    return (strings: TemplateStringsArray, ...values: unknown[]) => {
      const query = strings.join("?");
      return Promise.resolve(queryHandler(query, values));
    };
  },
}));

import { GET } from "@/app/api/nutrition/plan/route";
import { NextRequest } from "next/server";

/** Default handler: returns a well-formed profile and empty data. */
function defaultHandler(): QueryHandler {
  return (query: string) => {
    if (query.includes("FROM nutrition_profile")) {
      return [{
        id: 1, weight_kg: 80, daily_deficit: 500,
        protein_g_per_kg: 2.2, fat_g_per_kg: 0.8,
        step_goal: 10000, tdee_estimate: 2600,
        estimated_bf_pct: 20, target_bf_pct: 15,
      }];
    }
    if (query.includes("FROM nutrition_day WHERE date =")) return [];
    if (query.includes("FROM meal_log WHERE date")) return [];
    if (query.includes("FROM drink_log WHERE date")) return [];
    if (query.includes("FROM daily_health_summary WHERE date")) return [];
    if (query.includes("FROM weight_log")) return [{ weight_grams: 80_000 }];
    if (query.includes("bmr_kilocalories > 1500")) {
      return [{ bmr_kilocalories: 1800 }];
    }
    if (query.includes("FROM garmin_activity_raw")) return [{ total_cal: 0 }];
    if (query.includes("workout_enrichment")) return [];
    if (query.includes("FROM nutrition_day") && query.includes("training_day_type")) {
      return [];
    }
    return [];
  };
}

describe("GET /api/nutrition/plan", () => {
  beforeEach(() => {
    queryHandler = defaultHandler();
  });

  it("returns 200 with plan data when a profile exists", async () => {
    const req = new NextRequest("http://localhost/api/nutrition/plan?date=2026-04-14");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tdee).toBeDefined();
    expect(body.targets).toBeDefined();
    expect(body.eaten).toBeDefined();
    expect(body.remaining).toBeDefined();
    expect(body.slotBudgets).toHaveLength(4);
  });

  it("returns 404+needsOnboarding when profile is missing", async () => {
    queryHandler = (query: string) => {
      if (query.includes("FROM nutrition_profile")) return [];
      return [];
    };
    const req = new NextRequest("http://localhost/api/nutrition/plan?date=2026-04-14");
    const res = await GET(req);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.needsOnboarding).toBe(true);
  });

  it("uses valid Garmin BMR when it exceeds 1500", async () => {
    queryHandler = (query: string) => {
      if (query.includes("FROM nutrition_profile")) {
        return [{
          id: 1, weight_kg: 80, daily_deficit: 500,
          protein_g_per_kg: 2.2, fat_g_per_kg: 0.8,
          step_goal: 10000, tdee_estimate: 2600,
        }];
      }
      if (query.includes("FROM daily_health_summary WHERE date")) {
        // Live day: valid BMR
        return [{ bmr_kilocalories: 1900, total_steps: 8000 }];
      }
      if (query.includes("FROM weight_log")) return [{ weight_grams: 80_000 }];
      if (query.includes("FROM nutrition_day")) return [];
      if (query.includes("FROM meal_log")) return [];
      if (query.includes("FROM drink_log")) return [];
      return [];
    };
    const req = new NextRequest("http://localhost/api/nutrition/plan?date=2026-04-14");
    const res = await GET(req);
    const body = await res.json();
    expect(body.tdee.bmr).toBe(1900);
  });

  it("falls back to recent valid BMR when Garmin returns a stale <1500 value", async () => {
    queryHandler = (query: string) => {
      if (query.includes("FROM nutrition_profile")) {
        return [{
          id: 1, weight_kg: 80, daily_deficit: 500,
          protein_g_per_kg: 2.2, fat_g_per_kg: 0.8,
          step_goal: 10000, tdee_estimate: 2600,
        }];
      }
      if (query.includes("FROM daily_health_summary WHERE date")) {
        return [{ bmr_kilocalories: 680, total_steps: 100 }]; // stale
      }
      if (query.includes("bmr_kilocalories > 1500")) {
        return [{ bmr_kilocalories: 1850 }]; // most recent valid
      }
      if (query.includes("FROM weight_log")) return [{ weight_grams: 80_000 }];
      if (query.includes("FROM nutrition_day")) return [];
      if (query.includes("FROM meal_log")) return [];
      if (query.includes("FROM drink_log")) return [];
      return [];
    };
    const req = new NextRequest("http://localhost/api/nutrition/plan?date=2026-04-14");
    const res = await GET(req);
    const body = await res.json();
    expect(body.tdee.bmr).toBe(1850);
    expect(body.tdee.bmr).not.toBe(680);
  });

  it("falls back to tdee_estimate * 0.75 when no valid BMR anywhere", async () => {
    queryHandler = (query: string) => {
      if (query.includes("FROM nutrition_profile")) {
        return [{
          id: 1, weight_kg: 80, daily_deficit: 500,
          protein_g_per_kg: 2.2, fat_g_per_kg: 0.8,
          step_goal: 10000, tdee_estimate: 2600,
        }];
      }
      if (query.includes("bmr_kilocalories > 1500")) return [];
      if (query.includes("FROM weight_log")) return [{ weight_grams: 80_000 }];
      if (query.includes("FROM nutrition_day")) return [];
      if (query.includes("FROM meal_log")) return [];
      if (query.includes("FROM drink_log")) return [];
      return [];
    };
    const req = new NextRequest("http://localhost/api/nutrition/plan?date=2026-04-14");
    const res = await GET(req);
    const body = await res.json();
    // 2600 * 0.75 = 1950
    expect(body.tdee.bmr).toBe(1950);
  });

  it("computes targets dynamically via the new 5-band engine", async () => {
    const req = new NextRequest("http://localhost/api/nutrition/plan?date=2026-04-14");
    const res = await GET(req);
    const body = await res.json();
    // Profile: 80 kg, estimated_bf_pct=20 → T2, mode defaults to standard.
    // Standard T2 at REST band → 2.3 g/kg × 80 = 184g protein.
    expect(body.targets.protein).toBe(184);
    // Kcal is delivered total; with the new engine it may undershoot the
    // target (tight rest-day budget), but still composes to itself.
    const kcal = body.targets.protein * 4 + body.targets.carbs * 4 + body.targets.fat * 9;
    expect(Math.abs(kcal - body.targets.calories)).toBeLessThan(50);
  });
});

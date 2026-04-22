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

import { GET, POST } from "@/app/api/nutrition/climate/route";
import { NextRequest } from "next/server";

describe("/api/nutrition/climate", () => {
  beforeEach(() => {
    queryHandler = () => [];
  });

  it("GET returns normal adjustments when env=normal", async () => {
    queryHandler = (q) =>
      q.includes("FROM nutrition_profile")
        ? [{ climate_env: "normal", weight_kg: 70, sex: "M" }]
        : [];
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.climate.env).toBe("normal");
    expect(body.climate.adjustment.extraFluidMl).toBe(0);
  });

  it("GET altitude returns iron + fluid + carb bumps", async () => {
    queryHandler = (q) =>
      q.includes("FROM nutrition_profile")
        ? [{ climate_env: "altitude", weight_kg: 70, sex: "M" }]
        : [];
    const res = await GET();
    const body = await res.json();
    expect(body.climate.env).toBe("altitude");
    expect(body.climate.adjustment.ironTargetMg).toBeGreaterThanOrEqual(10);
    expect(body.climate.adjustment.extraFluidMl).toBe(500);
    expect(body.climate.adjustment.extraCarbG).toBe(70);
  });

  it("POST updates env", async () => {
    let saw = "";
    queryHandler = (q, v) => {
      if (q.includes("UPDATE nutrition_profile")) {
        saw = String(v[0]);
        return [];
      }
      if (q.includes("FROM nutrition_profile")) {
        return [{ climate_env: "heat", weight_kg: 70, sex: "M" }];
      }
      return [];
    };
    const req = new NextRequest("http://localhost/api/nutrition/climate", {
      method: "POST",
      body: JSON.stringify({ env: "heat" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(saw).toBe("heat");
    const body = await res.json();
    expect(body.climate.env).toBe("heat");
    expect(body.climate.adjustment.extraFluidMl).toBeGreaterThan(0);
  });

  it("POST with unknown env → 400", async () => {
    const req = new NextRequest("http://localhost/api/nutrition/climate", {
      method: "POST",
      body: JSON.stringify({ env: "tropic" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("POST heat with sweat opts persists and computes sodium", async () => {
    queryHandler = (q, v) => {
      if (q.includes("UPDATE nutrition_profile")) {
        expect(v).toContain("heat");
        expect(v).toContain(1.5);
        expect(v).toContain(2);
        return [];
      }
      if (q.includes("FROM nutrition_profile")) {
        return [{
          climate_env: "heat", weight_kg: 70, sex: "M",
          climate_sweat_l_per_hour: 1.5, climate_hours: 2,
        }];
      }
      return [];
    };
    const req = new NextRequest("http://localhost/api/nutrition/climate", {
      method: "POST",
      body: JSON.stringify({ env: "heat", sweat_l_per_hour: 1.5, hours: 2 }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(body.climate.adjustment.extraFluidMl).toBe(3000);
    expect(body.climate.adjustment.extraSodiumMg).toBe(2250);
  });
});

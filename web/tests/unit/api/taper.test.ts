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

import { GET, POST } from "@/app/api/nutrition/taper/route";
import { NextRequest } from "next/server";

describe("/api/nutrition/taper", () => {
  beforeEach(() => {
    queryHandler = () => [];
  });

  it("GET with no race_date → { taper: null }", async () => {
    queryHandler = (q) =>
      q.includes("FROM nutrition_profile") ? [{ race_date: null }] : [];
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.taper).toBeNull();
  });

  it("GET with future race_date → phase + days_until + targets", async () => {
    const todayIso = new Date().toISOString().split("T")[0];
    const race = new Date();
    race.setUTCDate(race.getUTCDate() + 10);
    const raceIso = race.toISOString().split("T")[0];
    queryHandler = (q) => {
      if (q.includes("FROM nutrition_profile")) {
        return [{ race_date: raceIso, weight_kg: 70, protein_g_per_kg: 2.0 }];
      }
      return [];
    };
    const res = await GET();
    const body = await res.json();
    expect(body.taper).not.toBeNull();
    expect(body.taper.raceDate).toBe(raceIso);
    expect(body.taper.daysUntil).toBe(10);
    expect(body.taper.phase).toBe("volume_taper");
    expect(body.taper.carbGPerKg).toBe(6);
    expect(body.taper.proteinGPerKg).toBeGreaterThanOrEqual(1.8);
    expect(todayIso).toBeTruthy();
  });

  it("POST with valid race_date → 200 + echoes taper", async () => {
    let updated = false;
    queryHandler = (q, v) => {
      if (q.includes("UPDATE nutrition_profile")) {
        updated = true;
        expect(v).toContain("2026-05-01");
        return [];
      }
      if (q.includes("FROM nutrition_profile")) {
        return [{ race_date: "2026-05-01", weight_kg: 70, protein_g_per_kg: 2.0 }];
      }
      return [];
    };
    const req = new NextRequest("http://localhost/api/nutrition/taper", {
      method: "POST",
      body: JSON.stringify({ race_date: "2026-05-01" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(updated).toBe(true);
    const body = await res.json();
    expect(body.taper.raceDate).toBe("2026-05-01");
  });

  it("POST clearing race_date (null) → 200", async () => {
    let updated = false;
    queryHandler = (q, v) => {
      if (q.includes("UPDATE nutrition_profile")) {
        updated = true;
        expect(v).toContain(null);
        return [];
      }
      if (q.includes("FROM nutrition_profile")) return [{ race_date: null }];
      return [];
    };
    const req = new NextRequest("http://localhost/api/nutrition/taper", {
      method: "POST",
      body: JSON.stringify({ race_date: null }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(updated).toBe(true);
    const body = await res.json();
    expect(body.taper).toBeNull();
  });

  it("POST with malformed date → 400", async () => {
    const req = new NextRequest("http://localhost/api/nutrition/taper", {
      method: "POST",
      body: JSON.stringify({ race_date: "05/01/2026" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

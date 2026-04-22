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

import { GET, POST } from "@/app/api/nutrition/ffm-anchor/route";
import { NextRequest } from "next/server";

function makePost(body: unknown) {
  return new NextRequest("http://localhost/api/nutrition/ffm-anchor", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeGet(url = "http://localhost/api/nutrition/ffm-anchor") {
  return new NextRequest(url);
}

const today = new Date().toISOString().split("T")[0];
const thirty = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
const sixty = new Date(Date.now() - 60 * 86400000).toISOString().split("T")[0];

describe("POST /api/nutrition/ffm-anchor", () => {
  beforeEach(() => {
    executedQueries.length = 0;
    queryHandler = (query) => {
      if (query.includes("INSERT INTO ffm_anchor")) {
        return [{
          id: 1, date: today, method: "navy",
          ffm_kg: 56.5, sigma_kg: 2.2, notes: null, created_at: new Date(),
        }];
      }
      if (query.includes("SELECT MAX(date)")) {
        return [{ max_date: sixty }]; // new anchor is the latest
      }
      if (query.includes("UPDATE nutrition_profile")) {
        return [];
      }
      return [];
    };
  });

  it("rejects missing method with 400", async () => {
    const res = await POST(makePost({ date: today, ffm_kg: 56.5 }));
    expect(res.status).toBe(400);
  });

  it("rejects unknown method with 400", async () => {
    const res = await POST(makePost({ date: today, method: "bogus", ffm_kg: 56.5 }));
    expect(res.status).toBe(400);
  });

  it("rejects non-positive ffm_kg with 400", async () => {
    const res = await POST(makePost({ date: today, method: "navy", ffm_kg: 0 }));
    expect(res.status).toBe(400);
  });

  it("rejects missing date with 400", async () => {
    const res = await POST(makePost({ method: "navy", ffm_kg: 56.5 }));
    expect(res.status).toBe(400);
  });

  it("happy path inserts with method-derived sigma", async () => {
    const res = await POST(makePost({
      date: today, method: "navy", ffm_kg: 56.5,
    }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.anchor.method).toBe("navy");
    // Navy sigma = 2.2 per method_sigma lookup
    const inserted = executedQueries.find((q) =>
      q.query.includes("INSERT INTO ffm_anchor"),
    );
    expect(inserted?.values).toContain(2.2);
  });

  it("DEXA anchor gets sigma 1.0", async () => {
    await POST(makePost({ date: today, method: "dexa", ffm_kg: 56.5 }));
    const inserted = executedQueries.find((q) =>
      q.query.includes("INSERT INTO ffm_anchor"),
    );
    expect(inserted?.values).toContain(1.0);
  });

  it("updates profile FFM when new anchor is the most recent", async () => {
    await POST(makePost({ date: today, method: "navy", ffm_kg: 56.5 }));
    const profileUpdate = executedQueries.find((q) =>
      q.query.includes("UPDATE nutrition_profile") &&
      q.query.includes("estimated_ffm_kg"),
    );
    expect(profileUpdate).toBeDefined();
  });

  it("does NOT update profile FFM when anchor is older than existing most-recent", async () => {
    // A more-recent anchor already exists.
    queryHandler = (query) => {
      if (query.includes("INSERT INTO ffm_anchor")) {
        return [{ id: 2, date: sixty, method: "bia", ffm_kg: 55, sigma_kg: 2.5 }];
      }
      if (query.includes("SELECT MAX(date)")) {
        return [{ max_date: today }]; // someone already logged something newer
      }
      return [];
    };
    await POST(makePost({ date: sixty, method: "bia", ffm_kg: 55 }));
    const profileUpdate = executedQueries.find((q) =>
      q.query.includes("UPDATE nutrition_profile"),
    );
    expect(profileUpdate).toBeUndefined();
  });
});

describe("GET /api/nutrition/ffm-anchor", () => {
  beforeEach(() => {
    executedQueries.length = 0;
  });

  it("returns current anchor with effective sigma", async () => {
    queryHandler = (query) => {
      if (query.includes("SELECT")) {
        return [
          { id: 2, date: thirty, method: "navy", ffm_kg: 56.5, sigma_kg: 2.2, notes: null, created_at: new Date() },
          { id: 1, date: sixty, method: "nhanes", ffm_kg: 63, sigma_kg: 3.0, notes: null, created_at: new Date() },
        ];
      }
      return [];
    };
    const res = await GET(makeGet());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.current).toBeDefined();
    expect(body.current.method).toBe("navy");
    expect(body.current.sigma_kg).toBe(2.2);
    // At ~4 weeks staleness, effective sigma still equals base (under 12wk threshold).
    expect(body.current.effective_sigma_kg).toBe(2.2);
    expect(body.history).toHaveLength(2);
  });

  it("returns 404 when no anchors exist", async () => {
    queryHandler = () => [];
    const res = await GET(makeGet());
    expect(res.status).toBe(404);
  });

  it("widens sigma for anchors older than 12 weeks", async () => {
    const eightyFourDaysAgo = new Date(Date.now() - 180 * 86400000).toISOString().split("T")[0];
    queryHandler = () => [
      { id: 1, date: eightyFourDaysAgo, method: "dexa", ffm_kg: 56.5, sigma_kg: 1.0, notes: null, created_at: new Date() },
    ];
    const res = await GET(makeGet());
    const body = await res.json();
    // 180 days ≈ 25.7 weeks; 25.7 - 12 = 13.7 extra weeks × 0.1 kg/wk = 1.37 kg.
    expect(body.current.effective_sigma_kg).toBeGreaterThan(1.0 + 1.0);
    expect(body.current.effective_sigma_kg).toBeLessThan(1.0 + 1.6);
  });

  it("respects limit query parameter", async () => {
    queryHandler = (query, values) => {
      if (query.includes("SELECT")) {
        // Assert the limit value was bound.
        expect(values).toContain(5);
        return [
          { id: 1, date: today, method: "navy", ffm_kg: 56, sigma_kg: 2.2, notes: null, created_at: new Date() },
        ];
      }
      return [];
    };
    const res = await GET(makeGet("http://localhost/api/nutrition/ffm-anchor?limit=5"));
    expect(res.status).toBe(200);
  });
});

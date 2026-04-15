import { describe, it, expect, vi, beforeEach } from "vitest";

type QueryHandler = (query: string, values: unknown[]) => unknown[];
let queryHandler: QueryHandler = () => [];
const writes: Array<{ query: string; values: unknown[] }> = [];

vi.mock("@/lib/db", () => ({
  getDb: () => (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.join("?");
    writes.push({ query, values });
    return Promise.resolve(queryHandler(query, values));
  },
}));

import { POST } from "@/app/api/nutrition/weigh-in/route";
import { NextRequest } from "next/server";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/nutrition/weigh-in", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/nutrition/weigh-in", () => {
  beforeEach(() => {
    writes.length = 0;
    queryHandler = (query) => {
      if (query.includes("AVG(kg)")) return [{ avg_7d: 75.5 }];
      return [];
    };
  });

  it("rejects non-numeric weight", async () => {
    const res = await POST(makeReq({ weight_kg: "abc" }));
    expect(res.status).toBe(400);
  });
  it("rejects weight below 20 kg", async () => {
    const res = await POST(makeReq({ weight_kg: 5 }));
    expect(res.status).toBe(400);
  });
  it("rejects weight above 400 kg", async () => {
    const res = await POST(makeReq({ weight_kg: 500 }));
    expect(res.status).toBe(400);
  });
  it("accepts a valid weight and returns avg_7d", async () => {
    const res = await POST(makeReq({ weight_kg: 75.2 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.weight_kg).toBe(75.2);
    expect(typeof body.avg_7d).toBe("number");
  });
  it("writes to weight_log + analytics_weight_trend + nutrition_profile", async () => {
    await POST(makeReq({ weight_kg: 75.2 }));
    const queries = writes.map((w) => w.query);
    expect(queries.some((q) => q.includes("DELETE FROM weight_log"))).toBe(true);
    expect(queries.some((q) => q.includes("INSERT INTO weight_log"))).toBe(true);
    expect(queries.some((q) => q.includes("INSERT INTO analytics_weight_trend"))).toBe(true);
    expect(queries.some((q) => q.includes("UPDATE nutrition_profile"))).toBe(true);
  });
  it("uses supplied date when provided", async () => {
    await POST(makeReq({ weight_kg: 75, date: "2026-04-10" }));
    const weightLog = writes.find((w) => w.query.includes("INSERT INTO weight_log"));
    expect(weightLog?.values[0]).toBe("2026-04-10");
  });
  it("converts kg to grams in weight_log", async () => {
    await POST(makeReq({ weight_kg: 75.123 }));
    const weightLog = writes.find((w) => w.query.includes("INSERT INTO weight_log"));
    expect(weightLog?.values[1]).toBe(75123);
  });
  it("uses source_type='manual' not the legacy 'source' column", async () => {
    await POST(makeReq({ weight_kg: 75.2 }));
    const queries = writes.map((w) => w.query);
    expect(queries.some((q) => q.includes("source_type"))).toBe(true);
    expect(queries.some((q) => q.includes(", source,") || q.includes("(source,") || q.includes(" source "))).toBe(false);
  });
});

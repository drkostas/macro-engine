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

import { GET, POST } from "@/app/api/nutrition/subjective/route";
import { NextRequest } from "next/server";

function makePost(body: unknown) {
  return new NextRequest("http://localhost/api/nutrition/subjective", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const TODAY = new Date().toISOString().split("T")[0];

describe("POST /api/nutrition/subjective", () => {
  beforeEach(() => {
    executedQueries.length = 0;
    queryHandler = (query) => {
      if (query.includes("INSERT INTO subjective_log")) {
        return [{
          date: TODAY,
          morning_hooper: { fatigue: 3, sleep: 3, stress: 2, soreness: 3 },
          hunger_by_slot: null,
          workout_rpe: null,
          phq2: null,
          scoff: null,
        }];
      }
      return [];
    };
  });

  it("rejects empty body", async () => {
    const res = await POST(makePost({}));
    expect(res.status).toBe(400);
  });

  it("accepts morning_hooper partial update", async () => {
    const res = await POST(makePost({
      morning_hooper: { fatigue: 3, sleep: 3, stress: 2, soreness: 3 },
    }));
    expect(res.status).toBe(201);
    const upsert = executedQueries.find((q) =>
      q.query.includes("INSERT INTO subjective_log"),
    );
    expect(upsert).toBeDefined();
  });

  it("rejects hooper fields out of 1-7 range", async () => {
    const res = await POST(makePost({
      morning_hooper: { fatigue: 0, sleep: 3, stress: 2, soreness: 3 },
    }));
    expect(res.status).toBe(400);
  });

  it("accepts workout_rpe payload", async () => {
    const res = await POST(makePost({
      workout_rpe: { rpe: 7, duration_min: 60 },
    }));
    expect(res.status).toBe(201);
  });

  it("accepts phq2 payload", async () => {
    const res = await POST(makePost({ phq2: { little_interest: 1, feeling_down: 1 } }));
    expect(res.status).toBe(201);
  });
});

describe("GET /api/nutrition/subjective", () => {
  beforeEach(() => {
    executedQueries.length = 0;
  });

  function makeHist(totals: number[]): unknown[] {
    return totals.map((t, i) => ({
      date: `2026-04-${String(i + 1).padStart(2, "0")}`,
      morning_hooper: { fatigue: 1, sleep: 1, stress: 1, soreness: t - 3 },
      hunger_by_slot: null,
      workout_rpe: null,
      phq2: null,
      scoff: null,
    }));
  }

  it("returns today + history + alert shape", async () => {
    queryHandler = (query) => {
      if (query.includes("FROM subjective_log")) {
        return makeHist(Array(28).fill(11));
      }
      return [];
    };
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.today).toBeDefined();
    expect(Array.isArray(body.recent)).toBe(true);
    expect(body.alert).toBeDefined();
    expect(body.alert.alertLevel).toBeTypeOf("string");
  });

  it("empty log returns empty arrays + normal alert", async () => {
    queryHandler = () => [];
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.today).toBeNull();
    expect(body.recent).toEqual([]);
    expect(body.alert.alertLevel).toBe("normal");
  });
});

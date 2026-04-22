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

import { GET, POST, PATCH } from "@/app/api/nutrition/injury/route";
import { NextRequest } from "next/server";

function makePost(body: unknown) {
  return new NextRequest("http://localhost/api/nutrition/injury", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makePatch(body: unknown) {
  return new NextRequest("http://localhost/api/nutrition/injury", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/nutrition/injury", () => {
  beforeEach(() => {
    executedQueries.length = 0;
    queryHandler = (query) => {
      if (query.includes("nutrition_profile")) {
        return [{ estimated_ffm_kg: 56 }];
      }
      if (query.includes("UPDATE injury_log")) return [];
      if (query.includes("INSERT INTO injury_log")) {
        return [{
          id: 1, injury_date: "2026-04-10",
          recovered_date: null, type: "acl",
          notes: null, rehab_kcal: 300,
          pre_injury_protein_g_per_kg: 2.0,
        }];
      }
      return [];
    };
  });

  it("rejects missing injury_date", async () => {
    const res = await POST(makePost({ type: "acl" }));
    expect(res.status).toBe(400);
  });

  it("rejects unknown type", async () => {
    const res = await POST(makePost({ injury_date: "2026-04-10", type: "bogus" }));
    expect(res.status).toBe(400);
  });

  it("happy path creates active injury", async () => {
    const res = await POST(makePost({
      injury_date: "2026-04-10", type: "acl", rehab_kcal: 300,
    }));
    expect(res.status).toBe(201);
    const closedPrev = executedQueries.find((q) =>
      q.query.includes("UPDATE injury_log") && q.query.includes("recovered_date"),
    );
    expect(closedPrev).toBeDefined();
  });
});

describe("PATCH /api/nutrition/injury", () => {
  beforeEach(() => {
    queryHandler = (query) => {
      if (query.includes("UPDATE injury_log")) {
        return [{ id: 1, recovered_date: "2026-04-22" }];
      }
      return [];
    };
  });

  it("marks active injury recovered", async () => {
    const res = await PATCH(makePatch({ id: 1 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("rejects missing id", async () => {
    const res = await PATCH(makePatch({}));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/nutrition/injury", () => {
  it("returns active injury with derived fields", async () => {
    queryHandler = (query) => {
      if (query.includes("FROM injury_log")) {
        return [{
          id: 1, injury_date: "2026-04-10",
          recovered_date: null, type: "acl",
          notes: null, rehab_kcal: 300,
          pre_injury_protein_g_per_kg: 2.0,
        }];
      }
      if (query.includes("nutrition_profile")) {
        return [{ estimated_ffm_kg: 56 }];
      }
      return [];
    };
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.injury).not.toBeNull();
    expect(body.injury.phase).toMatch(/^(acute|subacute|chronic)$/);
    expect(body.injury.proteinGPerKg).toBe(2.4);
    expect(body.injury.eaFloorKcal).toBeGreaterThan(0);
    expect(body.injury.module.label).toMatch(/ACL/i);
  });

  it("returns null when no active injury", async () => {
    queryHandler = () => [];
    const res = await GET();
    const body = await res.json();
    expect(body.injury).toBeNull();
  });
});

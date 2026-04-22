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

import { GET, POST } from "@/app/api/nutrition/mode/route";
import { NextRequest } from "next/server";

function makePost(body: unknown) {
  return new NextRequest("http://localhost/api/nutrition/mode", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function profileRow(overrides: Record<string, unknown> = {}) {
  return {
    deficit_mode: "standard",
    estimated_bf_pct: 23.5,
    aggressive_phase_start: null,
    reverse_diet_start: null,
    deficit_phase_start_date: null,
    ...overrides,
  };
}

describe("GET /api/nutrition/mode", () => {
  beforeEach(() => {
    executedQueries.length = 0;
    queryHandler = (query) => {
      if (query.includes("FROM nutrition_profile")) return [profileRow()];
      return [];
    };
  });

  it("returns current mode + config + availableTransitions", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.current).toBe("standard");
    expect(body.config).toBeDefined();
    expect(body.config.tierAllowed).toContain("T2");
    expect(body.availableTransitions).toBeDefined();
    // Switching to maintenance at T2 (BF 23.5) is always allowed.
    expect(body.availableTransitions.maintenance.allowed).toBe(true);
    // Current mode itself isn't a transition — excluded from the map.
    expect(body.availableTransitions.standard).toBeUndefined();
  });

  it("at T3 with lean BF%, Aggressive is blocked with tier reason", async () => {
    queryHandler = (query) => {
      if (query.includes("FROM nutrition_profile")) {
        return [profileRow({ estimated_bf_pct: 17.0 })];
      }
      return [];
    };
    const res = await GET();
    const body = await res.json();
    expect(body.availableTransitions.aggressive.allowed).toBe(false);
    expect(body.availableTransitions.aggressive.reason).toBe("mode_not_available");
  });

  it("returns 404 when no profile exists", async () => {
    queryHandler = () => [];
    const res = await GET();
    expect(res.status).toBe(404);
  });

  it("returns 400 when estimated_bf_pct missing", async () => {
    queryHandler = () => [profileRow({ estimated_bf_pct: null })];
    const res = await GET();
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/bf/i);
  });
});

describe("POST /api/nutrition/mode", () => {
  beforeEach(() => {
    executedQueries.length = 0;
    queryHandler = (query) => {
      if (query.includes("FROM nutrition_profile")) return [profileRow()];
      if (query.includes("UPDATE nutrition_profile")) return [];
      return [];
    };
  });

  it("rejects unknown mode with 400", async () => {
    const res = await POST(makePost({ mode: "bogus" }));
    expect(res.status).toBe(400);
  });

  it("rejects missing mode with 400", async () => {
    const res = await POST(makePost({}));
    expect(res.status).toBe(400);
  });

  it("standard → maintenance succeeds and updates deficit_mode", async () => {
    const res = await POST(makePost({ mode: "maintenance" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.current).toBe("maintenance");
    // Some UPDATE statement touched deficit_mode.
    const updated = executedQueries.find((q) =>
      q.query.includes("UPDATE nutrition_profile") &&
      q.query.includes("deficit_mode"),
    );
    expect(updated).toBeDefined();
  });

  it("standard → aggressive at T3 BF 17 returns 409 with mode_not_available", async () => {
    queryHandler = (query) => {
      if (query.includes("FROM nutrition_profile")) {
        return [profileRow({ estimated_bf_pct: 17.0 })];
      }
      return [];
    };
    const res = await POST(makePost({ mode: "aggressive" }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.reason).toBe("mode_not_available");
  });

  it("standard → bulk returns 409 with requires_reverse_bridge + requires_bridge=reverse", async () => {
    const res = await POST(makePost({ mode: "bulk" }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.reason).toBe("requires_reverse_bridge");
    expect(body.requires_bridge).toBe("reverse");
  });

  it("aggressive → standard returns 409 with aggressive_requires_reverse", async () => {
    queryHandler = (query) => {
      if (query.includes("FROM nutrition_profile")) {
        return [profileRow({ deficit_mode: "aggressive" })];
      }
      return [];
    };
    const res = await POST(makePost({ mode: "standard" }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.reason).toBe("aggressive_requires_reverse");
  });

  it("entering aggressive stamps aggressive_phase_start", async () => {
    // T2, BF 22 — aggressive allowed.
    queryHandler = (query) => {
      if (query.includes("FROM nutrition_profile")) {
        return [profileRow({ estimated_bf_pct: 22.0 })];
      }
      return [];
    };
    const res = await POST(makePost({ mode: "aggressive" }));
    expect(res.status).toBe(200);
    const stamped = executedQueries.find((q) =>
      q.query.includes("UPDATE nutrition_profile") &&
      q.query.includes("aggressive_phase_start"),
    );
    expect(stamped).toBeDefined();
  });

  it("entering reverse stamps reverse_diet_start", async () => {
    queryHandler = (query) => {
      if (query.includes("FROM nutrition_profile")) {
        return [profileRow({ deficit_mode: "aggressive", estimated_bf_pct: 22.0 })];
      }
      return [];
    };
    const res = await POST(makePost({ mode: "reverse" }));
    expect(res.status).toBe(200);
    const stamped = executedQueries.find((q) =>
      q.query.includes("UPDATE nutrition_profile") &&
      q.query.includes("reverse_diet_start"),
    );
    expect(stamped).toBeDefined();
  });

  it("same-mode POST is a no-op success", async () => {
    const res = await POST(makePost({ mode: "standard" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.current).toBe("standard");
    // No UPDATE should have been issued for a no-op.
    const updated = executedQueries.find((q) =>
      q.query.includes("UPDATE nutrition_profile"),
    );
    expect(updated).toBeUndefined();
  });
});

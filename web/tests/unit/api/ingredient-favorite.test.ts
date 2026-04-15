import { describe, it, expect, vi, beforeEach } from "vitest";

type QueryHandler = (query: string, values: unknown[]) => unknown[];
let queryHandler: QueryHandler = () => [];

vi.mock("@/lib/db", () => ({
  getDb: () => (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.join("?");
    return Promise.resolve(queryHandler(query, values));
  },
}));

import { PATCH } from "@/app/api/nutrition/ingredient/[id]/route";
import { NextRequest } from "next/server";

function makeReq(id: string, body: unknown) {
  return new NextRequest(`http://localhost/api/nutrition/ingredient/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe("PATCH /api/nutrition/ingredient/:id", () => {
  beforeEach(() => {
    queryHandler = (query) => {
      if (query.includes("UPDATE ingredients")) {
        return [{ id: "chicken_breast", is_favorite: true }];
      }
      return [];
    };
  });

  it("rejects missing is_favorite", async () => {
    const res = await PATCH(makeReq("foo", {}), params("foo"));
    expect(res.status).toBe(400);
  });

  it("rejects non-boolean is_favorite", async () => {
    const res = await PATCH(makeReq("foo", { is_favorite: "yes" }), params("foo"));
    expect(res.status).toBe(400);
  });

  it("returns 404 when ingredient not found", async () => {
    queryHandler = () => []; // UPDATE returns no rows
    const res = await PATCH(makeReq("missing", { is_favorite: true }), params("missing"));
    expect(res.status).toBe(404);
  });

  it("toggles favorite and returns status", async () => {
    const res = await PATCH(makeReq("chicken_breast", { is_favorite: true }), params("chicken_breast"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.is_favorite).toBe(true);
  });

  it("accepts unfavoriting (false)", async () => {
    queryHandler = () => [{ id: "chicken_breast", is_favorite: false }];
    const res = await PATCH(makeReq("chicken_breast", { is_favorite: false }), params("chicken_breast"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.is_favorite).toBe(false);
  });
});

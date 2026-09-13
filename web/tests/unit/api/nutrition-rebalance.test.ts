import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockSql } = vi.hoisted(() => ({ mockSql: vi.fn() }));
vi.mock("@/lib/db", () => ({ getDb: () => mockSql }));

import { POST } from "@/app/api/nutrition/rebalance/route";

function req(body: string | null, contentType = "application/json"): NextRequest {
  return new NextRequest("http://localhost/api/nutrition/rebalance", {
    method: "POST",
    headers: { "content-type": contentType },
    body: body ?? undefined,
  });
}

describe("POST /api/nutrition/rebalance", () => {
  it("answers 400 on an empty body instead of throwing at JSON.parse", async () => {
    const res = await POST(req(null));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/body/i);
  });

  it("answers 400 on a body that is not JSON", async () => {
    const res = await POST(req("not json"));
    expect(res.status).toBe(400);
  });

  it("answers 400 when date is missing", async () => {
    const res = await POST(req(JSON.stringify({ changedSlot: "lunch" })));
    expect(res.status).toBe(400);
  });

  it("answers no changes when the day has no target", async () => {
    mockSql.mockResolvedValue([]);
    const res = await POST(req(JSON.stringify({ date: "2026-09-13", changedSlot: "lunch", lockedSlots: [] })));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ changes: [] });
  });
});

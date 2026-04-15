import { describe, it, expect, vi, beforeEach } from "vitest";

const { generateObjectMock } = vi.hoisted(() => ({
  generateObjectMock: vi.fn(),
}));

vi.mock("ai", () => ({
  generateObject: generateObjectMock,
}));

import { POST } from "@/app/api/nutrition/parse-nl/route";
import { NextRequest } from "next/server";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/nutrition/parse-nl", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/nutrition/parse-nl", () => {
  beforeEach(() => {
    generateObjectMock.mockReset();
  });

  it("rejects empty text", async () => {
    const res = await POST(makeReq({ text: "" }));
    expect(res.status).toBe(400);
  });

  it("rejects non-string body", async () => {
    const res = await POST(makeReq({ text: 123 }));
    expect(res.status).toBe(400);
  });

  it("returns parsed items when AI responds", async () => {
    generateObjectMock.mockResolvedValue({
      object: {
        items: [
          { name: "Chicken Breast", grams: 200, calories: 330, protein: 62, carbs: 0, fat: 7, fiber: 0 },
          { name: "White Rice (cooked)", grams: 160, calories: 210, protein: 4, carbs: 46, fat: 0.5, fiber: 0.6 },
        ],
      },
    });
    const res = await POST(makeReq({ text: "200g chicken and a cup of rice" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(2);
    expect(body.items[0].name).toBe("Chicken Breast");
    expect(body.items[0].grams).toBe(200);
  });

  it("returns 503 when AI Gateway is not configured", async () => {
    generateObjectMock.mockRejectedValue(new Error("Missing API key"));
    const res = await POST(makeReq({ text: "just testing" }));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toMatch(/AI Gateway not configured/);
  });

  it("returns 500 for other AI failures", async () => {
    generateObjectMock.mockRejectedValue(new Error("upstream timeout"));
    const res = await POST(makeReq({ text: "just testing" }));
    expect(res.status).toBe(500);
  });

  it("passes temperature=0 for deterministic output", async () => {
    generateObjectMock.mockResolvedValue({
      object: { items: [{ name: "Test", grams: 100, calories: 100, protein: 10, carbs: 10, fat: 5, fiber: 0 }] },
    });
    await POST(makeReq({ text: "hello" }));
    const callArgs = generateObjectMock.mock.calls[0][0];
    expect(callArgs.temperature).toBe(0);
    expect(callArgs.model).toBe("anthropic/claude-opus-4-6");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST as loginPost } from "@/app/api/auth/login/route";
import { POST as logoutPost } from "@/app/api/auth/logout/route";
import { NextRequest } from "next/server";

function makeReq(path: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    vi.stubEnv("MACROENGINE_PASSWORD", "correct-horse-battery");
    vi.stubEnv("MACROENGINE_SECRET", "x".repeat(40));
  });

  it("returns 401 on wrong password", async () => {
    const res = await loginPost(makeReq("/api/auth/login", { password: "wrong" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 on missing password", async () => {
    const res = await loginPost(makeReq("/api/auth/login", {}));
    expect(res.status).toBe(400);
  });

  it("sets me_session cookie on correct password", async () => {
    const res = await loginPost(makeReq("/api/auth/login", { password: "correct-horse-battery" }));
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie");
    expect(cookie).toMatch(/me_session=v1\.\d+\.[A-Za-z0-9_-]+/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=lax/i);
  });
});

describe("POST /api/auth/logout", () => {
  it("clears the me_session cookie", async () => {
    const res = await logoutPost();
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toMatch(/me_session=;.*Max-Age=0/);
  });
});

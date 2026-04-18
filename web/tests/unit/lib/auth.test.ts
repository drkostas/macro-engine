import { describe, it, expect, beforeEach, vi } from "vitest";
import { signSession, verifySession } from "@/lib/auth";

const SECRET = "test-secret-at-least-32-bytes-long-zzzzzzz";

describe("signSession + verifySession", () => {
  beforeEach(() => {
    vi.stubEnv("MACROENGINE_SECRET", SECRET);
  });

  it("round-trips a valid session cookie", async () => {
    const cookie = await signSession();
    expect(cookie).toMatch(/^v1\.\d+\.[A-Za-z0-9_-]+$/);
    expect(await verifySession(cookie)).toBe(true);
  });

  it("rejects null cookie", async () => {
    expect(await verifySession(null)).toBe(false);
  });

  it("rejects malformed cookie", async () => {
    expect(await verifySession("garbage")).toBe(false);
    expect(await verifySession("v1.123")).toBe(false);
    expect(await verifySession("v2.123.abc")).toBe(false);
  });

  it("rejects tampered cookie", async () => {
    const cookie = await signSession();
    const parts = cookie.split(".");
    parts[1] = String(Number(parts[1]) + 1);
    expect(await verifySession(parts.join("."))).toBe(false);
  });

  it("rejects when signature bytes are tampered", async () => {
    const cookie = await signSession();
    const parts = cookie.split(".");
    const sig = parts[2];
    // Flip one character in the signature. Pick a different char in the same
    // allowed alphabet so the regex still matches and we exercise the
    // constant-time compare branch rather than the format-check early exit.
    const first = sig[0];
    const replacement = first === "A" ? "B" : "A";
    parts[2] = replacement + sig.slice(1);
    expect(await verifySession(parts.join("."))).toBe(false);
  });

  it("rejects expired cookie (older than 30 days)", async () => {
    const ts = Math.floor(Date.now() / 1000) - 31 * 86400;
    const cookie = await signSession(ts);
    expect(await verifySession(cookie)).toBe(false);
  });

  it("rejects when SECRET is unset", async () => {
    vi.stubEnv("MACROENGINE_SECRET", "");
    await expect(signSession()).rejects.toThrow(/MACROENGINE_SECRET/);
  });

  it("rejects when SECRET is too short", async () => {
    vi.stubEnv("MACROENGINE_SECRET", "shortkey10");
    await expect(signSession()).rejects.toThrow(/at least 32/);
  });
});

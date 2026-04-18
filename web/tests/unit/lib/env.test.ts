import { describe, it, expect, vi } from "vitest";
import { assertProdEnv } from "@/lib/env";

describe("assertProdEnv", () => {
  it("passes when all required vars are set in prod", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "postgresql://x");
    vi.stubEnv("MACROENGINE_PASSWORD", "please-change-me-0000");
    vi.stubEnv("MACROENGINE_SECRET", "please-change-me-0000-rand-00000000");
    expect(() => assertProdEnv()).not.toThrow();
  });

  it("throws when DATABASE_URL missing in prod", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("MACROENGINE_PASSWORD", "x".repeat(20));
    vi.stubEnv("MACROENGINE_SECRET", "x".repeat(40));
    expect(() => assertProdEnv()).toThrow(/DATABASE_URL/);
  });

  it("throws when MACROENGINE_SECRET too short", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "postgresql://x");
    vi.stubEnv("MACROENGINE_PASSWORD", "x".repeat(20));
    vi.stubEnv("MACROENGINE_SECRET", "short");
    expect(() => assertProdEnv()).toThrow(/MACROENGINE_SECRET/);
  });

  it("is a no-op in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DATABASE_URL", "");
    expect(() => assertProdEnv()).not.toThrow();
  });
});

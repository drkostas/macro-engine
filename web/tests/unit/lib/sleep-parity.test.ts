import { describe, it, expect } from "vitest";
import { classifySleepQuality } from "@macro-engine/core/sleep";
import golden from "../../fixtures/golden_sleep.json";

describe("classifySleepQuality — Python parity", () => {
  it("matches all golden cases", () => {
    const bad: string[] = [];
    for (const c of golden as Array<{ in: any; out: number }>) {
      const got = classifySleepQuality(c.in.totalSeconds, c.in.deepSeconds, c.in.garminScore);
      if (Math.abs(got - c.out) > 1e-9) bad.push(`in=${JSON.stringify(c.in)} exp=${c.out} got=${got}`);
    }
    if (bad.length) throw new Error(`${bad.length} mismatch:\n${bad.slice(0,5).join("\n")}`);
    expect(bad.length).toBe(0);
  });
});

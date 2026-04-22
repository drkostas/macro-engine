/**
 * M8 Phase A — Hydration TypeScript mirror tests.
 * Source-of-truth: tests/test_hydration.py
 */

import { describe, expect, it } from "vitest";
import {
  computeSodiumTarget,
  computeWaterTarget,
  effectiveHydration,
  isHyponatremiaRisk,
} from "@/lib/hydration";

describe("M8.1 Water target", () => {
  it("74.2 kg → 2078 / 2597", () => {
    const r = computeWaterTarget(74.2);
    expect(r.beverageMl).toBe(2078);
    expect(r.totalMl).toBe(2597);
  });

  it("60 kg → 1680 / 2100", () => {
    const r = computeWaterTarget(60);
    expect(r.beverageMl).toBe(1680);
    expect(r.totalMl).toBe(2100);
  });

  it("scales linearly", () => {
    const a = computeWaterTarget(50);
    const b = computeWaterTarget(100);
    expect(b.beverageMl).toBe(a.beverageMl * 2);
  });

  it("throws on non-positive weight", () => {
    expect(() => computeWaterTarget(0)).toThrow(RangeError);
    expect(() => computeWaterTarget(-1)).toThrow(RangeError);
  });
});

describe("M8.2 Sodium target", () => {
  it("rest baseline = 1500", () => {
    expect(computeSodiumTarget()).toBe(1500);
  });

  it("rest ceiling caps at 2300", () => {
    expect(computeSodiumTarget({ manualRestMg: 3000 })).toBe(2300);
  });

  it("1.0 L sweat → 2450", () => {
    expect(computeSodiumTarget({ sweatL: 1.0 })).toBe(2450);
  });

  it("1.5 L sweat → 2925", () => {
    expect(computeSodiumTarget({ sweatL: 1.5 })).toBe(2925);
  });

  it("athletic bypasses rest ceiling", () => {
    expect(computeSodiumTarget({ sweatL: 2.0 })).toBe(3400);
  });

  it("throws on negative sweat", () => {
    expect(() => computeSodiumTarget({ sweatL: -0.1 })).toThrow(RangeError);
  });
});

describe("M8.3 Hyponatremia", () => {
  it("high flow, no sodium, 3+ hours → true", () => {
    expect(isHyponatremiaRisk({
      waterMlPerHour: 1200, hours: 4, sodiumMgPerHour: 0,
    })).toBe(true);
  });

  it("short duration → false", () => {
    expect(isHyponatremiaRisk({
      waterMlPerHour: 1200, hours: 2, sodiumMgPerHour: 0,
    })).toBe(false);
  });

  it("adequate sodium → false", () => {
    expect(isHyponatremiaRisk({
      waterMlPerHour: 1200, hours: 4, sodiumMgPerHour: 300,
    })).toBe(false);
  });

  it("low flow → false", () => {
    expect(isHyponatremiaRisk({
      waterMlPerHour: 800, hours: 4, sodiumMgPerHour: 0,
    })).toBe(false);
  });

  it("boundary exactly 1000 counts", () => {
    expect(isHyponatremiaRisk({
      waterMlPerHour: 1000, hours: 3, sodiumMgPerHour: 0,
    })).toBe(true);
  });
});

describe("M8.4 Effective hydration", () => {
  it("plain water", () => {
    expect(effectiveHydration(500, { ethanolG: 0, caffeineMg: 0 })).toBe(500);
  });

  it("alcohol penalty -10 mL/g", () => {
    expect(effectiveHydration(500, { ethanolG: 20, caffeineMg: 0 })).toBe(300);
  });

  it("caffeine ≤ 500 fully counts", () => {
    expect(effectiveHydration(500, { ethanolG: 0, caffeineMg: 400 })).toBe(500);
  });

  it("caffeine > 500: excess at half", () => {
    expect(effectiveHydration(1000, { ethanolG: 0, caffeineMg: 700 })).toBe(900);
  });

  it("combined alcohol + caffeine", () => {
    expect(effectiveHydration(500, { ethanolG: 20, caffeineMg: 400 })).toBe(300);
  });

  it("floors at zero", () => {
    expect(effectiveHydration(100, { ethanolG: 20, caffeineMg: 0 })).toBe(0);
  });
});

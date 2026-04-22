/**
 * M9 Phase E — Climate adjustments TypeScript mirror tests.
 * Source-of-truth: tests/test_climate.py
 */

import { describe, expect, it } from "vitest";
import { climateAdjust } from "@/lib/climate";

describe("M9E normal", () => {
  it("zero adjustments", () => {
    const adj = climateAdjust("normal", { weightKg: 70, sex: "M" });
    expect(adj.extraFluidMl).toBe(0);
    expect(adj.extraSodiumMg).toBe(0);
    expect(adj.extraKcal).toBe(0);
    expect(adj.extraCarbG).toBe(0);
    expect(adj.ironTargetMg).toBeNull();
  });
});

describe("M9E altitude", () => {
  it("male iron 10-15", () => {
    const adj = climateAdjust("altitude", { weightKg: 70, sex: "M" });
    expect(adj.ironTargetMg).toBeGreaterThanOrEqual(10);
    expect(adj.ironTargetMg).toBeLessThanOrEqual(15);
  });
  it("female iron 18", () => {
    const adj = climateAdjust("altitude", { weightKg: 60, sex: "F" });
    expect(adj.ironTargetMg).toBe(18);
  });
  it("fluid +500 mL", () => {
    const adj = climateAdjust("altitude", { weightKg: 70, sex: "M" });
    expect(adj.extraFluidMl).toBe(500);
  });
  it("carb +1 g/kg", () => {
    const adj = climateAdjust("altitude", { weightKg: 70, sex: "M" });
    expect(adj.extraCarbG).toBe(70);
  });
});

describe("M9E heat", () => {
  it("1L/h × 1h → 1000 mL + 750 mg Na", () => {
    const adj = climateAdjust("heat", {
      weightKg: 70, sex: "M", sweatLPerHour: 1.0, hours: 1.0,
    });
    expect(adj.extraFluidMl).toBe(1000);
    expect(adj.extraSodiumMg).toBe(750);
  });
  it("1.5 L/h × 2h → 3000 mL + 2250 mg Na", () => {
    const adj = climateAdjust("heat", {
      weightKg: 70, sex: "M", sweatLPerHour: 1.5, hours: 2.0,
    });
    expect(adj.extraFluidMl).toBe(3000);
    expect(adj.extraSodiumMg).toBe(2250);
  });
  it("defaults to 1L/h × 1h when unspecified", () => {
    const adj = climateAdjust("heat", { weightKg: 70, sex: "M" });
    expect(adj.extraFluidMl).toBe(1000);
    expect(adj.extraSodiumMg).toBe(750);
  });
});

describe("M9E cold", () => {
  it("kcal bump = 10% of provided BMR", () => {
    const adj = climateAdjust("cold", {
      weightKg: 70, sex: "M", bmrKcal: 1800,
    });
    expect(adj.extraKcal).toBe(180);
  });
  it("without BMR → positive bump", () => {
    const adj = climateAdjust("cold", { weightKg: 70, sex: "M" });
    expect(adj.extraKcal).toBeGreaterThan(0);
    expect(adj.extraKcal).toBeLessThan(300);
  });
});

describe("M9E validation", () => {
  it("negative weight throws", () => {
    expect(() => climateAdjust("normal", { weightKg: -1, sex: "M" })).toThrow(RangeError);
  });
  it("unknown sex throws", () => {
    expect(() => climateAdjust("altitude", { weightKg: 70, sex: "X" as "M" })).toThrow();
  });
  it("negative sweat throws", () => {
    expect(() =>
      climateAdjust("heat", { weightKg: 70, sex: "M", sweatLPerHour: -1, hours: 1 }),
    ).toThrow(RangeError);
  });
});

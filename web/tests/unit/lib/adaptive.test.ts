/**
 * M5 Phase A — Adaptive Systems TypeScript mirror tests.
 * Source-of-truth: tests/test_adaptive.py
 */

import { describe, expect, it } from "vitest";
import {
  computeAdaptiveTdee,
  computeRefeedPressureScore,
  detectPlateau,
  recommendDietBreak,
  type DietBreakLevel,
  type PlateauType,
} from "@/lib/adaptive";
import type { DayPoint } from "@/lib/body-comp";

const flat = (n: number, intake: number, w: number, tdee: number): DayPoint[] =>
  Array.from({ length: n }, (_, i) => ({
    day: i, intakeKcal: intake, tdeeKcal: tdee, weightKg: w,
  }));

const losing = (n: number, intake: number, start: number, dayLoss: number, tdee: number): DayPoint[] =>
  Array.from({ length: n }, (_, i) => ({
    day: i, intakeKcal: intake, tdeeKcal: tdee, weightKg: start - dayLoss * i,
  }));

describe("M5.1 Adaptive TDEE", () => {
  it("short history → null", () => {
    expect(computeAdaptiveTdee(flat(5, 2500, 74, 2500))).toBeNull();
  });

  it("steady-state ≈ avg intake", () => {
    const r = computeAdaptiveTdee(flat(14, 2500, 74, 2500));
    expect(r).not.toBeNull();
    expect(r!.effectiveTdee).toBeCloseTo(2500, -1);
    expect(r!.driftFlag).toBe(false);
  });

  it("losing weight infers higher TDEE", () => {
    const r = computeAdaptiveTdee(losing(14, 2000, 74, 1.0 / 14, 2500));
    expect(r!.effectiveTdee).toBeGreaterThanOrEqual(2500);
    expect(r!.effectiveTdee).toBeLessThanOrEqual(2600);
  });

  it("drift flag fires on sustained discrepancy", () => {
    const hist: DayPoint[] = Array.from({ length: 14 }, (_, i) => ({
      day: i, intakeKcal: 2000, tdeeKcal: 2000, weightKg: 74 - (1.0 / 14) * i,
    }));
    const r = computeAdaptiveTdee(hist);
    expect(r!.discrepancyPct).toBeGreaterThan(10);
    expect(r!.driftFlag).toBe(true);
  });
});

describe("M5.2 Refeed Pressure Score", () => {
  it("zero signals → 0", () => {
    const rps = computeRefeedPressureScore({
      deficitDays: 0, weightStallDays: 0,
      hrv7dTrendPct: 0, readinessAvg: 80,
      bfTier: "T2", weightLossVelocityPctPerWk: 0.5,
    });
    expect(rps).toBe(0);
  });

  it("all maxed clamps to 100", () => {
    const rps = computeRefeedPressureScore({
      deficitDays: 100, weightStallDays: 30,
      hrv7dTrendPct: -15, readinessAvg: 30,
      bfTier: "T4", weightLossVelocityPctPerWk: 2.0,
    });
    expect(rps).toBe(100);
  });

  it("threshold ≥ 60 for high-pressure case", () => {
    const rps = computeRefeedPressureScore({
      deficitDays: 56, weightStallDays: 12,
      hrv7dTrendPct: -10, readinessAvg: 50,
      bfTier: "T3", weightLossVelocityPctPerWk: 1.3,
    });
    expect(rps).toBeGreaterThanOrEqual(60);
  });

  it("monotonic in deficit days", () => {
    const base = {
      weightStallDays: 0, hrv7dTrendPct: 0,
      readinessAvg: 80, bfTier: "T2" as const,
      weightLossVelocityPctPerWk: 0.5,
    };
    const a = computeRefeedPressureScore({ ...base, deficitDays: 10 });
    const b = computeRefeedPressureScore({ ...base, deficitDays: 30 });
    const c = computeRefeedPressureScore({ ...base, deficitDays: 56 });
    expect(a).toBeLessThanOrEqual(b);
    expect(b).toBeLessThanOrEqual(c);
  });
});

describe("M5.3 Diet Break", () => {
  it.each([
    [0, "none"], [55, "none"],
    [56, "suggested"], [70, "suggested"], [83, "suggested"],
    [84, "strong"], [111, "strong"],
    [112, "mandatory"], [200, "mandatory"],
  ] as [number, DietBreakLevel][])(
    "day %d → %s",
    (days, expected) => {
      expect(recommendDietBreak(days)).toBe(expected);
    },
  );

  it("never decreases as days increase", () => {
    const order = { none: 0, suggested: 1, strong: 2, mandatory: 3 };
    let prev = -1;
    for (let d = 0; d < 200; d += 5) {
      const level = order[recommendDietBreak(d)];
      expect(level).toBeGreaterThanOrEqual(prev);
      prev = level;
    }
  });
});

describe("M5.4 Plateau Detection", () => {
  it("short history → not plateau", () => {
    const r = detectPlateau(flat(10, 2000, 74, 2500), { tdeeStable: true });
    expect(r.isPlateau).toBe(false);
  });

  it("losing weight → not plateau", () => {
    const r = detectPlateau(losing(30, 2000, 74, 0.1, 2500), { tdeeStable: true });
    expect(r.isPlateau).toBe(false);
  });

  it("flat weight for 25 days → plateau", () => {
    const r = detectPlateau(flat(25, 2000, 74, 2500), { tdeeStable: true });
    expect(r.isPlateau).toBe(true);
    expect(r.type).toBe("intake_creep");
  });

  it("flat + hunger_elevated → adaptation", () => {
    const r = detectPlateau(flat(25, 2000, 74, 2500), {
      tdeeStable: true, hungerElevated: true,
    });
    expect(r.type).toBe("adaptation");
  });

  it("strength improving → recomp, not plateau", () => {
    const r = detectPlateau(flat(25, 2000, 74, 2500), {
      tdeeStable: true, strengthImproving: true,
    });
    expect(r.type).toBe("recomp");
    expect(r.isPlateau).toBe(false);
  });

  it("tdee unstable gates plateau", () => {
    const r = detectPlateau(flat(25, 2000, 74, 2500), { tdeeStable: false });
    expect(r.isPlateau).toBe(false);
  });
});

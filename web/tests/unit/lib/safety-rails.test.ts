/**
 * M1 Safety Rails — TypeScript mirror tests (parity with Python canonical).
 */

import { describe, it, expect } from "vitest";
import {
  // Tier
  computeTierRaw, computeTier, rollingMedianBf, getTierPolicy,
  // BMR
  cunningham, mifflinStJeor, tenHaafWeight, computeBmr,
  // Floor
  computeFloor, applyFloor, REDS_EA_COEFFICIENT,
  // Rate cap
  getRateCap, computeWeeklyRatePct, checkRateCap,
  // Fat floor
  computeFatFloor, applyFatFloor,
  // Protein floor
  computeProteinFloor, checkProteinFloor, checkPerMealProtein,
  // Deficit duration
  computeCounter, getThresholds, classifyCounter,
  DEFICIT_RATIO_THRESHOLD,
  type DayEntry,
} from "@/lib/safety-rails";

// ==================== TIER ====================

describe("computeTierRaw", () => {
  it("assigns T1 for >= 28%", () => {
    expect(computeTierRaw(30.0)).toBe("T1");
    expect(computeTierRaw(28.0)).toBe("T1");
  });
  it("assigns T2 for 20-28%", () => {
    expect(computeTierRaw(27.9)).toBe("T2");
    expect(computeTierRaw(23.5)).toBe("T2"); // current user
    expect(computeTierRaw(20.0)).toBe("T2");
  });
  it("assigns T3 for 15-20%", () => {
    expect(computeTierRaw(19.9)).toBe("T3");
    expect(computeTierRaw(15.0)).toBe("T3");
  });
  it("assigns T4 for 10-15%", () => {
    expect(computeTierRaw(14.9)).toBe("T4");
    expect(computeTierRaw(10.0)).toBe("T4");
  });
  it("assigns T5 for <10%", () => {
    expect(computeTierRaw(9.9)).toBe("T5");
  });
});

describe("computeTier (hysteresis)", () => {
  it("uses raw when no previous tier", () => {
    expect(computeTier(23.5)).toBe("T2");
  });
  it("stays in range", () => {
    expect(computeTier(23.5, "T2")).toBe("T2");
  });
  it("requires buffer going leaner", () => {
    expect(computeTier(19.5, "T2")).toBe("T2"); // inside buffer
    expect(computeTier(19.0, "T2")).toBe("T3"); // clears buffer
  });
  it("requires buffer going fatter", () => {
    expect(computeTier(20.5, "T3")).toBe("T3"); // inside
    expect(computeTier(21.0, "T3")).toBe("T2"); // clears
  });
});

describe("rollingMedianBf", () => {
  it("median of 3 odd", () => { expect(rollingMedianBf([23, 24, 22])).toBe(23); });
  it("single reading", () => { expect(rollingMedianBf([23])).toBe(23); });
  it("two readings averaged", () => { expect(rollingMedianBf([23, 25])).toBe(24); });
  it("empty throws", () => { expect(() => rollingMedianBf([])).toThrow(); });
});

describe("getTierPolicy", () => {
  it("T2 current user caps", () => {
    const p = getTierPolicy("T2");
    expect(p.rateCapSoftPctPerWk).toBe(0.75);
    expect(p.rateCapHardPctPerWk).toBe(1.0);
    expect(p.aggressiveModeAllowed).toBe(true);
  });
  it("T3 blocks aggressive", () => {
    expect(getTierPolicy("T3").aggressiveModeAllowed).toBe(false);
  });
  it("T4+ uses LBM basis", () => {
    expect(getTierPolicy("T4").proteinGPerKgLbmBasis).toBe(true);
    expect(getTierPolicy("T5").proteinGPerKgLbmBasis).toBe(true);
  });
});

// ==================== BMR ====================

describe("cunningham", () => {
  it("current user FFM 60.6 → 1833", () => {
    expect(cunningham(60.6)).toBe(1833);
  });
  it("throws on non-positive", () => { expect(() => cunningham(0)).toThrow(); });
});

describe("mifflinStJeor", () => {
  it("male user 74.2/177/31", () => {
    expect(mifflinStJeor(74.2, 177, 31, "male")).toBe(1698);
  });
  it("female", () => {
    expect(mifflinStJeor(60, 165, 30, "female")).toBe(1320);
  });
});

describe("tenHaafWeight", () => {
  it("male user produces athlete BMR in 1750-1900 range", () => {
    const r = tenHaafWeight(74.2, 177, 31, "male");
    expect(r).toBeGreaterThanOrEqual(1750);
    expect(r).toBeLessThanOrEqual(1900);
  });
});

describe("computeBmr", () => {
  it("prefers Cunningham with FFM", () => {
    expect(computeBmr({ ffmKg: 60.6 })).toBe(1833);
  });
  it("falls back to ten Haaf without FFM", () => {
    const r = computeBmr({ weightKg: 74.2, heightCm: 177, age: 31, sex: "male" });
    expect(r).toBe(tenHaafWeight(74.2, 177, 31, "male"));
  });
  it("throws with insufficient inputs", () => {
    expect(() => computeBmr({ weightKg: 74.2 })).toThrow();
  });
});

// ==================== FLOOR ====================

describe("computeFloor", () => {
  it("REDS coefficient is 25", () => { expect(REDS_EA_COEFFICIENT).toBe(25); });
  it("standard rest day: soft=hard=Cunningham", () => {
    const r = computeFloor(60.6, 0, "standard");
    expect(r.softFloor).toBe(1833);
    expect(r.hardFloor).toBe(1833);
  });
  it("standard training day: EA dominates", () => {
    const r = computeFloor(60.6, 400, "standard");
    expect(r.softFloor).toBe(1833);
    expect(r.hardFloor).toBe(1915);
  });
  it("aggressive drops Cunningham", () => {
    expect(computeFloor(60.6, 0, "aggressive").hardFloor).toBe(1515);
  });
});

describe("applyFloor", () => {
  it("above both floors no breach", () => {
    expect(applyFloor(2000, 60.6, 0, "standard").breachType).toBe("none");
  });
  it("below hard is raised", () => {
    const r = applyFloor(1700, 60.6, 400, "standard");
    expect(r.breachType).toBe("hard");
    expect(r.targetKcal).toBe(1915);
  });
  it("aggressive allows below Cunningham", () => {
    const r = applyFloor(1600, 60.6, 0, "aggressive");
    expect(r.breachType).toBe("soft");
    expect(r.targetKcal).toBe(1600);
  });
});

// ==================== RATE CAP ====================

describe("getRateCap", () => {
  it("T2 standard 0.75/1.0", () => {
    const c = getRateCap("T2", "standard");
    expect(c.softPctPerWk).toBe(0.75);
    expect(c.hardPctPerWk).toBe(1.0);
  });
  it("T2 aggressive loosens to T1 caps", () => {
    const c = getRateCap("T2", "aggressive");
    expect(c.softPctPerWk).toBe(1.0);
    expect(c.hardPctPerWk).toBe(1.25);
  });
  it("T1 aggressive stays at T1", () => {
    expect(getRateCap("T1", "aggressive").hardPctPerWk).toBe(1.25);
  });
});

describe("computeWeeklyRatePct", () => {
  it("linear 1%/week loss → ~-1", () => {
    const weights = Array.from({ length: 8 }, (_, i) => 74.2 - 0.106 * i);
    const r = computeWeeklyRatePct(weights);
    expect(r).toBeGreaterThan(-1.1);
    expect(r).toBeLessThan(-0.9);
  });
  it("stable near zero", () => {
    expect(Math.abs(computeWeeklyRatePct([74.2, 74.2, 74.2, 74.2]))).toBeLessThan(0.1);
  });
  it("throws on <2", () => { expect(() => computeWeeklyRatePct([74.2])).toThrow(); });
});

describe("checkRateCap", () => {
  const losingWeights = (dailyPct: number, days: number) => {
    const dailyLoss = 74.2 * dailyPct / 100;
    return Array.from({ length: days }, (_, i) => 74.2 - dailyLoss * i);
  };

  it("green at 0.5%/wk", () => {
    const w = losingWeights(0.071, 14);
    expect(checkRateCap(w, "T2", "standard", w[w.length - 1], 30).status).toBe("green");
  });
  it("red at 1.5%/wk sustained (user's current 1.49%)", () => {
    const w = losingWeights(0.213, 14);
    expect(checkRateCap(w, "T2", "standard", w[w.length - 1], 30).status).toBe("red");
  });
  it("suppressed in first 14 days of cut", () => {
    const w = losingWeights(0.3, 14);
    expect(checkRateCap(w, "T2", "standard", w[w.length - 1], 7).status).toBe("suppressed");
  });
  it("aggressive loosens classification", () => {
    const w = losingWeights(0.157, 14); // ~1.1%/wk
    expect(checkRateCap(w, "T2", "standard", w[w.length - 1], 30).status).toBe("red");
    expect(checkRateCap(w, "T2", "aggressive", w[w.length - 1], 30).status).toBe("yellow");
  });
});

// ==================== FAT FLOOR ====================

describe("fat floor", () => {
  it("current user soft=59 hard=45", () => {
    const r = computeFatFloor(74.2, "standard");
    expect(r.softFloorG).toBe(59);
    expect(r.hardFloorG).toBe(45);
  });
  it("maintenance raises soft to 74", () => {
    expect(computeFatFloor(74.2, "maintenance").softFloorG).toBe(74);
  });
  it("applyFatFloor 40g → raised to 45 (hard)", () => {
    expect(applyFatFloor(40, 74.2, "standard").breachType).toBe("hard");
  });
  it("applyFatFloor 55g → soft warn, not raised", () => {
    const r = applyFatFloor(55, 74.2, "standard");
    expect(r.breachType).toBe("soft");
    expect(r.fatG).toBe(55);
  });
  it("applyFatFloor 70g → no breach", () => {
    expect(applyFatFloor(70, 74.2, "standard").breachType).toBe("none");
  });
});

// ==================== PROTEIN FLOOR ====================

describe("protein floor", () => {
  it("current user floor = 119g", () => {
    expect(computeProteinFloor(74.2)).toBe(119);
  });
  it("3+ consecutive below triggers amber", () => {
    expect(checkProteinFloor([150, 145, 100, 90, 80], 74.2).status).toBe("amber");
    expect(checkProteinFloor([150, 145, 100, 90, 80], 74.2).daysBelowFloor).toBe(3);
  });
  it("2 consecutive doesn't trigger", () => {
    expect(checkProteinFloor([150, 145, 100, 90, 140], 74.2).status).toBe("green");
  });
  it("breakdowns in streak", () => {
    expect(checkProteinFloor([100, 90, 150, 80, 85, 90], 74.2).daysBelowFloor).toBe(3);
  });
});

describe("per-meal protein", () => {
  it("<15g red", () => { expect(checkPerMealProtein(14)).toBe("red"); });
  it("15-24 amber", () => { expect(checkPerMealProtein(20)).toBe("amber"); });
  it("25-29 yellow", () => { expect(checkPerMealProtein(27)).toBe("yellow"); });
  it("30-55 green", () => { expect(checkPerMealProtein(40)).toBe("green"); });
  it(">55 no warning (Trommelen 2023)", () => {
    expect(checkPerMealProtein(100)).toBe("no_warning");
  });
});

// ==================== DEFICIT DURATION ====================

describe("deficit duration", () => {
  const days = (intakes: [number, number][]): DayEntry[] =>
    intakes.map(([intakeKcal, tdeeKcal]) => ({ intakeKcal, tdeeKcal }));

  it("DEFICIT_RATIO_THRESHOLD is 0.95", () => {
    expect(DEFICIT_RATIO_THRESHOLD).toBe(0.95);
  });
  it("counts 7 consecutive deficit days", () => {
    expect(computeCounter(days(Array(7).fill([1700, 2500])))).toBe(7);
  });
  it("7+ maintenance days fully reset", () => {
    const history: [number, number][] = [
      ...Array(10).fill([1700, 2500] as [number, number]),
      ...Array(7).fill([2500, 2500] as [number, number]),
      ...Array(3).fill([1700, 2500] as [number, number]),
    ];
    expect(computeCounter(days(history))).toBe(3);
  });
  it("3-6 maintenance half-reset", () => {
    const history: [number, number][] = [
      ...Array(10).fill([1700, 2500] as [number, number]),
      ...Array(5).fill([2500, 2500] as [number, number]),
      ...Array(3).fill([1700, 2500] as [number, number]),
    ];
    expect(computeCounter(days(history))).toBe(8); // (10/2) + 3
  });
  it("1-2 maintenance no reset", () => {
    const history: [number, number][] = [
      ...Array(10).fill([1700, 2500] as [number, number]),
      ...Array(1).fill([2500, 2500] as [number, number]),
      ...Array(3).fill([1700, 2500] as [number, number]),
    ];
    expect(computeCounter(days(history))).toBe(13);
  });
  it("default thresholds at 20% deficit", () => {
    const t = getThresholds(20.0);
    expect(t.softWarnDays).toBe(56);
    expect(t.strongRecommendDays).toBe(84);
    expect(t.hardStopDays).toBe(112);
  });
  it("tightens at >25% deficit", () => {
    expect(getThresholds(30.0).softWarnDays).toBe(28);
  });
  it("extends at <15% deficit", () => {
    expect(getThresholds(10.0).softWarnDays).toBe(84);
  });
  it("classifies correctly", () => {
    const t = { softWarnDays: 56, strongRecommendDays: 84, hardStopDays: 112 };
    expect(classifyCounter(20, t)).toBe("green");
    expect(classifyCounter(56, t)).toBe("warn");
    expect(classifyCounter(84, t)).toBe("strong");
    expect(classifyCounter(112, t)).toBe("hard_stop");
  });
});

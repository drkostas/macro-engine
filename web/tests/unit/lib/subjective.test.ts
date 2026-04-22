/**
 * M7 Phase A — Subjective signals TypeScript mirror tests.
 * Source-of-truth: tests/test_subjective.py
 */

import { describe, expect, it } from "vitest";
import {
  computeHooperAlert,
  computeHooperScore,
  computeWeeklyStrain,
  phq2Score,
  scoffScore,
  sessionStrain,
} from "@/lib/subjective";

describe("M7.1 Hooper score", () => {
  it("all 1s → good", () => {
    const r = computeHooperScore({ fatigue: 1, sleep: 1, stress: 1, soreness: 1 });
    expect(r.total).toBe(4);
    expect(r.quality).toBe("good");
  });

  it("all 7s → poor", () => {
    const r = computeHooperScore({ fatigue: 7, sleep: 7, stress: 7, soreness: 7 });
    expect(r.total).toBe(28);
    expect(r.quality).toBe("poor");
  });

  it("boundary 10 → good", () => {
    const r = computeHooperScore({ fatigue: 2, sleep: 3, stress: 2, soreness: 3 });
    expect(r.total).toBe(10);
    expect(r.quality).toBe("good");
  });

  it("boundary 11 → moderate", () => {
    const r = computeHooperScore({ fatigue: 2, sleep: 3, stress: 3, soreness: 3 });
    expect(r.quality).toBe("moderate");
  });

  it("boundary 18 → poor", () => {
    const r = computeHooperScore({ fatigue: 5, sleep: 5, stress: 4, soreness: 4 });
    expect(r.quality).toBe("poor");
  });

  it("out-of-range throws", () => {
    expect(() =>
      computeHooperScore({ fatigue: 0, sleep: 4, stress: 4, soreness: 4 }),
    ).toThrow(RangeError);
    expect(() =>
      computeHooperScore({ fatigue: 8, sleep: 4, stress: 4, soreness: 4 }),
    ).toThrow(RangeError);
  });
});

describe("M7.2 Hooper alert", () => {
  it("short history → normal", () => {
    const r = computeHooperAlert(15, [12, 13, 14]);
    expect(r.alertLevel).toBe("normal");
    expect(r.zScore).toBe(0);
  });

  it("matches mean → z ≈ 0", () => {
    const r = computeHooperAlert(12, Array(28).fill(12));
    expect(Math.abs(r.zScore)).toBeLessThan(0.01);
    expect(r.alertLevel).toBe("normal");
  });

  it("3σ high alert", () => {
    // 14x (10, 14) → mean=12, std=2
    const hist = Array.from({ length: 28 }, (_, i) => (i % 2 === 0 ? 10 : 14));
    const r = computeHooperAlert(18, hist);
    expect(r.zScore).toBeGreaterThan(2);
    expect(r.alertLevel).toBe("high");
  });

  it("mild elevation", () => {
    const hist = Array.from({ length: 28 }, (_, i) => (i % 2 === 0 ? 10 : 14));
    const r = computeHooperAlert(15, hist);
    expect(r.zScore).toBeGreaterThan(1);
    expect(r.zScore).toBeLessThanOrEqual(2);
    expect(r.alertLevel).toBe("elevated");
  });

  it("zero std → normal", () => {
    const r = computeHooperAlert(20, Array(28).fill(12));
    expect(r.alertLevel).toBe("normal");
  });
});

describe("M7.3 Session + weekly strain", () => {
  it("strain = rpe × duration", () => {
    expect(sessionStrain(7, 60)).toBe(420);
  });

  it("zero duration → 0", () => {
    expect(sessionStrain(8, 0)).toBe(0);
  });

  it("out-of-range rpe throws", () => {
    expect(() => sessionStrain(11, 60)).toThrow(RangeError);
    expect(() => sessionStrain(-1, 60)).toThrow(RangeError);
  });

  it("flat week → high monotony", () => {
    const r = computeWeeklyStrain(Array(7).fill(500));
    expect(r.total).toBe(3500);
    expect(r.monotony).toBe(100);
  });

  it("varied week → low monotony", () => {
    const r = computeWeeklyStrain([100, 900, 200, 800, 300, 700, 400]);
    expect(r.monotony).toBeLessThan(5);
  });

  it("empty week → zeros", () => {
    const r = computeWeeklyStrain([]);
    expect(r).toEqual({ total: 0, monotony: 0, strain: 0 });
  });
});

describe("M7.4 PHQ-2", () => {
  it("zero → 0 no trigger", () => {
    expect(phq2Score(0, 0)).toEqual({ score: 0, triggersPhq9: false });
  });

  it("score 3 triggers", () => {
    expect(phq2Score(2, 1)).toEqual({ score: 3, triggersPhq9: true });
  });

  it("score 2 below threshold", () => {
    expect(phq2Score(1, 1)).toEqual({ score: 2, triggersPhq9: false });
  });

  it("out-of-range throws", () => {
    expect(() => phq2Score(4, 0)).toThrow(RangeError);
    expect(() => phq2Score(-1, 0)).toThrow(RangeError);
  });
});

describe("M7.4 SCOFF", () => {
  const NONE = {
    sickAfterFull: false, worryControl: false, oneStone3mo: false,
    fatWhenThin: false, foodDominates: false,
  };

  it("all false → 0", () => {
    expect(scoffScore(NONE)).toEqual({ score: 0, flagged: false });
  });

  it("one true → not flagged", () => {
    expect(scoffScore({ ...NONE, sickAfterFull: true })).toEqual({
      score: 1, flagged: false,
    });
  });

  it("two true → flagged", () => {
    expect(scoffScore({ ...NONE, sickAfterFull: true, worryControl: true })).toEqual({
      score: 2, flagged: true,
    });
  });

  it("all true → 5, flagged", () => {
    expect(scoffScore({
      sickAfterFull: true, worryControl: true, oneStone3mo: true,
      fatWhenThin: true, foodDominates: true,
    })).toEqual({ score: 5, flagged: true });
  });
});

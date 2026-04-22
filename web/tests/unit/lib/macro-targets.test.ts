/**
 * M4 Phase A — Macro Engine TypeScript mirror tests.
 * Source-of-truth: tests/test_macro_targets.py.
 */

import { describe, expect, it } from "vitest";
import {
  ALL_BANDS,
  carbGPerKg,
  carbTargetG,
  classifyBand,
  computeMacroTargets,
  computeMacroTargetsFromContext,
  computeTrainingLoad,
  fiberTargetG,
  proteinGPerKg,
  type Band,
} from "@/lib/macro-targets";
import { ALL_MODES, type Mode } from "@/lib/mode-engine";

const TIERS = ["T1", "T2", "T3", "T4", "T5"] as const;

describe("M4.1 Training load + band", () => {
  it("zero training → 0", () => {
    expect(computeTrainingLoad(0, 0, { weightKg: 74 })).toBe(0);
  });

  it("short run ~0.5", () => {
    const load = computeTrainingLoad(400, 0, { weightKg: 74 });
    expect(load).toBeGreaterThanOrEqual(0.5);
    expect(load).toBeLessThanOrEqual(0.6);
  });

  it("endurance priority ignores gym", () => {
    const load = computeTrainingLoad(1200, 300, { weightKg: 74 });
    expect(load).toBeCloseTo(1200 / 740, 2);
  });

  it("saturation cap at 4.0 (gym-heavy, sub-priority run)", () => {
    expect(computeTrainingLoad(500, 2500, { weightKg: 74 })).toBe(4.0);
  });

  it("negative kcal throws", () => {
    expect(() => computeTrainingLoad(-1, 0, { weightKg: 74 })).toThrow(RangeError);
  });

  it.each([
    [0, "rest"], [0.5, "light"], [1.0, "light"],
    [1.5, "moderate"], [2.0, "moderate"],
    [2.5, "hard"], [3.0, "hard"],
    [3.5, "very_hard"], [4.0, "very_hard"],
  ] as [number, Band][])(`classifyBand(%s) = %s`, (load, expected) => {
    expect(classifyBand(load)).toBe(expected);
  });
});

describe("M4.2 Protein", () => {
  it("Standard T2 MODERATE → 2.3", () => {
    expect(proteinGPerKg("T2", "standard", "moderate")).toBeCloseTo(2.3);
  });

  it("Aggressive T2 HARD → 2.4", () => {
    expect(proteinGPerKg("T2", "aggressive", "hard")).toBeCloseTo(2.4);
  });

  it("VERY_HARD drops by 0.2", () => {
    const base = proteinGPerKg("T2", "aggressive", "hard");
    const vh = proteinGPerKg("T2", "aggressive", "very_hard");
    expect(vh).toBeCloseTo(base - 0.2);
  });

  it("never below 1.6 floor", () => {
    for (const tier of TIERS) {
      for (const mode of ALL_MODES) {
        for (const band of ALL_BANDS) {
          expect(proteinGPerKg(tier, mode, band)).toBeGreaterThanOrEqual(1.6);
        }
      }
    }
  });

  it.each(["T1", "T2", "T3", "T4"] as const)(
    "Maintenance flat 2.0 at %s",
    (tier) => {
      expect(proteinGPerKg(tier, "maintenance", "moderate")).toBeCloseTo(2.0);
    },
  );

  it("Bulk T2 → 2.0", () => {
    expect(proteinGPerKg("T2", "bulk", "moderate")).toBeCloseTo(2.0);
  });

  it("Injured matches Standard", () => {
    expect(proteinGPerKg("T2", "injured", "moderate"))
      .toBeCloseTo(proteinGPerKg("T2", "standard", "moderate"));
  });
});

describe("M4.3 Carbs + fiber", () => {
  it.each([
    ["rest", 3.0], ["light", 3.5], ["moderate", 5.0],
    ["hard", 6.5], ["very_hard", 8.0],
  ] as [Band, number][])(`carbGPerKg(%s) = %f`, (band, expected) => {
    expect(carbGPerKg(band)).toBeCloseTo(expected);
  });

  it("carb target by band+weight", () => {
    expect(carbTargetG("hard", { weightKg: 74, inDeficit: true })).toBe(481);
  });

  it("rest-in-deficit health floor kicks in for light users", () => {
    expect(carbTargetG("rest", { weightKg: 30, inDeficit: true })).toBe(100);
  });

  it("rest no-deficit allows below 100", () => {
    expect(carbTargetG("rest", { weightKg: 30, inDeficit: false })).toBe(90);
  });

  it("health floor only on rest band", () => {
    expect(carbTargetG("hard", { weightKg: 30, inDeficit: true })).toBe(195);
  });

  it("fiber 2500 kcal no deficit = 35", () => {
    expect(fiberTargetG(2500, { inDeficit: false })).toBe(35);
  });

  it("fiber deficit bonus +5g", () => {
    expect(fiberTargetG(2500, { inDeficit: true })).toBe(40);
  });

  it("fiber min 25g", () => {
    expect(fiberTargetG(1000, { inDeficit: false })).toBe(25);
  });

  it("fiber hard ceiling 60g", () => {
    expect(fiberTargetG(10000, { inDeficit: true })).toBe(60);
  });
});

describe("M4.4 Composed macro engine", () => {
  it("user aggressive HARD at 2000 kcal", () => {
    const r = computeMacroTargets({
      weightKg: 74.2, tier: "T2", mode: "aggressive", band: "hard",
      kcalTarget: 2000, inDeficit: true,
    });
    expect(r.proteinG).toBe(178);
    expect(r.carbsG).toBeLessThanOrEqual(482);
    expect(r.fatG).toBeGreaterThanOrEqual(45);
  });

  it("kcal balance within rounding at moderate budget", () => {
    const r = computeMacroTargets({
      weightKg: 74, tier: "T2", mode: "standard", band: "moderate",
      kcalTarget: 2400, inDeficit: true,
    });
    const total = r.proteinG * 4 + r.carbsG * 4 + r.fatG * 9;
    expect(Math.abs(total - 2400)).toBeLessThanOrEqual(10);
  });

  it("fat hard floor enforced under tight budget", () => {
    const r = computeMacroTargets({
      weightKg: 74, tier: "T2", mode: "aggressive", band: "very_hard",
      kcalTarget: 1500, inDeficit: true,
    });
    expect(r.fatG).toBeGreaterThanOrEqual(Math.round(0.6 * 74));
  });

  it("rest day standard at tight budget shaves carbs, respects health floor", () => {
    const r = computeMacroTargets({
      weightKg: 74, tier: "T2", mode: "standard", band: "rest",
      kcalTarget: 2000, inDeficit: true,
    });
    expect(r.proteinG).toBe(170);
    expect(r.carbsG).toBeGreaterThanOrEqual(100);
    expect(r.carbsG).toBeLessThanOrEqual(222);
  });

  it("rest maintenance hits band ceiling when budget allows", () => {
    const r = computeMacroTargets({
      weightKg: 74, tier: "T2", mode: "maintenance", band: "rest",
      kcalTarget: 2800, inDeficit: false,
    });
    expect(r.carbsG).toBe(222);
  });

  it("maintenance fat ≈ 1.0 g/kg target", () => {
    const r = computeMacroTargets({
      weightKg: 74, tier: "T2", mode: "maintenance", band: "moderate",
      kcalTarget: 2800, inDeficit: false,
    });
    expect(r.fatG).toBeGreaterThanOrEqual(Math.round(1.0 * 74) - 3);
  });

  it("protein never below 1.6 g/kg floor", () => {
    const r = computeMacroTargets({
      weightKg: 74, tier: "T2", mode: "bulk", band: "very_hard",
      kcalTarget: 3000, inDeficit: false,
    });
    expect(r.proteinG).toBeGreaterThanOrEqual(Math.round(1.6 * 74));
  });
});

describe("M4.5 computeMacroTargetsFromContext adapter", () => {
  it("returns legacy-shape field names", () => {
    const r = computeMacroTargetsFromContext({
      weightKg: 74, bfPct: 23.5, mode: "standard",
      runKcal: 0, gymKcal: 0, kcalTarget: 2000, inDeficit: true,
    });
    expect(r.calories).toBeTypeOf("number");
    expect(r.protein).toBeTypeOf("number");
    expect(r.carbs).toBeTypeOf("number");
    expect(r.fat).toBeTypeOf("number");
    expect(r.fiber).toBeTypeOf("number");
    // And meta fields for downstream UI
    expect(r.band).toBe("rest");
    expect(r.tier).toBe("T2");
  });

  it("derives band from run/gym kcals", () => {
    const rest = computeMacroTargetsFromContext({
      weightKg: 74, bfPct: 23.5, mode: "standard",
      runKcal: 0, gymKcal: 0, kcalTarget: 2000, inDeficit: true,
    });
    const hard = computeMacroTargetsFromContext({
      weightKg: 74, bfPct: 23.5, mode: "standard",
      runKcal: 1500, gymKcal: 0, kcalTarget: 2500, inDeficit: true,
    });
    expect(rest.band).toBe("rest");
    // 1500 kcal run / (74 × 10) ≈ 2.03 → HARD
    expect(hard.band).toBe("hard");
    // Different bands → different carb targets
    expect(hard.carbs).toBeGreaterThan(rest.carbs);
  });

  it("derives tier from BF%; null → T2 fallback", () => {
    const t1 = computeMacroTargetsFromContext({
      weightKg: 74, bfPct: 32, mode: "standard",
      runKcal: 0, gymKcal: 0, kcalTarget: 2000, inDeficit: true,
    });
    expect(t1.tier).toBe("T1");

    const t3 = computeMacroTargetsFromContext({
      weightKg: 74, bfPct: 17, mode: "standard",
      runKcal: 0, gymKcal: 0, kcalTarget: 2000, inDeficit: true,
    });
    expect(t3.tier).toBe("T3");

    const fallback = computeMacroTargetsFromContext({
      weightKg: 74, bfPct: null, mode: "standard",
      runKcal: 0, gymKcal: 0, kcalTarget: 2000, inDeficit: true,
    });
    expect(fallback.tier).toBe("T2");
  });

  it("respects mode: aggressive raises protein, maintenance raises fat", () => {
    const agg = computeMacroTargetsFromContext({
      weightKg: 74, bfPct: 23.5, mode: "aggressive",
      runKcal: 800, gymKcal: 0, kcalTarget: 2100, inDeficit: true,
    });
    const main = computeMacroTargetsFromContext({
      weightKg: 74, bfPct: 23.5, mode: "maintenance",
      runKcal: 800, gymKcal: 0, kcalTarget: 2800, inDeficit: false,
    });
    // Aggressive T2 → 2.4 × 74 = 178g protein
    expect(agg.protein).toBe(178);
    // Maintenance T2 → 2.0 × 74 = 148g protein
    expect(main.protein).toBe(148);
    // Maintenance fat target 1.0 g/kg vs standard 0.8 g/kg
    expect(main.fat).toBeGreaterThan(agg.fat);
  });
});

import { describe, it, expect } from "vitest";
import {
  computeStepCalories,
  computeMacroTargets,
  applyAlcoholOffset,
  redistributeRemaining,
} from "@/lib/macro-engine";

describe("computeStepCalories", () => {
  it("floors NEAT steps at 3000 minimum", () => {
    expect(computeStepCalories(1000, 80, 0)).toBeCloseTo(101.52, 1);
  });
  it("subtracts run steps from total", () => {
    expect(computeStepCalories(10_000, 80, 5000)).toBeCloseTo(169.2, 1);
  });
  it("scales linearly with body weight", () => {
    const a = computeStepCalories(10_000, 60, 0);
    const b = computeStepCalories(10_000, 100, 0);
    expect(b / a).toBeCloseTo(100 / 60, 2);
  });
  it("handles zero steps via the floor", () => {
    // 0 steps → max(0 - 0, 3000) = 3000 → 3000 * 0.000423 * 80 = 101.52
    expect(computeStepCalories(0, 80, 0)).toBeCloseTo(101.52, 1);
  });
});

describe("computeMacroTargets", () => {
  it("macro kcal sum is close to targetCalories (no periodization)", () => {
    const t = computeMacroTargets({
      targetCalories: 2000, weightKg: 80, proteinGPerKg: 2.2, fatGPerKg: 0.8,
    });
    const kcal = t.protein * 4 + t.carbs * 4 + t.fat * 9;
    expect(Math.abs(kcal - 2000)).toBeLessThan(5);
  });
  it("fiber = round(targetCalories * 14 / 1000)", () => {
    expect(computeMacroTargets({ targetCalories: 2000, weightKg: 80 }).fiber).toBe(28);
    expect(computeMacroTargets({ targetCalories: 1500, weightKg: 80 }).fiber).toBe(21);
  });
  it("periodization: long_run gets more carbs than rest when budget allows", () => {
    // At 3000 kcal the fat floor doesn't bind, so the periodized carb
    // targets (3.0 g/kg rest vs 4.75 g/kg long) differ in the output.
    const rest = computeMacroTargets({
      targetCalories: 3000, weightKg: 80,
      carbPeriodization: true, trainingDayType: "rest",
    });
    const long = computeMacroTargets({
      targetCalories: 3000, weightKg: 80,
      carbPeriodization: true, trainingDayType: "long_run",
    });
    expect(long.carbs).toBeGreaterThan(rest.carbs);
  });
  it("applies fat floor when periodized carbs leave too little fat", () => {
    const t = computeMacroTargets({
      targetCalories: 1000, weightKg: 80,
      carbPeriodization: true, trainingDayType: "long_run",
    });
    expect(t.fat).toBeGreaterThanOrEqual(Math.round(0.6 * 80));
  });
  it("protein = proteinGPerKg * weightKg", () => {
    const t = computeMacroTargets({
      targetCalories: 2000, weightKg: 80, proteinGPerKg: 2.2, fatGPerKg: 0.8,
    });
    expect(t.protein).toBe(176);
  });
});

describe("applyAlcoholOffset", () => {
  const targets = { calories: 2000, protein: 170, carbs: 250, fat: 65, fiber: 28 };

  it("reduces total calorie target by drink amount", () => {
    expect(applyAlcoholOffset(targets, 200).calories).toBe(1800);
  });
  it("cuts carbs first (200 kcal = ~50g carbs)", () => {
    const adj = applyAlcoholOffset(targets, 200);
    expect(adj.carbs).toBe(200);
    expect(adj.fat).toBe(65);
  });
  it("no-op for 0 drink calories", () => {
    expect(applyAlcoholOffset(targets, 0)).toEqual(targets);
  });
  it("falls through to fat when carbs are exhausted", () => {
    const lowCarb = { ...targets, carbs: 10 };
    const adj = applyAlcoholOffset(lowCarb, 200);
    expect(adj.carbs).toBeLessThanOrEqual(10);
    expect(adj.fat).toBeLessThan(65);
  });
});

describe("redistributeRemaining", () => {
  const targets = { calories: 2000, protein: 170, carbs: 250, fat: 65, fiber: 28 };

  it("preserves eaten amounts for logged slots", () => {
    const eaten = { breakfast: { calories: 500, protein: 40, carbs: 60, fat: 15, fiber: 5 } };
    const budgets = redistributeRemaining(targets, eaten, []);
    expect(budgets.find((b) => b.slot === "breakfast")?.calories).toBe(500);
  });
  it("zeros skipped slots", () => {
    const budgets = redistributeRemaining(targets, {}, ["lunch"]);
    expect(budgets.find((b) => b.slot === "lunch")?.calories).toBe(0);
  });
  it("total across all slots is close to target", () => {
    const eaten = { breakfast: { calories: 500, protein: 40, carbs: 60, fat: 15, fiber: 5 } };
    const total = redistributeRemaining(targets, eaten, [])
      .reduce((s, b) => s + b.calories, 0);
    expect(Math.abs(total - targets.calories)).toBeLessThan(5);
  });
  it("returns one budget per default slot", () => {
    const budgets = redistributeRemaining(targets, {}, []);
    expect(budgets.map((b) => b.slot).sort()).toEqual(
      ["breakfast", "dinner", "lunch", "pre_sleep"],
    );
  });
});

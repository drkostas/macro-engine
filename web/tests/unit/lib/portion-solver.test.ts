import { describe, it, expect } from "vitest";
import {
  solvePortions,
  computeItemMacros,
  isCountBased,
  countToGrams,
  gramsToCount,
  rawToCooked,
  cookedToRaw,
  type Ingredient,
} from "@/lib/portion-solver";

const chicken: Ingredient = {
  id: "chicken_breast_raw",
  name: "Chicken Breast",
  category: "protein",
  calories_per_100g: 120,
  protein_per_100g: 23,
  carbs_per_100g: 0,
  fat_per_100g: 2.5,
  fiber_per_100g: 0,
};

const rice: Ingredient = {
  id: "white_rice_raw",
  name: "White Rice",
  category: "carbs",
  calories_per_100g: 365,
  protein_per_100g: 7,
  carbs_per_100g: 80,
  fat_per_100g: 0.5,
  fiber_per_100g: 1.3,
};

const oil: Ingredient = {
  id: "olive_oil",
  name: "Olive Oil",
  category: "fat",
  calories_per_100g: 884,
  protein_per_100g: 0,
  carbs_per_100g: 0,
  fat_per_100g: 100,
  fiber_per_100g: 0,
};

const egg: Ingredient = {
  id: "egg_whole",
  name: "Egg",
  category: "protein",
  calories_per_100g: 155,
  protein_per_100g: 13,
  carbs_per_100g: 1,
  fat_per_100g: 11,
  fiber_per_100g: 0,
  unit: "egg",
  grams_per_unit: 50,
  unit_step: 1,
};

describe("computeItemMacros", () => {
  it("scales linearly with grams", () => {
    const m100 = computeItemMacros(chicken, 100);
    const m200 = computeItemMacros(chicken, 200);
    expect(m200.calories).toBeCloseTo(m100.calories * 2);
    expect(m200.protein).toBeCloseTo(m100.protein * 2);
    expect(m200.fat).toBeCloseTo(m100.fat * 2);
  });
  it("returns zero for zero grams", () => {
    const m = computeItemMacros(chicken, 0);
    expect(m.calories).toBe(0);
    expect(m.protein).toBe(0);
  });
});

describe("isCountBased / countToGrams / gramsToCount", () => {
  it("detects count-based ingredients via unit", () => {
    expect(isCountBased(egg)).toBe(true);
    expect(isCountBased(chicken)).toBe(false);
  });
  it("converts count to grams", () => {
    expect(countToGrams(egg, 3)).toBe(150);
  });
  it("converts grams to count with snapping", () => {
    // 100g / 50g per egg = 2 eggs
    expect(gramsToCount(egg, 100)).toBe(2);
    // 125g / 50 = 2.5 → snaps to 3 (step=1)
    expect(gramsToCount(egg, 125)).toBe(3);
  });
});

describe("rawToCooked / cookedToRaw", () => {
  const rawChickenWithRatio: Ingredient = {
    ...chicken,
    is_raw: true,
    raw_to_cooked_ratio: 0.75, // 100g raw → 75g cooked
  };
  it("converts raw grams to cooked grams", () => {
    expect(rawToCooked(rawChickenWithRatio, 100)).toBe(75);
  });
  it("converts cooked grams back to raw", () => {
    expect(cookedToRaw(rawChickenWithRatio, 75)).toBeCloseTo(100);
  });
  it("returns input unchanged if no ratio", () => {
    expect(rawToCooked(chicken, 100)).toBe(100);
  });
});

describe("solvePortions", () => {
  it("returns one entry per ingredient", () => {
    const result = solvePortions(
      [chicken, rice, oil],
      { calories: 700, protein: 60, carbs: 80, fat: 20 },
    );
    expect(result).toHaveLength(3);
    for (const p of result) expect(p.grams).toBeGreaterThan(0);
  });
  it("solution macros are in reasonable range of target", () => {
    const result = solvePortions(
      [chicken, rice, oil],
      { calories: 700, protein: 60, carbs: 80, fat: 20 },
    );
    const totals = result.reduce(
      (s, p) => ({
        calories: s.calories + p.calories,
        protein: s.protein + p.protein,
        carbs: s.carbs + p.carbs,
        fat: s.fat + p.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );
    // Solver won't be perfect but should be in ballpark
    expect(Math.abs(totals.calories - 700)).toBeLessThan(300);
  });
  it("respects category gram bounds", () => {
    const result = solvePortions(
      [chicken],
      { calories: 5000, protein: 500, carbs: 0, fat: 0 }, // impossibly high
    );
    // chicken protein is capped at 300g max
    expect(result[0].grams).toBeLessThanOrEqual(300);
  });
});

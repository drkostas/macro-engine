import { describe, it, expect } from "vitest";
import {
  createVariation,
  computeVariationMacros,
  autoNameVariation,
  type Variation,
} from "@/lib/variation-state";
import type { Ingredient } from "@/lib/portion-solver";

const chicken: Ingredient = {
  id: "chicken", name: "Chicken Breast",
  calories_per_100g: 165, protein_per_100g: 31, carbs_per_100g: 0,
  fat_per_100g: 3.6, fiber_per_100g: 0, category: "protein",
};
const rice: Ingredient = {
  id: "rice", name: "Jasmine Rice",
  calories_per_100g: 130, protein_per_100g: 3, carbs_per_100g: 28,
  fat_per_100g: 0.3, fiber_per_100g: 0.4, category: "carbs",
};

describe("createVariation", () => {
  it("returns a variation with a unique id, default name, and no portions", () => {
    const v = createVariation({ name: "My V" });
    expect(v.id).toBeTruthy();
    expect(v.name).toBe("My V");
    expect(v.portions).toEqual([]);
    expect(v.tempIngredients).toEqual([]);
    expect(v.selected.size).toBe(0);
  });

  it("generates unique ids across calls", () => {
    const a = createVariation();
    const b = createVariation();
    expect(a.id).not.toBe(b.id);
  });
});

describe("computeVariationMacros", () => {
  it("returns zeros for an empty variation", () => {
    const v = createVariation();
    expect(computeVariationMacros(v)).toEqual({
      calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0,
    });
  });

  it("sums macros across all portions", () => {
    const v: Variation = {
      ...createVariation(),
      portions: [
        { ingredient: chicken, grams: 200 },
        { ingredient: rice, grams: 150 },
      ],
    };
    const m = computeVariationMacros(v);
    // chicken 200g: 330 cal, 62 P; rice 150g: 195 cal, 4.5 P
    expect(m.calories).toBeCloseTo(525, 0);
    expect(m.protein).toBeCloseTo(66.5, 1);
  });
});

describe("autoNameVariation", () => {
  it("names empty variations by ordinal", () => {
    const v = createVariation();
    expect(autoNameVariation(v, 0)).toBe("V1");
    expect(autoNameVariation(v, 2)).toBe("V3");
  });

  it("uses first ingredient's name when populated", () => {
    const v: Variation = {
      ...createVariation(),
      portions: [{ ingredient: chicken, grams: 180 }],
    };
    expect(autoNameVariation(v, 0)).toBe("Chicken Breast");
  });

  it("does not overwrite a user-set name", () => {
    const v: Variation = {
      ...createVariation({ name: "My custom name", isNameManual: true }),
      portions: [{ ingredient: chicken, grams: 180 }],
    };
    expect(autoNameVariation(v, 0)).toBe("My custom name");
  });
});

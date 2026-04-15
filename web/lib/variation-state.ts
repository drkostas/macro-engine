import type { Ingredient } from "@/lib/portion-solver";
import { computeItemMacros } from "@/lib/portion-solver";

export interface PortionEntry {
  ingredient: Ingredient;
  grams: number;
}

export interface Variation {
  id: string;
  name: string;
  isNameManual: boolean;
  selected: Set<string>;
  portions: PortionEntry[];
  tempIngredients: Ingredient[];
}

export interface VariationTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

interface CreateOpts {
  name?: string;
  isNameManual?: boolean;
}

let counter = 0;
export function createVariation(opts: CreateOpts = {}): Variation {
  counter += 1;
  return {
    id: `var_${Date.now()}_${counter}`,
    name: opts.name ?? "",
    isNameManual: opts.isNameManual ?? false,
    selected: new Set(),
    portions: [],
    tempIngredients: [],
  };
}

export function computeVariationMacros(v: Variation): VariationTotals {
  const totals = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  for (const p of v.portions) {
    const m = computeItemMacros(p.ingredient, p.grams);
    totals.calories += m.calories;
    totals.protein += m.protein;
    totals.carbs += m.carbs;
    totals.fat += m.fat;
    totals.fiber += m.fiber;
  }
  return totals;
}

export function autoNameVariation(v: Variation, index: number): string {
  if (v.isNameManual && v.name) return v.name;
  if (v.portions.length > 0) return v.portions[0].ingredient.name;
  return `V${index + 1}`;
}

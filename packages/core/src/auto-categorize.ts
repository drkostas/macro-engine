/**
 * Auto-categorize a food by its per-100g macro profile.
 * Used when adding USDA foods to a meal or saving to My Ingredients.
 */

export type FoodCategory =
  | "protein" | "carbs" | "fat" | "dairy"
  | "vegetable" | "fruit" | "sauce" | "supplement" | "other";

interface MacroPer100g {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
}

export function autoCategorizeFood(macros: MacroPer100g): FoodCategory {
  const { calories, protein, carbs, fat, fiber, sugar } = macros;

  const pCal = protein * 4;
  const cCal = carbs * 4;
  const fCal = fat * 9;
  const dominant = Math.max(pCal, cCal, fCal);

  if (protein > 15 && pCal === dominant) return "protein";
  if (carbs > 40 && cCal === dominant) return "carbs";
  if (fat > 30 && fCal === dominant) return "fat";
  if (protein >= 8 && protein <= 15 && fat > 15) return "dairy";
  if ((fiber ?? 0) > 3 && calories < 50) return "vegetable";
  if ((sugar ?? 0) > 10 && calories < 80) return "fruit";

  return "other";
}

/** Default shrink priority by category (lower = shrink first in rebalancing) */
export const SHRINK_PRIORITY: Record<FoodCategory, number> = {
  carbs: 1,
  fat: 2,
  dairy: 3,
  fruit: 4,
  sauce: 5,
  other: 6,
  protein: 7,
  supplement: 8,
  vegetable: 99,
};

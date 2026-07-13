/**
 * Alcohol nutrition — ported from soma sync/src/nutrition_engine/alcohol.py.
 *
 * NOTE: macro-engine.ts also has a simpler `fatOxidationPauseHours` (ethanol/7)
 * used by the macro-engine app. This module carries soma's DETAILED piecewise
 * version (canonical). Barrel aliases the simple one to avoid the collision.
 */
import { pyRound } from "./deficit";
import { DRINK_DATABASE } from "./drink-db";

export const ETHANOL_DENSITY = 0.789;

/** Hours fat oxidation is suppressed by alcohol. Piecewise:
 *  ≤0→0; 0-14g→0-4h; 14-28g→4-6h; 28-56g→6-12h; 56g+→12-24h (cap 24). */
export function fatOxidationPauseHours(alcoholGrams: number): number {
  if (alcoholGrams <= 0) return 0.0;
  if (alcoholGrams <= 28) {
    if (alcoholGrams <= 14) return (alcoholGrams / 14.0) * 4.0;
    return 4.0 + ((alcoholGrams - 14.0) / (28.0 - 14.0)) * 2.0;
  }
  if (alcoholGrams <= 56) return 6.0 + ((alcoholGrams - 28.0) / (56.0 - 28.0)) * 6.0;
  return Math.min(24.0, 12.0 + ((alcoholGrams - 56.0) / 56.0) * 12.0);
}

export interface AlcoholDisplacement {
  fat_reduction_g: number;
  carbs_reduction_g: number;
  protein_reduction_g: number;
}

/** Alcohol kcal displace fat (default 65%) then carbs; never protein. Capped at budget. */
export function computeAlcoholDisplacement(
  alcoholCalories: number,
  remainingFatG: number,
  remainingCarbsG: number,
  fatFraction = 0.65,
): AlcoholDisplacement {
  if (alcoholCalories <= 0) {
    return { fat_reduction_g: 0.0, carbs_reduction_g: 0.0, protein_reduction_g: 0.0 };
  }
  const targetFatG = (alcoholCalories * fatFraction) / 9.0;
  let targetCarbG = (alcoholCalories * (1.0 - fatFraction)) / 4.0;

  const actualFatG = Math.min(targetFatG, remainingFatG);
  const uncoveredFatKcal = (targetFatG - actualFatG) * 9.0;
  targetCarbG += uncoveredFatKcal / 4.0;
  const actualCarbG = Math.min(targetCarbG, remainingCarbsG);

  return {
    fat_reduction_g: pyRound(actualFatG, 2),
    carbs_reduction_g: pyRound(actualCarbG, 2),
    protein_reduction_g: 0.0,
  };
}

export interface DrinkEntry {
  drink_type: string;
  quantity: number;
  calories: number;
  alcohol_grams: number;
  carbs: number;
  fat_oxidation_pause_hours: number;
}

/** Nutritional entry for `quantity` servings of a drink. null for unknown types. */
export function computeDrinkEntry(drinkType: string, quantity = 1.0): DrinkEntry | null {
  const drink = DRINK_DATABASE[drinkType];
  if (!drink) return null;

  const totalMl = drink.default_ml * quantity;
  const calories = (drink.calories_per_100ml * totalMl) / 100.0;
  const carbs = (drink.carbs_per_100ml * totalMl) / 100.0;
  const alcoholGrams = totalMl * (drink.alcohol_pct / 100.0) * ETHANOL_DENSITY;

  return {
    drink_type: drinkType,
    quantity,
    calories: pyRound(calories, 1),
    alcohol_grams: pyRound(alcoholGrams, 1),
    carbs: pyRound(carbs, 1),
    fat_oxidation_pause_hours: pyRound(fatOxidationPauseHours(alcoholGrams), 1),
  };
}

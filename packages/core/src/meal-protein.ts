/**
 * Protein in one eating event, judged against body weight (Schoenfeld & Aragon 2018, Trommelen 2023).
 *
 * The muscle-protein-synthesis floor scales with body mass, about 0.4 g/kg per meal: 30 g at 75 kg,
 * about 24 g at 60 kg and about 36 g at 90 kg. Above about 0.55 g/kg a meal is not better, and it is
 * not harmful either, so there is no upper warning. Without a weight the classic fixed grams apply.
 */
export type MealProteinLevel = "red" | "amber" | "yellow" | "green" | "plenty";

export const MPS_G_PER_KG = 0.4;
export const PLENTY_G_PER_KG = 0.55;

export interface MealProteinThresholds {
  /** Below this a meal is low in protein. */
  red: number;
  /** Below this it is under the synthesis floor. */
  amber: number;
  /** Below this it is near the floor. At or above it, the meal is enough. */
  yellow: number;
  /** Above this it is more than a meal needs. */
  plenty: number;
}

export function mealProteinThresholds(weightKg?: number | null): MealProteinThresholds {
  if (!weightKg || weightKg <= 0) return { red: 15, amber: 25, yellow: 30, plenty: 55 };
  const mps = Math.max(20, Math.round(weightKg * MPS_G_PER_KG));
  const plenty = Math.max(40, Math.round(weightKg * PLENTY_G_PER_KG));
  return {
    red: Math.max(10, Math.round(mps * 0.5)),
    amber: Math.max(15, Math.round(mps * 0.83)),
    yellow: mps,
    plenty,
  };
}

export function mealProteinLevel(grams: number, weightKg?: number | null): MealProteinLevel {
  const t = mealProteinThresholds(weightKg);
  if (grams < t.red) return "red";
  if (grams < t.amber) return "amber";
  if (grams < t.yellow) return "yellow";
  if (grams <= t.plenty) return "green";
  return "plenty";
}

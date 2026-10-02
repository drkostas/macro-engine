/**
 * What small, usual and large mean for one person, per ingredient.
 *
 * The app measures its own bands (the 25th, 50th and 90th percentile of what was actually eaten,
 * per ingredient) and passes them to `bandFor`. GENERIC_BANDS is the per-category fallback,
 * measured from one person's log. Pass your own table to `bandFor` to override it.
 *
 * Measured rather than assumed. Across 827 logged items the correlation between an ingredient's
 * grams and that day's calorie target is weak and inconsistent, and normalising by the target
 * makes the spread WORSE for 12 of 18 ingredients. Portions here are habits, not responses to the
 * plan, so the plain distribution of what was actually eaten is the honest anchor.
 *
 * ⚠️ THE THREE PERCENTILES ARE NOT SYMMETRIC, ON PURPOSE. Small is the 25th and usual the 50th,
 * but large is the 90th rather than the 75th. This owner's habits are tight: the 75th percentile
 * of his oats is 40g against a usual 30g, so "large oats" would have meant barely more than
 * normal, and the feature would read as not listening. The 90th reaches properly while still
 * excluding a single outlier, which matters because one 300g cherry-tomato entry sits far above a
 * 120g 75th percentile. Raw maximum was rejected for exactly that reason.
 */
export interface PortionBand { small: number; usual: number; large: number; n: number }

/** Below this an ingredient has a coincidence, not a habit, and the category answers instead. */
export const MIN_OBSERVATIONS = 4;

/**
 * The per-category fallback, itself computed from this owner's history rather than a food table,
 * so a food they have never logged still lands near how they eat that kind of food. Categories
 * with too little history of their own share the neutral default.
 */
export const GENERIC_BANDS: Record<string, PortionBand> = {
  carbs:      { small: 20,  usual: 30,  large: 88,  n: 158 },
  dairy:      { small: 100, usual: 150, large: 250, n: 121 },
  vegetable:  { small: 56,  usual: 100, large: 125, n: 120 },
  protein:    { small: 99,  usual: 125, large: 208, n: 101 },
  fruit:      { small: 59,  usual: 100, large: 178, n: 79 },
  supplement: { small: 30,  usual: 30,  large: 60,  n: 67 },
  grain:      { small: 10,  usual: 10,  large: 22,  n: 53 },
  fat:        { small: 5,   usual: 15,  large: 50,  n: 41 },
  restaurant: { small: 68,  usual: 113, large: 224, n: 24 },
  sauce:      { small: 15,  usual: 20,  large: 72,  n: 16 },
  default:    { small: 50,  usual: 100, large: 180, n: 0 },
};

/** The band in force for one ingredient: the owner's own when it is real, else the category. */
export function bandFor(
  own: Map<string, PortionBand>, ingredientId: string, category: string,
  generic: Record<string, PortionBand> = GENERIC_BANDS,
): PortionBand {
  const mine = own.get(ingredientId);
  if (mine && mine.n >= MIN_OBSERVATIONS) return mine;
  return generic[category] ?? generic.default ?? GENERIC_BANDS.default;
}

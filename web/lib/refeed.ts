/**
 * M6 Phase A — Refeed macros TypeScript mirror.
 * Source of truth: src/macro_engine/refeed.py
 * Research basis: SOMA-NUTRITION-SCIENCE-V2.md §4.2
 */

// ============================================================================
// M6.1 is_refeed_day
// ============================================================================

const REFEED_KCAL_FRACTION = 0.95;
const REFEED_CARB_G_PER_KG = 5.0;
const REFEED_FAT_CEILING_G_PER_KG = 1.0;

export function isRefeedDay(opts: {
  kcal: number;
  tdee: number;
  carbsG: number;
  fatG: number;
  weightKg: number;
}): boolean {
  if (opts.tdee <= 0 || opts.weightKg <= 0) {
    throw new RangeError(
      `tdee and weightKg must be positive (tdee=${opts.tdee}, weightKg=${opts.weightKg})`,
    );
  }
  return (
    opts.kcal >= REFEED_KCAL_FRACTION * opts.tdee
    && opts.carbsG >= REFEED_CARB_G_PER_KG * opts.weightKg
    && opts.fatG <= REFEED_FAT_CEILING_G_PER_KG * opts.weightKg
  );
}

// ============================================================================
// M6.2 compute_refeed_targets
// ============================================================================

const REFEED_PROTEIN_G_PER_KG = 2.0;
const REFEED_CARB_TARGET_G_PER_KG = 7.0;
const REFEED_FAT_TARGET_G_PER_KG = 0.7;

export type RefeedIntensity = "maintenance" | "plus_5" | "plus_10";

const INTENSITY_FACTOR: Record<RefeedIntensity, number> = {
  maintenance: 1.00,
  plus_5: 1.05,
  plus_10: 1.10,
};

export interface RefeedTargets {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export function computeRefeedTargets(opts: {
  weightKg: number;
  tdee: number;
  intensity?: RefeedIntensity;
}): RefeedTargets {
  if (opts.weightKg <= 0) throw new RangeError(`weightKg must be positive, got ${opts.weightKg}`);
  if (opts.tdee <= 0) throw new RangeError(`tdee must be positive, got ${opts.tdee}`);

  const intensity = opts.intensity ?? "maintenance";
  const kcal = Math.round(opts.tdee * INTENSITY_FACTOR[intensity]);
  return {
    kcal,
    proteinG: Math.round(REFEED_PROTEIN_G_PER_KG * opts.weightKg),
    carbsG: Math.round(REFEED_CARB_TARGET_G_PER_KG * opts.weightKg),
    fatG: Math.round(REFEED_FAT_TARGET_G_PER_KG * opts.weightKg),
  };
}

// ============================================================================
// M6.3 apply_refeed_to_counter
// ============================================================================

const SINGLE_REFEED_SUBTRACT = 3;
const TWO_DAY_REFEED_SUBTRACT = 6;

export function applyRefeedToCounter(
  currentCounter: number,
  opts: { refeedLengthDays: 1 | 2 },
): number {
  let delta: number;
  if (opts.refeedLengthDays === 1) delta = SINGLE_REFEED_SUBTRACT;
  else if (opts.refeedLengthDays === 2) delta = TWO_DAY_REFEED_SUBTRACT;
  else {
    throw new RangeError(
      `refeedLengthDays must be 1 or 2, got ${opts.refeedLengthDays}`,
    );
  }
  return Math.max(0, currentCounter - delta);
}

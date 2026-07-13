/**
 * M8 Phase A — Hydration TypeScript mirror.
 * Source of truth: src/macro_engine/hydration.py
 * Research basis: SOMA-NUTRITION-SCIENCE-V2.md §11
 */

// ============================================================================
// M8.1 Water target
// ============================================================================

const WATER_BEVERAGE_ML_PER_KG = 28;
const WATER_TOTAL_ML_PER_KG = 35;

export interface WaterTargets {
  beverageMl: number;
  totalMl: number;
}

export function computeWaterTarget(weightKg: number): WaterTargets {
  if (weightKg <= 0) throw new RangeError(`weightKg must be positive, got ${weightKg}`);
  return {
    beverageMl: Math.round(WATER_BEVERAGE_ML_PER_KG * weightKg),
    totalMl: Math.round(WATER_TOTAL_ML_PER_KG * weightKg),
  };
}

// ============================================================================
// M8.2 Sodium target
// ============================================================================

const SODIUM_REST_FLOOR_MG = 1500;
const SODIUM_REST_CEILING_MG = 2300;
const SODIUM_ATHLETIC_PER_L_SWEAT = 950;

export function computeSodiumTarget(opts: {
  sweatL?: number;
  manualRestMg?: number;
} = {}): number {
  const sweatL = opts.sweatL ?? 0;
  if (sweatL < 0) throw new RangeError(`sweatL must be non-negative, got ${sweatL}`);
  if (sweatL === 0) {
    const base = opts.manualRestMg ?? SODIUM_REST_FLOOR_MG;
    return Math.min(Math.max(SODIUM_REST_FLOOR_MG, base), SODIUM_REST_CEILING_MG);
  }
  return SODIUM_REST_FLOOR_MG + Math.round(SODIUM_ATHLETIC_PER_L_SWEAT * sweatL);
}

// ============================================================================
// M8.3 Hyponatremia
// ============================================================================

const HYPONATREMIA_WATER_FLOW_THRESHOLD = 1000;
const HYPONATREMIA_MIN_HOURS = 3;
const HYPONATREMIA_SODIUM_THRESHOLD = 200;

export function isHyponatremiaRisk(opts: {
  waterMlPerHour: number;
  hours: number;
  sodiumMgPerHour: number;
}): boolean {
  return (
    opts.waterMlPerHour >= HYPONATREMIA_WATER_FLOW_THRESHOLD
    && opts.hours >= HYPONATREMIA_MIN_HOURS
    && opts.sodiumMgPerHour < HYPONATREMIA_SODIUM_THRESHOLD
  );
}

// ============================================================================
// M8.4 Alcohol + caffeine effective hydration
// ============================================================================

const ETHANOL_ML_PENALTY_PER_G = 10;
const CAFFEINE_THRESHOLD_MG = 500;
const CAFFEINE_EXCESS_DIURETIC_ML_PER_MG = 0.5;

export function effectiveHydration(
  volumeMl: number,
  opts: { ethanolG: number; caffeineMg: number },
): number {
  let effective = volumeMl - ETHANOL_ML_PENALTY_PER_G * opts.ethanolG;
  if (opts.caffeineMg > CAFFEINE_THRESHOLD_MG) {
    const excess = opts.caffeineMg - CAFFEINE_THRESHOLD_MG;
    effective -= excess * CAFFEINE_EXCESS_DIURETIC_ML_PER_MG;
  }
  return Math.max(0, Math.round(effective));
}

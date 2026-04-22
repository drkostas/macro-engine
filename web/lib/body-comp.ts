/**
 * M3 Body Composition Layer — TypeScript mirror of Python canonical.
 *
 * Source of truth:
 *   src/macro_engine/forbes.py
 *   src/macro_engine/method_sigma.py
 *   src/macro_engine/creatine_water.py
 *
 * Any changes here must be mirrored in Python (and vice versa).
 *
 * Research basis: SOMA-NUTRITION-SCIENCE-V2.md §8
 */

// ============================================================================
// FORBES PARTITIONING (M3.1) — V2 §8.1
// ============================================================================

const FORBES_K = 10.4;
const RECOMP_MULTIPLIER = 0.6;

export interface ForbesResult {
  dFfmKg: number;
  dFmKg: number;
  ffmFraction: number;
}

export function partitionWeightChange(
  dBwKg: number,
  fmKg: number,
  opts: { recomp?: boolean } = {},
): ForbesResult {
  if (fmKg < 0) {
    throw new RangeError(`fmKg must be non-negative, got ${fmKg}`);
  }
  const base = FORBES_K / (FORBES_K + fmKg);
  const ffmFraction = opts.recomp ? base * RECOMP_MULTIPLIER : base;
  const dFfmKg = dBwKg * ffmFraction;
  const dFmKg = dBwKg - dFfmKg;
  return { dFfmKg, dFmKg, ffmFraction };
}

// ============================================================================
// MEASUREMENT METHOD SIGMAS (M3.2) — V2 §8.2
// ============================================================================

export type Method = "dexa" | "caliper" | "navy" | "bia" | "nhanes";

export const ALL_METHODS: readonly Method[] = [
  "dexa",
  "caliper",
  "navy",
  "bia",
  "nhanes",
] as const;

const BASE_SIGMA_KG: Record<Method, number> = {
  dexa: 1.0,
  caliper: 2.0,
  navy: 2.2,
  bia: 2.5,
  nhanes: 3.0,
};

const STALENESS_THRESHOLD_WEEKS = 12.0;
const STALENESS_RATE_KG_PER_WEEK = 0.1;

export function methodSigmaKg(method: Method): number {
  return BASE_SIGMA_KG[method];
}

export function effectiveSigmaKg(method: Method, weeksSince: number): number {
  const base = methodSigmaKg(method);
  if (weeksSince <= STALENESS_THRESHOLD_WEEKS) return base;
  return base + (weeksSince - STALENESS_THRESHOLD_WEEKS) * STALENESS_RATE_KG_PER_WEEK;
}

// ============================================================================
// CREATINE WATER CORRECTION (M3.3) — V2 §8.4
// ============================================================================

const W_MAX_FRACTION = 0.0155;
const TAU_LOADING_D = 2.0;
const TAU_NON_LOADING_D = 8.0;
const TAU_DELOAD_D = 14.0;
const LOADING_DOSE_THRESHOLD_G = 15.0;
const BIA_BODY_WATER_FRACTION = 0.73;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function diffDays(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / MS_PER_DAY);
}

export interface CreatineWaterOpts {
  ffmKg: number;
  doseGPerDay: number;
  startDate: Date | null;
  today: Date;
  stopDate?: Date | null;
}

export function creatineWaterAdjustment(opts: CreatineWaterOpts): number {
  const { ffmKg, doseGPerDay, startDate, today, stopDate } = opts;
  if (ffmKg < 0) throw new RangeError(`ffmKg must be non-negative, got ${ffmKg}`);
  if (doseGPerDay < 0) {
    throw new RangeError(`doseGPerDay must be non-negative, got ${doseGPerDay}`);
  }
  if (doseGPerDay === 0) return 0;

  const wMax = W_MAX_FRACTION * ffmKg;

  let currentOffset: number;
  if (startDate === null) {
    currentOffset = wMax;
  } else {
    const daysOn = diffDays(today, startDate);
    if (daysOn <= 0) return 0;
    const tau = doseGPerDay >= LOADING_DOSE_THRESHOLD_G ? TAU_LOADING_D : TAU_NON_LOADING_D;
    currentOffset = wMax * (1 - Math.exp(-daysOn / tau));
  }

  if (stopDate != null && stopDate <= today) {
    const daysOff = diffDays(today, stopDate);
    if (daysOff > 0) {
      currentOffset *= Math.exp(-daysOff / TAU_DELOAD_D);
    }
  }

  return currentOffset;
}

export function biaCreatineCorrection(offsetKg: number): number {
  return offsetKg / BIA_BODY_WATER_FRACTION;
}

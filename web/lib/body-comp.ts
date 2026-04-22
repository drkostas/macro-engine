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

// ============================================================================
// NAVY TAPE BF% + FFM (M3.6) — V2 §8.2
// ============================================================================

const BF_MIN = 3.0;
const BF_MAX = 60.0;
const CM_PER_INCH = 2.54;

export type Sex = "male" | "female";

export interface NavyTapeInputs {
  weightKg: number;
  neckCm: number;
  waistCm: number;
  heightCm: number;
  sex: Sex;
  hipCm?: number | null;
}

function toInches(cm: number): number {
  return cm / CM_PER_INCH;
}

function validatePositive(label: string, v: number): void {
  if (!(v > 0)) throw new RangeError(`${label} must be positive, got ${v}`);
}

export function navyTapeBfPct(inputs: Omit<NavyTapeInputs, "weightKg">): number {
  const { neckCm, waistCm, heightCm, sex, hipCm } = inputs;
  validatePositive("neckCm", neckCm);
  validatePositive("waistCm", waistCm);
  validatePositive("heightCm", heightCm);

  const neckIn = toInches(neckCm);
  const waistIn = toInches(waistCm);
  const heightIn = toInches(heightCm);

  let bf: number;
  if (sex === "male") {
    const diffIn = waistIn - neckIn;
    if (diffIn <= 0) {
      throw new RangeError(`waist (${waistCm}) must exceed neck (${neckCm}) for male formula`);
    }
    bf = 86.010 * Math.log10(diffIn) - 70.041 * Math.log10(heightIn) + 36.76;
  } else if (sex === "female") {
    if (hipCm == null) {
      throw new RangeError("hipCm is required for female Navy tape calculation");
    }
    validatePositive("hipCm", hipCm);
    const hipIn = toInches(hipCm);
    const diffIn = waistIn + hipIn - neckIn;
    if (diffIn <= 0) {
      throw new RangeError("waist + hip must exceed neck for female formula");
    }
    bf = 163.205 * Math.log10(diffIn) - 97.684 * Math.log10(heightIn) - 78.387;
  } else {
    throw new RangeError(`sex must be 'male' or 'female', got ${sex}`);
  }

  return Math.max(BF_MIN, Math.min(BF_MAX, bf));
}

export function navyTapeFfmKg(inputs: NavyTapeInputs): number {
  validatePositive("weightKg", inputs.weightKg);
  const bf = navyTapeBfPct(inputs);
  return inputs.weightKg * (1 - bf / 100);
}

// ============================================================================
// WEIGHT PREDICTION 3-LAYER (M3 Phase D) — V2 §8.3
// ============================================================================

const LEAN_KCAL_PER_KG = 1816;
const FAT_KCAL_PER_KG = 9441;

export function forbesEnergyDensityKcalPerKg(fmKg: number): number {
  if (fmKg < 0) throw new RangeError(`fmKg must be non-negative, got ${fmKg}`);
  const leanFraction = FORBES_K / (FORBES_K + fmKg);
  return leanFraction * LEAN_KCAL_PER_KG + (1 - leanFraction) * FAT_KCAL_PER_KG;
}

const LAYER_A_MIN = 5500;
const LAYER_A_MAX = 9500;
const LAYER_A_WEIGHT_EMA_DAYS = 7;
const LAYER_A_WINDOW_DAYS = 14;

export interface DayPoint {
  day: number;
  intakeKcal: number;
  tdeeKcal: number;
  weightKg: number;
}

function trailingMean(values: number[], window: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - window + 1);
    const seg = values.slice(start, i + 1);
    out.push(seg.reduce((a, b) => a + b, 0) / seg.length);
  }
  return out;
}

function ewma(values: number[], halfLife: number): number[] {
  if (values.length === 0) return [];
  const alpha = 1 - Math.exp(-Math.log(2) / halfLife);
  const out = [values[0]];
  for (let i = 1; i < values.length; i++) {
    out.push(out[out.length - 1] + alpha * (values[i] - out[out.length - 1]));
  }
  return out;
}

export function personalKcalPerKg(
  history: DayPoint[],
  opts: { minDays?: number; windowDays?: number; halfLifeDays?: number } = {},
): number | null {
  const minDays = opts.minDays ?? 28;
  const windowDays = opts.windowDays ?? LAYER_A_WINDOW_DAYS;
  const halfLifeDays = opts.halfLifeDays ?? 28;
  if (history.length < minDays) return null;

  const smoothed = trailingMean(history.map((d) => d.weightKg), LAYER_A_WEIGHT_EMA_DAYS);

  const perWindow: number[] = [];
  const firstEnd = windowDays + LAYER_A_WEIGHT_EMA_DAYS - 1;
  for (let end = firstEnd; end < history.length; end++) {
    const start = end - windowDays;
    const window = history.slice(start, end);
    const cumDeficit = window.reduce((sum, d) => sum + (d.tdeeKcal - d.intakeKcal), 0);
    const delta = smoothed[start] - smoothed[end];
    if (Math.abs(delta) < 0.05) continue;
    if (cumDeficit * delta <= 0) continue;
    perWindow.push(cumDeficit / delta);
  }

  if (perWindow.length === 0) return null;

  const smoothedRho = ewma(perWindow, halfLifeDays);
  const raw = smoothedRho[smoothedRho.length - 1];
  return Math.max(LAYER_A_MIN, Math.min(LAYER_A_MAX, raw));
}

const GLYCOGEN_MAX_SWING_KG = 1.2;
const GLYCOGEN_CARB_SATURATION_G = 500;
const REFEED_MAX_OFFSET_KG = 0.8;
const REFEED_TAU_DAYS = 2;
const CI_BAND_SCALAR = 0.6;

export interface OverlayResult {
  glycogenSwingKg: number;
  refeedOffsetKg: number;
  ciLowKg: number;
  ciHighKg: number;
}

export function glycogenWaterOverlay(
  centralKg: number,
  opts: { daysSinceRefeed: number; carbDeltaG: number },
): OverlayResult {
  const { daysSinceRefeed, carbDeltaG } = opts;
  if (daysSinceRefeed < 0) {
    throw new RangeError(`daysSinceRefeed must be >= 0, got ${daysSinceRefeed}`);
  }
  const saturation = Math.max(-1, Math.min(1, carbDeltaG / GLYCOGEN_CARB_SATURATION_G));
  const glycogenSwingKg = saturation * GLYCOGEN_MAX_SWING_KG;
  const refeedOffsetKg = REFEED_MAX_OFFSET_KG * Math.exp(-daysSinceRefeed / REFEED_TAU_DAYS);

  const band = Math.max(
    (Math.abs(glycogenSwingKg) + Math.abs(refeedOffsetKg)) * CI_BAND_SCALAR,
    0.05,
  );

  return {
    glycogenSwingKg,
    refeedOffsetKg,
    ciLowKg: centralKg - band,
    ciHighKg: centralKg + band,
  };
}

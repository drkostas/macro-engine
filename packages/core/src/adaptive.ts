/**
 * M5 Phase A — Adaptive Systems TypeScript mirror.
 * Source of truth: src/macro_engine/adaptive.py
 * Research basis: SOMA-NUTRITION-SCIENCE-V2.md §4
 */

import type { Tier } from "./safety-rails";
import type { DayPoint } from "./body-comp";

// ============================================================================
// M5.1 Adaptive TDEE
// ============================================================================

const KCAL_PER_KG_BW = 7700;
const ADAPTIVE_TDEE_MIN_DAYS = 7;
const ADAPTIVE_TDEE_WINDOW_DAYS = 14;
const DRIFT_THRESHOLD_PCT = 10;

export interface AdaptiveTdeeResult {
  effectiveTdee: number;
  reportedTdee: number;
  discrepancyPct: number;
  driftFlag: boolean;
}

export function computeAdaptiveTdee(
  days: DayPoint[],
  opts: { windowDays?: number; minDays?: number } = {},
): AdaptiveTdeeResult | null {
  const windowDays = opts.windowDays ?? ADAPTIVE_TDEE_WINDOW_DAYS;
  const minDays = opts.minDays ?? ADAPTIVE_TDEE_MIN_DAYS;
  if (days.length < minDays) return null;

  const window = days.slice(-windowDays);
  const n = window.length;
  const avgIntake = window.reduce((s, d) => s + d.intakeKcal, 0) / n;
  const weightDelta = window[0].weightKg - window[n - 1].weightKg;
  const daysSpan = Math.max(1, n - 1);
  const effectiveTdee = avgIntake + (weightDelta * KCAL_PER_KG_BW) / daysSpan;

  const reported = window.reduce((s, d) => s + d.tdeeKcal, 0) / n;
  if (reported <= 0) return null;

  const discrepancyPct = (Math.abs(effectiveTdee - reported) / reported) * 100;

  let driftFlag = false;
  if (n >= 7) {
    const recent = window.slice(-7);
    let drift = 0;
    for (const d of recent) {
      if (d.tdeeKcal <= 0) continue;
      const dayDisc = (Math.abs(effectiveTdee - d.tdeeKcal) / d.tdeeKcal) * 100;
      if (dayDisc > DRIFT_THRESHOLD_PCT) drift++;
    }
    driftFlag = drift >= 5;
  }

  return { effectiveTdee, reportedTdee: reported, discrepancyPct, driftFlag };
}

// ============================================================================
// M5.2 Refeed Pressure Score
// ============================================================================

const TIER_BONUS: Record<Tier, number> = { T1: 0, T2: 0, T3: 5, T4: 10, T5: 10 };

export function computeRefeedPressureScore(opts: {
  deficitDays: number;
  weightStallDays: number;
  hrv7dTrendPct: number;
  readinessAvg: number;
  bfTier: Tier;
  weightLossVelocityPctPerWk: number;
}): number {
  let score = 0;
  score += Math.min(25, (opts.deficitDays / 56) * 25);
  score += Math.min(20, (opts.weightStallDays / 14) * 20);
  if (opts.hrv7dTrendPct <= -5) {
    score += Math.min(15, (Math.abs(opts.hrv7dTrendPct) / 15) * 15);
  }
  if (opts.readinessAvg < 60) {
    score += Math.min(10, ((60 - opts.readinessAvg) / 30) * 10);
  }
  score += TIER_BONUS[opts.bfTier];
  if (opts.weightLossVelocityPctPerWk > 1.0) {
    score += Math.min(
      20,
      ((opts.weightLossVelocityPctPerWk - 1.0) / 1.0) * 20,
    );
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

// ============================================================================
// M5.3 Diet Break
// ============================================================================

export type DietBreakLevel = "none" | "suggested" | "strong" | "mandatory";

export function recommendDietBreak(deficitDurationDays: number): DietBreakLevel {
  if (deficitDurationDays < 56) return "none";
  if (deficitDurationDays < 84) return "suggested";
  if (deficitDurationDays < 112) return "strong";
  return "mandatory";
}

// ============================================================================
// M5.4 Plateau Detection
// ============================================================================

const PLATEAU_MIN_DAYS = 21;
const PLATEAU_SLOPE_THRESHOLD_KG_PER_WK = 0.185;
const PLATEAU_WATER_DAYS = 14;

export type PlateauType = "adaptation" | "intake_creep" | "water" | "recomp";

export interface PlateauResult {
  isPlateau: boolean;
  emaSlopeKgPerWk: number;
  type: PlateauType | null;
  daysStalled: number;
}

function linearSlopePerDay(weights: number[]): number {
  const n = weights.length;
  if (n < 2) return 0;
  const xMean = (n - 1) / 2;
  const yMean = weights.reduce((s, v) => s + v, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (weights[i] - yMean);
    den += (i - xMean) ** 2;
  }
  return den ? num / den : 0;
}

export function detectPlateau(
  weightDays: DayPoint[],
  opts: {
    hungerElevated?: boolean;
    strengthImproving?: boolean;
    tdeeStable: boolean;
  },
): PlateauResult {
  if (weightDays.length < PLATEAU_MIN_DAYS) {
    return { isPlateau: false, emaSlopeKgPerWk: 0, type: null, daysStalled: 0 };
  }

  const slopePerDay = linearSlopePerDay(weightDays.map((d) => d.weightKg));
  const slopePerWk = slopePerDay * 7;
  const daysStalled = weightDays.length;

  if (opts.strengthImproving) {
    return {
      isPlateau: false, emaSlopeKgPerWk: slopePerWk,
      type: "recomp", daysStalled,
    };
  }

  if (!opts.tdeeStable) {
    return {
      isPlateau: false, emaSlopeKgPerWk: slopePerWk,
      type: null, daysStalled,
    };
  }

  if (Math.abs(slopePerWk) > PLATEAU_SLOPE_THRESHOLD_KG_PER_WK) {
    return {
      isPlateau: false, emaSlopeKgPerWk: slopePerWk,
      type: null, daysStalled,
    };
  }

  let type: PlateauType;
  if (opts.hungerElevated) type = "adaptation";
  else if (daysStalled < PLATEAU_WATER_DAYS) type = "water";
  else type = "intake_creep";

  return { isPlateau: true, emaSlopeKgPerWk: slopePerWk, type, daysStalled };
}

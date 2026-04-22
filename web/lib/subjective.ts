/**
 * M7 Phase A — Subjective signals TypeScript mirror.
 * Source of truth: src/macro_engine/subjective.py
 * Research basis: SOMA-NUTRITION-SCIENCE-V2.md §9 / V3
 */

// ============================================================================
// M7.1 Hooper 4-item
// ============================================================================

export type HooperQuality = "good" | "moderate" | "poor";

export interface HooperScore {
  total: number;
  fatigue: number;
  sleep: number;
  stress: number;
  soreness: number;
  quality: HooperQuality;
}

function validateHooperItem(name: string, value: number): void {
  if (!(value >= 1 && value <= 7)) {
    throw new RangeError(`${name} must be 1-7, got ${value}`);
  }
}

export function computeHooperScore(opts: {
  fatigue: number;
  sleep: number;
  stress: number;
  soreness: number;
}): HooperScore {
  for (const [k, v] of Object.entries(opts)) validateHooperItem(k, v);
  const total = opts.fatigue + opts.sleep + opts.stress + opts.soreness;
  const quality: HooperQuality =
    total <= 10 ? "good" : total <= 17 ? "moderate" : "poor";
  return { total, quality, ...opts };
}

// ============================================================================
// M7.2 Hooper Z-score alert
// ============================================================================

export type AlertLevel = "normal" | "elevated" | "high";

export interface HooperAlert {
  zScore: number;
  alertLevel: AlertLevel;
  baselineMean: number;
  baselineStd: number;
}

const HOOPER_ALERT_MIN_HISTORY = 14;
const HOOPER_ALERT_WINDOW = 28;

function pstdev(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const m = values.reduce((s, v) => s + v, 0) / n;
  const variance = values.reduce((s, v) => s + (v - m) ** 2, 0) / n;
  return Math.sqrt(variance);
}

export function computeHooperAlert(
  todayTotal: number,
  history: number[],
): HooperAlert {
  if (history.length < HOOPER_ALERT_MIN_HISTORY) {
    return { zScore: 0, alertLevel: "normal", baselineMean: 0, baselineStd: 0 };
  }
  const window = history.slice(-HOOPER_ALERT_WINDOW);
  const mean = window.reduce((s, v) => s + v, 0) / window.length;
  const std = pstdev(window);
  if (std === 0) {
    return { zScore: 0, alertLevel: "normal", baselineMean: mean, baselineStd: 0 };
  }
  const z = (todayTotal - mean) / std;
  const level: AlertLevel =
    Math.abs(z) <= 1 ? "normal" : Math.abs(z) <= 2 ? "elevated" : "high";
  return { zScore: z, alertLevel: level, baselineMean: mean, baselineStd: std };
}

// ============================================================================
// M7.3 Foster session RPE + weekly monotony/strain
// ============================================================================

const MONOTONY_CAP = 100;

export function sessionStrain(rpe010: number, durationMin: number): number {
  if (rpe010 < 0 || rpe010 > 10) throw new RangeError(`rpe must be 0-10, got ${rpe010}`);
  if (durationMin < 0) throw new RangeError(`durationMin must be >= 0, got ${durationMin}`);
  return rpe010 * durationMin;
}

export interface WeeklyStrain {
  total: number;
  monotony: number;
  strain: number;
}

export function computeWeeklyStrain(dailyStrains7d: number[]): WeeklyStrain {
  if (dailyStrains7d.length === 0) return { total: 0, monotony: 0, strain: 0 };
  const total = dailyStrains7d.reduce((s, v) => s + v, 0);
  const mean = total / dailyStrains7d.length;
  const std = pstdev(dailyStrains7d);
  const monotony = std === 0 ? (mean > 0 ? MONOTONY_CAP : 0) : mean / std;
  return { total, monotony, strain: total * monotony };
}

// ============================================================================
// M7.4 PHQ-2 + SCOFF
// ============================================================================

const PHQ2_TRIGGER_THRESHOLD = 3;
const SCOFF_FLAG_THRESHOLD = 2;

export function phq2Score(
  littleInterest: number,
  feelingDown: number,
): { score: number; triggersPhq9: boolean } {
  for (const [name, v] of [["littleInterest", littleInterest], ["feelingDown", feelingDown]] as const) {
    if (!(v >= 0 && v <= 3)) throw new RangeError(`${name} must be 0-3, got ${v}`);
  }
  const score = littleInterest + feelingDown;
  return { score, triggersPhq9: score >= PHQ2_TRIGGER_THRESHOLD };
}

export function scoffScore(opts: {
  sickAfterFull: boolean;
  worryControl: boolean;
  oneStone3mo: boolean;
  fatWhenThin: boolean;
  foodDominates: boolean;
}): { score: number; flagged: boolean } {
  const score = [
    opts.sickAfterFull, opts.worryControl, opts.oneStone3mo,
    opts.fatWhenThin, opts.foodDominates,
  ].filter(Boolean).length;
  return { score, flagged: score >= SCOFF_FLAG_THRESHOLD };
}

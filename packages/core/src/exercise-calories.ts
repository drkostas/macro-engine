/**
 * Exercise / workout-step calorie estimation (Keytel HR formula + EPOC).
 * Ported from soma sync/src/nutrition_engine/tdee.py (estimate/compute exercise calories).
 */

export const HR_ZONE_MIDPOINTS: Record<number, number> = { 1: 115, 2: 140, 3: 158, 4: 172, 5: 183 };
export const EPOC_BY_ZONE: Record<number, number> = { 1: 0.02, 2: 0.05, 3: 0.08, 4: 0.12, 5: 0.15 };
export const DEFAULT_PACE_BY_ZONE: Record<number, number> = { 1: 420, 2: 360, 3: 320, 4: 280, 5: 250 };
export const GYM_KCAL_PER_MIN = 6;
export const GYM_EPOC_FRACTION = 0.10;

export interface WorkoutStep {
  duration_type?: string;
  duration_value?: number;
  target_pace_min?: number | null;
  target_pace_max?: number | null;
  hr_zone?: number;
}

/** Keytel et al. (2005) kcal/min at a given HR. sex !== "female" → male. */
export function keytelKcalPerMin(hr: number, weightKg: number, age: number, sex: string): number {
  if (sex === "female") {
    return (-20.4022 + 0.4472 * hr - 0.1263 * weightKg + 0.074 * age) / 4.184;
  }
  return (-55.0969 + 0.6309 * hr + 0.1988 * weightKg + 0.2017 * age) / 4.184;
}

/** Estimate a workout step's duration in minutes (time / distance-via-pace / lap-button). */
export function estimateStepDurationMin(step: WorkoutStep): number {
  const dtype = step.duration_type ?? "";
  const value = step.duration_value ?? 0;
  if (value === 0 || dtype === "lap_button") return 0.0;
  if (dtype === "time") return value / 60.0;
  if (dtype === "distance") {
    const distKm = value / 1000.0;
    const pmin = step.target_pace_min;
    const pmax = step.target_pace_max;
    let avgPace: number;
    if (pmin && pmax) avgPace = (pmin + pmax) / 2.0;
    else if (pmin) avgPace = pmin;
    else if (pmax) avgPace = pmax;
    else avgPace = DEFAULT_PACE_BY_ZONE[step.hr_zone ?? 2] ?? 360;
    return (distKm * avgPace) / 60.0;
  }
  return 0.0;
}

/** Calories for a single workout step (Keytel × duration × EPOC). */
export function estimateStepCalories(step: WorkoutStep, weightKg: number, age: number, sex: string): number {
  const durationMin = estimateStepDurationMin(step);
  if (durationMin <= 0) return 0.0;
  const zone = step.hr_zone ?? 2;
  const hr = HR_ZONE_MIDPOINTS[zone] ?? 140;
  const basePerMin = keytelKcalPerMin(hr, weightKg, age, sex);
  const epocMult = 1.0 + (EPOC_BY_ZONE[zone] ?? 0.05);
  return basePerMin * durationMin * epocMult;
}

/** Sum calories across workout steps + optional gym; distance fallback when no steps. */
export function computeExerciseCalories(opts: {
  workoutSteps: WorkoutStep[] | null;
  weightKg: number;
  age: number;
  sex: string;
  hasGym?: boolean;
  gymDurationMin?: number;
  runDistanceKm?: number;
}): number {
  const { workoutSteps, weightKg, age, sex, hasGym = false, gymDurationMin = 60, runDistanceKm = 0 } = opts;
  let total = 0.0;
  if (workoutSteps) {
    for (const step of workoutSteps) total += estimateStepCalories(step, weightKg, age, sex);
  }
  if (total === 0 && runDistanceKm > 0) total = runDistanceKm * 1.0 * weightKg;
  if (hasGym) total += gymDurationMin * GYM_KCAL_PER_MIN * (1 + GYM_EPOC_FRACTION);
  return total;
}

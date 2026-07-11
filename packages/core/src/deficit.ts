/**
 * Deficit-from-goal: daily kcal deficit to reach a body-fat % target.
 *
 * Ported from soma sync/src/nutrition_engine/tdee.py::compute_deficit_from_goal.
 * Constant-FFM assumption (only fat mass changes). Parity-tested against the
 * Python (golden fixtures) — including Python's round-half-to-even.
 */

export const KCAL_PER_KG_FAT = 7700;
export const MAX_DEFICIT = 1200; // safety cap; above risks metabolic adaptation

export type Safety = "green" | "yellow" | "red";

export interface DeficitFromGoal {
  daily_deficit: number;
  fat_to_lose_kg: number;
  timeline_weeks: number;
  weekly_rate_pct: number;
  safety: Safety;
}

/** Python's round(): round half to even ("banker's rounding") — but only on an
 *  EXACT half; any float excess past .5 rounds normally, matching CPython. */
export function pyRound(x: number, ndigits = 0): number {
  const m = 10 ** ndigits;
  const scaled = x * m;
  const floor = Math.floor(scaled);
  const diff = scaled - floor;
  let r: number;
  if (diff === 0.5) r = floor % 2 === 0 ? floor : floor + 1; // exact half → even
  else r = Math.round(scaled); // non-half: Math.round agrees with Python
  return r / m;
}

function daysBetween(fromISO: string, toISO: string): number {
  const a = Date.parse(`${fromISO}T00:00:00Z`);
  const b = Date.parse(`${toISO}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export function computeDeficitFromGoal(opts: {
  weightKg: number;
  currentBfPct: number;
  targetBfPct: number;
  targetDate: string; // ISO YYYY-MM-DD
  today: string; // ISO YYYY-MM-DD
}): DeficitFromGoal {
  const { weightKg, currentBfPct, targetBfPct, targetDate, today } = opts;

  // Fat-free mass stays constant; only fat mass changes.
  const ffmKg = weightKg * (1 - currentBfPct / 100);
  const targetWeight = ffmKg / (1 - targetBfPct / 100);
  const fatToLose = weightKg - targetWeight;

  if (fatToLose <= 0) {
    return { daily_deficit: 0, fat_to_lose_kg: 0, timeline_weeks: 0, weekly_rate_pct: 0, safety: "green" };
  }

  const availableDays = Math.max(daysBetween(today, targetDate), 1);
  const availableWeeks = availableDays / 7;

  const rawDeficit = (fatToLose * KCAL_PER_KG_FAT) / availableDays;
  const weeklyRatePct = (fatToLose / availableWeeks) / weightKg * 100;

  let safety: Safety;
  if (rawDeficit > 500 || weeklyRatePct > 1.0) safety = "red";
  else if (rawDeficit > 400 || weeklyRatePct > 0.7) safety = "yellow";
  else safety = "green";

  const cappedDeficit = Math.min(rawDeficit, MAX_DEFICIT);

  return {
    daily_deficit: pyRound(cappedDeficit),
    fat_to_lose_kg: pyRound(fatToLose, 1),
    timeline_weeks: pyRound(availableWeeks, 1),
    weekly_rate_pct: pyRound(weeklyRatePct, 2),
    safety,
  };
}

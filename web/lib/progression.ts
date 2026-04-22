/**
 * M10 Phase B — Progression TS mirror.
 * Source of truth: src/macro_engine/progression.py
 */

const ADHERENCE_TOLERANCE = 0.10;
export const ALLOWED_WINDOWS: readonly number[] = [30, 60, 90] as const;

export interface DayRecord {
  day: string; // ISO YYYY-MM-DD
  targetKcal: number;
  actualKcal: number;
  weightKg: number | null;
  hadTraining: boolean;
  wasClosed: boolean;
  tdeeKcal: number | null;
}

export interface ProgressionWindow {
  windowDays: number;
  daysTotal: number;
  daysClosed: number;
  weightDeltaKg: number | null;
  weightDeltaPerWeek: number | null;
  adherenceAvgPct: number;
  avgDailyDeficit: number;
  trainingDays: number;
}

function dayHitsTarget(d: DayRecord): boolean {
  if (d.targetKcal <= 0) return false;
  return Math.abs(d.actualKcal - d.targetKcal) / d.targetKcal <= ADHERENCE_TOLERANCE;
}

function dayDeficit(d: DayRecord): number {
  if (d.tdeeKcal !== null && d.tdeeKcal !== undefined) {
    return Math.round(d.tdeeKcal - d.actualKcal);
  }
  if (d.targetKcal > 0) return Math.round(d.targetKcal - d.actualKcal);
  return 0;
}

function daysBetween(a: string, b: string): number {
  const aMs = Date.parse(a + "T00:00:00Z");
  const bMs = Date.parse(b + "T00:00:00Z");
  return Math.round((aMs - bMs) / 86400000);
}

export function computeProgressionWindow(
  days: DayRecord[],
  opts: { weightKg: number; windowDays: number },
): ProgressionWindow {
  if (!ALLOWED_WINDOWS.includes(opts.windowDays)) {
    throw new RangeError(
      `windowDays must be one of ${[...ALLOWED_WINDOWS].join(", ")}, got ${opts.windowDays}`,
    );
  }

  if (days.length === 0) {
    return {
      windowDays: opts.windowDays,
      daysTotal: 0, daysClosed: 0,
      weightDeltaKg: null, weightDeltaPerWeek: null,
      adherenceAvgPct: 0, avgDailyDeficit: 0, trainingDays: 0,
    };
  }

  const ordered = [...days].sort((a, b) => a.day.localeCompare(b.day));
  const closed = ordered.filter((d) => d.wasClosed);

  const hits = closed.filter(dayHitsTarget).length;
  const adherenceAvgPct = closed.length > 0
    ? Math.round((100 * hits) / closed.length)
    : 0;

  const avgDailyDeficit = closed.length > 0
    ? Math.round(closed.reduce((s, d) => s + dayDeficit(d), 0) / closed.length)
    : 0;

  const trainingDays = ordered.filter((d) => d.hadTraining).length;

  const weights = ordered.filter((d) => d.weightKg !== null && d.weightKg !== undefined);
  let weightDeltaKg: number | null = null;
  let weightDeltaPerWeek: number | null = null;
  if (weights.length >= 2) {
    const first = weights[0];
    const last = weights[weights.length - 1];
    weightDeltaKg = Math.round(((last.weightKg as number) - (first.weightKg as number)) * 100) / 100;
    const span = Math.max(1, daysBetween(last.day, first.day));
    weightDeltaPerWeek = Math.round((weightDeltaKg / span) * 7 * 100) / 100;
  }

  return {
    windowDays: opts.windowDays,
    daysTotal: ordered.length,
    daysClosed: closed.length,
    weightDeltaKg,
    weightDeltaPerWeek,
    adherenceAvgPct,
    avgDailyDeficit,
    trainingDays,
  };
}

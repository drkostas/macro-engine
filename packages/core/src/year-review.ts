/**
 * M10 Phase C — Year-in-review TS mirror.
 * Source of truth: src/macro_engine/year_review.py
 */

const ADHERENCE_TOLERANCE = 0.10;
const MIN_YEAR = 1970;
const MAX_YEAR = 9999;

export interface YearDayRecord {
  day: string; // ISO YYYY-MM-DD
  targetKcal: number;
  actualKcal: number;
  proteinG: number;
  weightKg: number | null;
  hadTraining: boolean;
  wasClosed: boolean;
}

export interface MonthSummary {
  month: number; // 1-12
  daysTracked: number;
  daysClosed: number;
  adherencePct: number;
  avgKcal: number;
  trainingDays: number;
}

export interface YearReview {
  year: number;
  totalDaysTracked: number;
  daysClosed: number;
  overallAdherencePct: number;
  weightStart: number | null;
  weightEnd: number | null;
  weightDeltaKg: number | null;
  avgKcal: number;
  avgProteinG: number;
  bestStreak: number;
  trainingDaysTotal: number;
  months: MonthSummary[];
}

function dayYear(iso: string): number {
  return Number(iso.slice(0, 4));
}

function dayMonth(iso: string): number {
  return Number(iso.slice(5, 7));
}

function dayHitsTarget(d: YearDayRecord): boolean {
  if (d.targetKcal <= 0) return false;
  return Math.abs(d.actualKcal - d.targetKcal) / d.targetKcal <= ADHERENCE_TOLERANCE;
}

function bestClosedStreak(ordered: YearDayRecord[]): number {
  let best = 0;
  let cur = 0;
  for (const d of ordered) {
    if (d.wasClosed) {
      cur += 1;
      if (cur > best) best = cur;
    } else {
      cur = 0;
    }
  }
  return best;
}

function emptyMonth(m: number): MonthSummary {
  return {
    month: m, daysTracked: 0, daysClosed: 0,
    adherencePct: 0, avgKcal: 0, trainingDays: 0,
  };
}

export function computeYearReview(
  days: YearDayRecord[],
  opts: { year: number },
): YearReview {
  if (opts.year < MIN_YEAR || opts.year > MAX_YEAR) {
    throw new RangeError(`year must be in [${MIN_YEAR}, ${MAX_YEAR}], got ${opts.year}`);
  }

  const scoped = days.filter((d) => dayYear(d.day) === opts.year);
  const ordered = [...scoped].sort((a, b) => a.day.localeCompare(b.day));

  if (ordered.length === 0) {
    return {
      year: opts.year,
      totalDaysTracked: 0, daysClosed: 0,
      overallAdherencePct: 0,
      weightStart: null, weightEnd: null, weightDeltaKg: null,
      avgKcal: 0, avgProteinG: 0,
      bestStreak: 0, trainingDaysTotal: 0,
      months: Array.from({ length: 12 }, (_, i) => emptyMonth(i + 1)),
    };
  }

  const closed = ordered.filter((d) => d.wasClosed);
  const hits = closed.filter(dayHitsTarget).length;
  const overallAdherencePct = closed.length > 0
    ? Math.round((100 * hits) / closed.length) : 0;

  const avgKcal = closed.length > 0
    ? Math.round(closed.reduce((s, d) => s + d.actualKcal, 0) / closed.length) : 0;
  const avgProteinG = closed.length > 0
    ? Math.round(closed.reduce((s, d) => s + d.proteinG, 0) / closed.length) : 0;

  const trainingDaysTotal = ordered.filter((d) => d.hadTraining).length;
  const bestStreak = bestClosedStreak(ordered);

  const weights = ordered
    .filter((d) => d.weightKg !== null && d.weightKg !== undefined)
    .map((d) => d.weightKg as number);
  const weightStart = weights.length > 0 ? weights[0] : null;
  const weightEnd = weights.length > 0 ? weights[weights.length - 1] : null;
  const weightDeltaKg = weightStart !== null && weightEnd !== null
    ? Math.round((weightEnd - weightStart) * 100) / 100 : null;

  const months: MonthSummary[] = [];
  for (let m = 1; m <= 12; m++) {
    const inMonth = ordered.filter((d) => dayMonth(d.day) === m);
    const inClosed = inMonth.filter((d) => d.wasClosed);
    const mHits = inClosed.filter(dayHitsTarget).length;
    months.push({
      month: m,
      daysTracked: inMonth.length,
      daysClosed: inClosed.length,
      adherencePct: inClosed.length > 0
        ? Math.round((100 * mHits) / inClosed.length) : 0,
      avgKcal: inClosed.length > 0
        ? Math.round(inClosed.reduce((s, d) => s + d.actualKcal, 0) / inClosed.length)
        : 0,
      trainingDays: inMonth.filter((d) => d.hadTraining).length,
    });
  }

  return {
    year: opts.year,
    totalDaysTracked: ordered.length,
    daysClosed: closed.length,
    overallAdherencePct,
    weightStart,
    weightEnd,
    weightDeltaKg,
    avgKcal,
    avgProteinG,
    bestStreak,
    trainingDaysTotal,
    months,
  };
}

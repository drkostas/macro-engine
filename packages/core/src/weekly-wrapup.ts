/**
 * M10 Phase A — Weekly wrap-up TS mirror.
 * Source of truth: src/macro_engine/weekly_wrapup.py
 */

const ADHERENCE_TOLERANCE = 0.10;

export interface DayRecord {
  day: string; // ISO YYYY-MM-DD
  targetKcal: number;
  actualKcal: number;
  proteinG: number;
  weightKg: number | null;
  hadTraining: boolean;
  wasClosed: boolean;
}

export type Grade = "A" | "B" | "C" | "D" | "F";

export interface WeeklyWrapup {
  weekStart: string | null;
  weekEnd: string | null;
  daysTotal: number;
  daysClosed: number;
  adherencePct: number;
  avgKcal: number;
  avgProteinG: number;
  avgProteinGPerKg: number;
  trainingDays: number;
  weightDeltaKg: number | null;
  grade: Grade;
}

function dayHitsTarget(d: DayRecord): boolean {
  if (d.targetKcal <= 0) return false;
  return Math.abs(d.actualKcal - d.targetKcal) / d.targetKcal <= ADHERENCE_TOLERANCE;
}

export function adherenceGrade(pct: number): Grade {
  if (pct >= 90) return "A";
  if (pct >= 80) return "B";
  if (pct >= 70) return "C";
  if (pct >= 60) return "D";
  return "F";
}

export function computeWeeklyWrapup(
  days: DayRecord[],
  opts: { weightKg: number },
): WeeklyWrapup {
  if (days.length === 0) {
    return {
      weekStart: null, weekEnd: null,
      daysTotal: 0, daysClosed: 0,
      adherencePct: 0,
      avgKcal: 0, avgProteinG: 0, avgProteinGPerKg: 0,
      trainingDays: 0,
      weightDeltaKg: null,
      grade: "F",
    };
  }

  const ordered = [...days].sort((a, b) => a.day.localeCompare(b.day));
  const closed = ordered.filter((d) => d.wasClosed);
  const hits = closed.filter(dayHitsTarget).length;
  const adherencePct = closed.length > 0 ? Math.round((100 * hits) / closed.length) : 0;

  const avgKcal = closed.length > 0
    ? Math.round(closed.reduce((s, d) => s + d.actualKcal, 0) / closed.length)
    : 0;
  const avgProteinG = closed.length > 0
    ? Math.round(closed.reduce((s, d) => s + d.proteinG, 0) / closed.length)
    : 0;
  const avgProteinGPerKg = opts.weightKg > 0
    ? Math.round((avgProteinG / opts.weightKg) * 100) / 100
    : 0;

  const trainingDays = ordered.filter((d) => d.hadTraining).length;

  const weights = ordered.filter((d) => d.weightKg !== null && d.weightKg !== undefined);
  const weightDeltaKg = weights.length >= 2
    ? Math.round(((weights[weights.length - 1].weightKg as number) - (weights[0].weightKg as number)) * 100) / 100
    : null;

  return {
    weekStart: ordered[0].day,
    weekEnd: ordered[ordered.length - 1].day,
    daysTotal: ordered.length,
    daysClosed: closed.length,
    adherencePct,
    avgKcal,
    avgProteinG,
    avgProteinGPerKg,
    trainingDays,
    weightDeltaKg,
    grade: adherenceGrade(adherencePct),
  };
}

export function wrapupTakeaway(w: WeeklyWrapup): string {
  if (w.daysTotal === 0) {
    return "Not enough data yet — close a few days to see your weekly wrap-up.";
  }
  if (w.daysClosed === 0) {
    return "No closed days this week. Close a day to build your adherence score.";
  }
  const parts: string[] = [];
  if (w.adherencePct >= 90) parts.push("Strong week on track");
  else if (w.adherencePct >= 80) parts.push("Solid adherence");
  else if (w.adherencePct >= 70) parts.push("Mixed week");
  else parts.push("Off track — calories ran over or under target");

  if (w.avgProteinGPerKg > 0) {
    parts.push(`protein averaged ${w.avgProteinGPerKg.toFixed(1)} g/kg`);
  }
  if (w.trainingDays > 0) {
    parts.push(`${w.trainingDays} training day${w.trainingDays === 1 ? "" : "s"}`);
  }
  if (w.weightDeltaKg !== null) {
    if (w.weightDeltaKg === 0) parts.push("weight flat");
    else if (w.weightDeltaKg < 0) parts.push(`weight down ${Math.abs(w.weightDeltaKg).toFixed(1)} kg`);
    else parts.push(`weight up ${w.weightDeltaKg.toFixed(1)} kg`);
  }
  return parts.join(". ") + ".";
}

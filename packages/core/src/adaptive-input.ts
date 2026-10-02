/**
 * The inputs adaptive TDEE needs, built from logged days and weigh-ins.
 *
 * A day counts only when it is closed and its logging coverage clears the floor (see coverage),
 * so a day closed with nothing logged contributes nothing.
 */
import { meetsCoverageFloor, daysBetween, STREAK_MAX_GAP_DAYS } from "./coverage";
import type { WeighIn } from "./weigh-in";

export type { WeighIn };

export interface DayRow {
  date: string;
  actual_calories: number | null;
  tdee_used: number | null;
  target_calories: number | null;
  deficit_used: number | null;
  is_diet_break: boolean | null;
  is_refeed: boolean | null;
  status: string | null;
  /**
   * Logging coverage 0..1 (see lib/coverage). A closed day below the floor is
   * ABSENT data wearing a "closed" badge: it contributes nothing, exactly like
   * an unclosed day. `null` means unknown and also contributes nothing.
   */
  coverage: number | null;
}

/**
 * A day counts toward any inference only when it is closed AND its logging
 * coverage clears the floor. This is the single guard behind #699: the 53
 * May–Jun 2026 days that were closed with zero meal_log rows fail it.
 */
export function contributes(r: DayRow): boolean {
  return r.status === "closed" && meetsCoverageFloor(r.coverage);
}

/**
 * Count consecutive closed deficit days ending at the most recent day, stopping
 * at the first diet break, refeed, or non-deficit day. This is the length of the
 * current deficit phase.
 */
export function countDeficitDuration(rows: DayRow[]): number {
  let n = 0;
  let lastCounted: string | null = null;
  const latest = rows.length ? rows[rows.length - 1].date : null;
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i];
    // Unclosed AND low-coverage days are both absent data: skip without
    // breaking, but they still consume calendar distance (see gap rule).
    if (!contributes(r)) continue;
    // Gap rule: a "consecutive" phase cannot span more than STREAK_MAX_GAP_DAYS
    // of absent data. Without it the walk-back crosses four empty months and
    // reports last spring's deficit as the current phase.
    const anchor = lastCounted ?? latest;
    if (anchor && daysBetween(r.date, anchor) > STREAK_MAX_GAP_DAYS) break;
    if (r.is_diet_break || r.is_refeed) break;
    if ((Number(r.deficit_used) || 0) <= 0) break;
    n++;
    lastCounted = r.date;
  }
  return n;
}

/**
 * Build the DayPoints the adaptive engine needs: last-N closed days with a real
 * intake, each carrying a forward-filled body weight. Weigh-ins rarely land on
 * the same dates as nutrition days, so we merge-walk the sorted weigh-ins and
 * carry the most recent weight at or before each day.
 */
export function buildDayPoints(
  rows: DayRow[],
  weights: WeighIn[],
): { day: number; intakeKcal: number; tdeeKcal: number; weightKg: number }[] {
  const points: { day: number; intakeKcal: number; tdeeKcal: number; weightKg: number }[] = [];
  let lastWeight = 0;
  let wi = 0;
  let idx = 0;
  for (const r of rows) {
    while (wi < weights.length && weights[wi].date <= r.date) {
      if (weights[wi].weightKg > 0) lastWeight = weights[wi].weightKg;
      wi++;
    }
    if (!contributes(r)) continue;
    const intake = Number(r.actual_calories) || 0;
    if (intake <= 0) continue;
    if (lastWeight <= 0) continue; // no weigh-in yet — skip until we have one
    // tdee: prefer the stored figure, else reconstruct target + deficit
    const tdee = Number(r.tdee_used) || (Number(r.target_calories) || 0) + (Number(r.deficit_used) || 0);
    if (tdee <= 0) continue;
    points.push({ day: idx++, intakeKcal: intake, tdeeKcal: tdee, weightKg: lastWeight });
  }
  return points;
}

/**
 * Sleep quality scoring (observability only).
 *
 * Ported from soma sync/src/nutrition_engine/daily_plan.py::classify_sleep_quality.
 *
 * NOTE: the Python module also has adjust_deficit_for_sleep / adjust_for_sleep_history,
 * which are DELIBERATELY NOT ported — they were disabled (PR 045b88a) per the standing
 * rule "sleep should not change goals — display only, the user decides". Only the
 * display score is live.
 */

/** Composite sleep quality score 0-100.
 *  0.5*duration + 0.25*deep + 0.25*garmin.
 *  Duration: 8h+=100, 5-8h linear, <5h=0. Deep: 1.5h+=100, 0.5-1.5h linear, <0.5h=0. */
export function classifySleepQuality(
  totalSeconds: number,
  deepSeconds: number,
  garminScore: number,
): number {
  const totalHours = totalSeconds / 3600.0;
  const deepHours = deepSeconds / 3600.0;

  let durationScore: number;
  if (totalHours >= 8) durationScore = 100.0;
  else if (totalHours >= 5) durationScore = ((totalHours - 5) / (8 - 5)) * 100.0;
  else durationScore = 0.0;

  let deepScore: number;
  if (deepHours >= 1.5) deepScore = 100.0;
  else if (deepHours >= 0.5) deepScore = ((deepHours - 0.5) / (1.5 - 0.5)) * 100.0;
  else deepScore = 0.0;

  const g = Math.max(0.0, Math.min(100.0, garminScore));
  const composite = 0.5 * durationScore + 0.25 * deepScore + 0.25 * g;
  return Math.max(0.0, Math.min(100.0, composite));
}

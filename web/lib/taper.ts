/**
 * M9 Phase D — Race taper TypeScript mirror.
 * Source of truth: src/macro_engine/taper.py
 * Research basis: V2 §4.5 race prep.
 */

export type TaperPhase =
  | "normal"
  | "volume_taper"
  | "intensity_taper"
  | "glycogen_loading"
  | "race_day"
  | "recovery";

const VOLUME_TAPER_MAX_DAYS = 14;
const INTENSITY_TAPER_MAX_DAYS = 7;
const GLYCOGEN_LOADING_MAX_DAYS = 3;
const RECOVERY_MAX_DAYS_POST = 7;

function daysBetween(a: Date, b: Date): number {
  // a - b in whole days, using UTC midnight alignment.
  const msA = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const msB = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.round((msA - msB) / 86400000);
}

export function classifyTaperPhase(raceDate: Date | null, today: Date): TaperPhase {
  if (raceDate === null) return "normal";
  const daysUntil = daysBetween(raceDate, today);
  if (daysUntil === 0) return "race_day";
  if (daysUntil < 0) {
    const daysSince = -daysUntil;
    if (daysSince <= RECOVERY_MAX_DAYS_POST) return "recovery";
    return "normal";
  }
  if (daysUntil <= GLYCOGEN_LOADING_MAX_DAYS) return "glycogen_loading";
  if (daysUntil <= INTENSITY_TAPER_MAX_DAYS) return "intensity_taper";
  if (daysUntil <= VOLUME_TAPER_MAX_DAYS) return "volume_taper";
  return "normal";
}

const CARB_G_PER_KG_BY_PHASE: Record<TaperPhase, number> = {
  normal: 0,
  volume_taper: 6,
  intensity_taper: 7,
  glycogen_loading: 10,
  race_day: 9,
  recovery: 7,
};

const PROTEIN_FLOOR_G_PER_KG = 1.8;

export function taperCarbGPerKg(
  phase: TaperPhase,
  opts: { baselineGPerKg: number },
): number {
  if (opts.baselineGPerKg < 0) {
    throw new RangeError(`baselineGPerKg must be non-negative`);
  }
  return Math.max(CARB_G_PER_KG_BY_PHASE[phase], opts.baselineGPerKg);
}

export function taperProteinGPerKg(
  _phase: TaperPhase,
  opts: { baselineGPerKg: number },
): number {
  if (opts.baselineGPerKg < 0) {
    throw new RangeError(`baselineGPerKg must be non-negative`);
  }
  return Math.max(PROTEIN_FLOOR_G_PER_KG, opts.baselineGPerKg);
}

/**
 * M9 Phase E — Climate adjustments TypeScript mirror.
 * Source of truth: src/macro_engine/climate.py
 * Research basis: V2 §4.5 race prep + climate.
 */

import { cunningham } from "./safety-rails";

export type Environment = "normal" | "altitude" | "heat" | "cold";
export type Sex = "M" | "F";

export interface ClimateAdjustment {
  extraFluidMl: number;
  extraSodiumMg: number;
  extraKcal: number;
  extraCarbG: number;
  ironTargetMg: number | null;
  notes: string;
}

const ALTITUDE_FLUID_BUMP_ML = 500;
const ALTITUDE_CARB_G_PER_KG = 1.0;
const ALTITUDE_IRON_MG_FEMALE = 18;
const ALTITUDE_IRON_MG_MALE = 12;

const HEAT_DEFAULT_SWEAT_L_PER_HOUR = 1.0;
const HEAT_DEFAULT_HOURS = 1.0;
const HEAT_SODIUM_MG_PER_L_SWEAT = 750;

const COLD_KCAL_BUMP_PCT = 0.10;

function emptyAdjustment(): ClimateAdjustment {
  return {
    extraFluidMl: 0,
    extraSodiumMg: 0,
    extraKcal: 0,
    extraCarbG: 0,
    ironTargetMg: null,
    notes: "",
  };
}

export function climateAdjust(
  env: Environment,
  opts: {
    weightKg: number;
    sex: Sex;
    sweatLPerHour?: number;
    hours?: number;
    bmrKcal?: number;
  },
): ClimateAdjustment {
  if (opts.weightKg < 0) {
    throw new RangeError(`weightKg must be non-negative`);
  }
  const sex = String(opts.sex).toUpperCase();
  if (sex !== "M" && sex !== "F") {
    throw new Error(`sex must be 'M' or 'F', got ${opts.sex}`);
  }
  const sweatLPerHour = opts.sweatLPerHour ?? HEAT_DEFAULT_SWEAT_L_PER_HOUR;
  const hours = opts.hours ?? HEAT_DEFAULT_HOURS;
  if (sweatLPerHour < 0 || hours < 0) {
    throw new RangeError(`sweatLPerHour and hours must be non-negative`);
  }

  if (env === "normal") return emptyAdjustment();

  if (env === "altitude") {
    return {
      ...emptyAdjustment(),
      extraFluidMl: ALTITUDE_FLUID_BUMP_ML,
      extraCarbG: Math.round(ALTITUDE_CARB_G_PER_KG * opts.weightKg),
      ironTargetMg: sex === "F" ? ALTITUDE_IRON_MG_FEMALE : ALTITUDE_IRON_MG_MALE,
      notes: "Hypoxia blunts appetite and raises iron demand; keep glycogen topped up.",
    };
  }

  if (env === "heat") {
    const totalSweatL = sweatLPerHour * hours;
    return {
      ...emptyAdjustment(),
      extraFluidMl: Math.round(totalSweatL * 1000),
      extraSodiumMg: Math.round(totalSweatL * HEAT_SODIUM_MG_PER_L_SWEAT),
      notes: "Replace 100% of sweat volume; 500-1000 mg Na per L sweat lost.",
    };
  }

  // cold
  const baseBmr = opts.bmrKcal ?? cunningham(opts.weightKg);
  return {
    ...emptyAdjustment(),
    extraKcal: Math.round(baseBmr * COLD_KCAL_BUMP_PCT),
    notes: "Thermogenic demand ~10% BMR for sustained sub-freezing exposure.",
  };
}

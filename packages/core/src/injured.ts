/**
 * M9 Phase A — Injured mode TypeScript mirror.
 * Source of truth: src/macro_engine/injured.py
 * Research basis: SOMA-NUTRITION-SCIENCE-V2.md §4.5
 */

import { cunningham } from "./safety-rails";

// ============================================================================
// M9.1 Injury phase
// ============================================================================

export type InjuryPhase = "acute" | "subacute" | "chronic";

const ACUTE_MAX_DAYS = 10;
const SUBACUTE_MAX_DAYS = 42;

export function classifyInjuryPhase(injuryDate: Date, today: Date): InjuryPhase {
  if (today < injuryDate) {
    throw new RangeError(`today must be >= injuryDate`);
  }
  const days = Math.floor((today.getTime() - injuryDate.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= ACUTE_MAX_DAYS) return "acute";
  if (days <= SUBACUTE_MAX_DAYS) return "subacute";
  return "chronic";
}

// ============================================================================
// M9.2 / M9.4 Injury type + protein + nutrition module
// ============================================================================

export type InjuryType =
  | "default"
  | "immobilization"
  | "acl"
  | "severe"
  | "tendon"
  | "concussion"
  | "bone"
  | "strain";

export const ALL_INJURY_TYPES: readonly InjuryType[] = [
  "default", "immobilization", "acl", "severe",
  "tendon", "concussion", "bone", "strain",
] as const;

const INJURY_PROTEIN_BASE_G_PER_KG: Record<InjuryType, number> = {
  default: 2.2,
  strain: 2.2,
  tendon: 2.2,
  concussion: 2.2,
  bone: 2.2,
  immobilization: 2.4,
  acl: 2.4,
  severe: 2.5,
};

export function injuryProteinGPerKg(
  injuryType: InjuryType,
  opts: { preInjuryGPerKg: number },
): number {
  const base = INJURY_PROTEIN_BASE_G_PER_KG[injuryType];
  return Math.max(base, opts.preInjuryGPerKg);
}

// ============================================================================
// M9.3 Injured EA hard floor
// ============================================================================

const INJURED_EA_PER_KG_FFM = 30;

export function injuredEaHardFloor(opts: {
  ffmKg: number;
  rehabKcal: number;
}): number {
  if (opts.ffmKg < 0) throw new RangeError(`ffmKg must be non-negative`);
  if (opts.rehabKcal < 0) throw new RangeError(`rehabKcal must be non-negative`);
  const eaFloor = INJURED_EA_PER_KG_FFM * opts.ffmKg + opts.rehabKcal;
  const bmrCunningham = cunningham(opts.ffmKg);
  return Math.max(Math.round(bmrCunningham), Math.round(eaFloor));
}

// ============================================================================
// M9.4 Nutrition module
// ============================================================================

export interface InjuryNutritionModule {
  label: string;
  supplements: string[];
  rationale: string;
}

const INJURY_MODULES: Partial<Record<InjuryType, InjuryNutritionModule>> = {
  tendon: {
    label: "Tendon/ligament recovery",
    supplements: ["gelatin", "vitamin C"],
    rationale: "Gelatin + vit C 30-60 min pre-rehab boosts collagen synthesis (Shaw 2017).",
  },
  concussion: {
    label: "Concussion recovery",
    supplements: ["creatine"],
    rationale: "Creatine monohydrate 5-20 g/day improves cognitive and functional outcomes post-TBI.",
  },
  acl: {
    label: "ACL / muscle recovery",
    supplements: ["omega-3"],
    rationale: "EPA + DHA 3 g/day offsets disuse-driven muscle protein breakdown.",
  },
  bone: {
    label: "Bone recovery",
    supplements: ["calcium", "vitamin D"],
    rationale: "Ca 1000-1500 mg + vit D 1000-2000 IU/day supports callus formation.",
  },
  strain: {
    label: "Standard recovery",
    supplements: [],
    rationale: "No specific supplement stack — prioritize protein tier + sleep + whole-food quality.",
  },
};

export function getInjuryModule(injuryType: InjuryType): InjuryNutritionModule {
  return INJURY_MODULES[injuryType] ?? INJURY_MODULES.strain!;
}

/**
 * MacroEngine - Pure computation functions for nutrition math.
 *
 * Extracted from soma web/app/api/nutrition/plan/route.ts.
 * No DB calls, no framework dependencies. Pure TypeScript.
  * Canonical spec: the Python macro_engine library this was ported from (removed 2026-09-11; see git history before that date).
 */

// -- Constants ---------------------------------------------------------------

/** Per-macro slot distribution (protein timing matters for MPS) */
export const SLOT_DISTRIBUTION: Record<string, Record<string, number>> = {
  breakfast: { calories: 0.28, protein: 0.25, carbs: 0.28, fat: 0.28, fiber: 0.20 },
  lunch:     { calories: 0.25, protein: 0.25, carbs: 0.25, fat: 0.25, fiber: 0.30 },
  dinner:    { calories: 0.37, protein: 0.32, carbs: 0.37, fat: 0.37, fiber: 0.35 },
  pre_sleep: { calories: 0.10, protein: 0.18, carbs: 0.10, fat: 0.10, fiber: 0.15 },
};

export const DEFAULT_SLOTS = ["breakfast", "lunch", "dinner", "pre_sleep"];

export const CARB_TARGETS_G_PER_KG: Record<string, number> = {
  rest: 3.0,
  easy_run: 3.5,
  hard_run: 4.25,
  long_run: 4.75,
  gym: 3.5,
  gym_and_run: 4.0,
};

const MIN_NEAT_STEPS = 3000;

// -- Types -------------------------------------------------------------------

export interface MacroTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface SlotBudget extends MacroTargets {
  slot: string;
}

export interface TdeeComponents {
  bmr: number;
  stepCalories: number;
  runCalories: number;
  gymCalories: number;
  deficit: number;
  total: number;
  targetCalories: number;
}

// -- TDEE --------------------------------------------------------------------

export function computeStepCalories(
  steps: number,
  weightKg: number,
  runSteps: number = 0,
): number {
  const neatSteps = Math.max(steps - runSteps, MIN_NEAT_STEPS);
  return Math.round(neatSteps * 0.000423 * weightKg * 100) / 100;
}

export function computeRunCalories(
  distanceKm: number,
  weightKg: number,
): number {
  return Math.round(distanceKm * 1.0 * weightKg);
}

export function computeTdee(
  bmr: number,
  stepCalories: number,
  runCalories: number,
  gymCalories: number,
  deficit: number,
): TdeeComponents {
  const total = bmr + stepCalories + runCalories + gymCalories;
  return {
    bmr,
    stepCalories,
    runCalories,
    gymCalories,
    deficit,
    total,
    targetCalories: Math.round(total - deficit),
  };
}

// -- Macro Targets -----------------------------------------------------------

export interface MacroTargetOptions {
  targetCalories: number;
  weightKg: number;
  proteinGPerKg?: number;
  fatGPerKg?: number;
  trainingDayType?: string;
  carbPeriodization?: boolean;
}

export function computeMacroTargets(opts: MacroTargetOptions): MacroTargets {
  const {
    targetCalories,
    weightKg,
    proteinGPerKg = 2.2,
    fatGPerKg = 0.8,
    trainingDayType = "rest",
    carbPeriodization = false,
  } = opts;

  const protein = Math.round(proteinGPerKg * weightKg);
  const FAT_FLOOR_G_PER_KG = 0.6;

  let fat: number;
  let carbs: number;

  if (carbPeriodization && trainingDayType in CARB_TARGETS_G_PER_KG) {
    const carbTarget = CARB_TARGETS_G_PER_KG[trainingDayType] * weightKg;
    const fatRemainder =
      (targetCalories - protein * 4 - carbTarget * 4) / 9;

    if (fatRemainder >= FAT_FLOOR_G_PER_KG * weightKg) {
      fat = Math.round(fatRemainder);
      carbs = Math.round(carbTarget);
    } else {
      fat = Math.round(FAT_FLOOR_G_PER_KG * weightKg);
      carbs = Math.round(
        Math.max((targetCalories - protein * 4 - fat * 9) / 4, 0),
      );
    }
  } else {
    fat = Math.round(fatGPerKg * weightKg);
    carbs = Math.round(
      Math.max((targetCalories - protein * 4 - fat * 9) / 4, 0),
    );
  }

  // Fiber: ~14g per 1000 kcal is the standard recommendation
  const fiber = Math.round(targetCalories * 14 / 1000);

  return { calories: targetCalories, protein, carbs, fat, fiber };
}

// -- Alcohol Offset ----------------------------------------------------------

export function applyAlcoholOffset(
  targets: MacroTargets,
  drinkCalories: number,
): MacroTargets {
  if (drinkCalories <= 0) return { ...targets };

  // Reduce total calorie budget AND offset carbs/fat (soma approach)
  const adjustedCalories = Math.max(0, targets.calories - drinkCalories);
  let rem = drinkCalories;
  const carbCut = Math.min(Math.round(rem / 4), targets.carbs);
  rem -= carbCut * 4;
  const fatCut = rem > 0 ? Math.min(Math.round(rem / 9), targets.fat) : 0;

  return {
    ...targets,
    calories: adjustedCalories,
    carbs: targets.carbs - carbCut,
    fat: targets.fat - fatCut,
  };
}

export function fatOxidationPauseHours(ethanolGrams: number): number {
  if (ethanolGrams <= 0) return 0;
  return Math.round((ethanolGrams / 7) * 10) / 10;
}

// -- Slot Distribution -------------------------------------------------------

export function computeSlotTargets(
  targets: MacroTargets,
  slots: string[] = DEFAULT_SLOTS,
  distribution: Record<string, Record<string, number>> = SLOT_DISTRIBUTION,
): SlotBudget[] {
  return slots.map((slot) => {
    const d = distribution[slot] ?? { calories: 0.25, protein: 0.25, carbs: 0.25, fat: 0.25, fiber: 0.25 };
    return {
      slot,
      calories: Math.round(targets.calories * d.calories),
      protein: Math.round(targets.protein * d.protein),
      carbs: Math.round(targets.carbs * d.carbs),
      fat: Math.round(targets.fat * d.fat),
      fiber: Math.round((targets.fiber ?? 0) * d.fiber),
    };
  });
}

export function redistributeRemaining(
  targets: MacroTargets,
  eatenBySlot: Record<string, MacroTargets>,
  skippedSlots: string[] = [],
  slots: string[] = DEFAULT_SLOTS,
  distribution: Record<string, Record<string, number>> = SLOT_DISTRIBUTION,
): SlotBudget[] {
  const eaten: MacroTargets = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  for (const slotMacros of Object.values(eatenBySlot)) {
    eaten.calories += slotMacros.calories;
    eaten.protein += slotMacros.protein;
    eaten.carbs += slotMacros.carbs;
    eaten.fat += slotMacros.fat;
    eaten.fiber += slotMacros.fiber ?? 0;
  }

  const remaining: MacroTargets = {
    calories: Math.max(targets.calories - eaten.calories, 0),
    protein: Math.max(targets.protein - eaten.protein, 0),
    carbs: Math.max(targets.carbs - eaten.carbs, 0),
    fat: Math.max(targets.fat - eaten.fat, 0),
    fiber: Math.max((targets.fiber ?? 0) - eaten.fiber, 0),
  };

  const openSlots = slots.filter(
    (s) => !eatenBySlot[s] && !skippedSlots.includes(s),
  );

  if (openSlots.length === 0) {
    return slots.map((slot) => ({
      slot,
      ...(eatenBySlot[slot] ?? { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }),
    }));
  }

  // Per-macro total weights for open slots
  const macroKeys = ["calories", "protein", "carbs", "fat", "fiber"] as const;
  const totalPctByMacro: Record<string, number> = {};
  for (const m of macroKeys) {
    totalPctByMacro[m] = openSlots.reduce(
      (sum, s) => sum + (distribution[s]?.[m] ?? 0.25),
      0,
    );
  }

  return slots.map((slot) => {
    if (eatenBySlot[slot]) {
      return { slot, ...eatenBySlot[slot] };
    }
    if (skippedSlots.includes(slot)) {
      return { slot, calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
    }
    const d = distribution[slot] ?? { calories: 0.25, protein: 0.25, carbs: 0.25, fat: 0.25, fiber: 0.25 };
    return {
      slot,
      calories: Math.round(remaining.calories * (d.calories / (totalPctByMacro.calories || 1))),
      protein: Math.round(remaining.protein * (d.protein / (totalPctByMacro.protein || 1))),
      carbs: Math.round(remaining.carbs * (d.carbs / (totalPctByMacro.carbs || 1))),
      fat: Math.round(remaining.fat * (d.fat / (totalPctByMacro.fat || 1))),
      fiber: Math.round(remaining.fiber * (d.fiber / (totalPctByMacro.fiber || 1))),
    };
  });
}

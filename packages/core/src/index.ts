// Auto-generated barrel.

export { AdaptiveTdeeResult, DietBreakLevel, PlateauResult, PlateauType, computeAdaptiveTdee, computeRefeedPressureScore, detectPlateau, recommendDietBreak } from "./adaptive";
export { AlcoholDisplacement, DrinkEntry, ETHANOL_DENSITY, computeAlcoholDisplacement, computeDrinkEntry, fatOxidationPauseHours } from "./alcohol";
export { FoodCategory, SHRINK_PRIORITY, autoCategorizeFood } from "./auto-categorize";
export { ALL_METHODS, CreatineWaterOpts, DayPoint, ForbesResult, Method, NavyTapeInputs, OverlayResult, biaCreatineCorrection, creatineWaterAdjustment, effectiveSigmaKg, forbesEnergyDensityKcalPerKg, glycogenWaterOverlay, methodSigmaKg, navyTapeBfPct, navyTapeFfmKg, partitionWeightChange, personalKcalPerKg } from "./body-comp";
export { ClimateAdjustment, Environment, Sex as ClimateSex, climateAdjust } from "./climate";
export { KCAL_PER_STEP_PER_KG, computeActualTarget } from "./day-close";
export { DeficitFromGoal, KCAL_PER_KG_FAT, MAX_DEFICIT, Safety, computeDeficitFromGoal, pyRound } from "./deficit";
export { DRINK_DATABASE, Drink } from "./drink-db";
export { DEFAULT_PACE_BY_ZONE, EPOC_BY_ZONE, GYM_EPOC_FRACTION, GYM_KCAL_PER_MIN, HR_ZONE_MIDPOINTS, WorkoutStep, computeExerciseCalories, estimateStepCalories, estimateStepDurationMin, keytelKcalPerMin } from "./exercise-calories";
export { WaterTargets, computeSodiumTarget, computeWaterTarget, effectiveHydration, isHyponatremiaRisk } from "./hydration";
export { ALL_INJURY_TYPES, InjuryNutritionModule, InjuryPhase, InjuryType, classifyInjuryPhase, getInjuryModule, injuredEaHardFloor, injuryProteinGPerKg } from "./injured";
export { MACRO_COLORS, deficitColor, progressColor } from "./macro-colors";
export { CARB_TARGETS_G_PER_KG, DEFAULT_SLOTS, MacroTargetOptions, MacroTargets as MacroTargetsGPerKg, SLOT_DISTRIBUTION, SlotBudget as SlotBudgetProportional, TdeeComponents, applyAlcoholOffset, computeMacroTargets as computeMacroTargetsGPerKg, computeRunCalories, computeSlotTargets, computeStepCalories, computeTdee, fatOxidationPauseHours as fatOxidationPauseHoursSimple, redistributeRemaining } from "./macro-engine";
export { ALL_BANDS, Band, MacroContextResult, MacroTargets, MacroTargetsLegacyShape, carbGPerKg, carbTargetG, classifyBand, computeMacroTargets, computeMacroTargetsFromContext, computeTrainingLoad, fiberTargetG, proteinGPerKg } from "./macro-targets";
export { MILESTONES, Milestone, Stats, evaluateMilestones } from "./milestones";
export { MODE_COPY, ModeCopy, gateReasonCopy, transitionReasonCopy } from "./mode-copy";
export { ALL_MODES, GateReason, Mode, ModeAvailability, ModeConfig, TransitionReason, TransitionResult, checkModeAvailability, checkTransition, getModeConfig } from "./mode-engine";
export { PROTEIN_MPS_FLOOR_G, SlotBudget, SlotBudgets } from "./nutrition-types";
export { Ingredient, PerMealSolverTarget, PortionResult, computeItemMacros, cookedToRaw, countToGrams, gramsToCount, hasRawCookedToggle, isCountBased, rawToCooked, solvePortions, sumPortionMacros } from "./portion-solver";
export { ALLOWED_WINDOWS, DayRecord, ProgressionWindow, computeProgressionWindow } from "./progression";
export { RefeedIntensity, RefeedTargets, applyRefeedToCounter, computeRefeedTargets, isRefeedDay } from "./refeed";
export { BiomarkerCadence, CounterStatus, DEFICIT_RATIO_THRESHOLD, DayEntry, DurationThresholds, FAT_FLOOR_HARD, FAT_FLOOR_SOFT_DEFAULT, FAT_TARGET_MAINTENANCE, FatBreachType, FatFloorResult, FatMode, FloorBreachType, FloorMode, FloorResult, HYSTERESIS_PCT, PROTEIN_FLOOR_G_PER_KG, PerMealProteinLevel, ProteinFloorResult, ProteinFloorStatus, REDS_EA_COEFFICIENT, RateCap, RateCheckResult, RateStatus, Sex, Tier, TierPolicy, applyFatFloor, applyFloor, checkPerMealProtein, checkProteinFloor, checkRateCap, classifyCounter, computeBmr, computeCounter, computeFatFloor, computeFloor, computeProteinFloor, computeTier, computeTierRaw, computeWeeklyRatePct, cunningham, getRateCap, getThresholds, getTierPolicy, mifflinStJeor, rollingMedianBf, tenHaafWeight } from "./safety-rails";
export { classifySleepQuality } from "./sleep";
export { AlertLevel, HooperAlert, HooperQuality, HooperScore, WeeklyStrain, computeHooperAlert, computeHooperScore, computeWeeklyStrain, phq2Score, scoffScore, sessionStrain } from "./subjective";
export { TaperPhase, classifyTaperPhase, taperCarbGPerKg, taperProteinGPerKg } from "./taper";
export { DayRecord as WrapupDayRecord, Grade, WeeklyWrapup, adherenceGrade, computeWeeklyWrapup, wrapupTakeaway } from "./weekly-wrapup";
export { MonthSummary, YearDayRecord, YearReview, computeYearReview } from "./year-review";
export * from "./ingredient-research";

// Meal capture, weigh-ins and engagement, moved from soma (macro-engine#274).
export { WeighIn, Discarded, OUTLIER_KG, LOCAL_WINDOW_DAYS, localMedian, flagOutliers } from "./weigh-in";
export { PortionBand, MIN_OBSERVATIONS, GENERIC_BANDS, bandFor } from "./portion-bands";
export { Quantity, ResolvableItem, ResolvedItem, WeighMethod, BITE_FRACTION, BITE_DEFAULT_G, ResolveInput, ResolveResult, resolveQuantities } from "./meal-quantity";
export { CatalogEntry, fastParse } from "./meal-fast-path";
export { SlotStats, HistoryStats, MIN_MEALS, FALLBACK_SLOT_KCAL, FALLBACK_DAY_KCAL, MIN_SHARE_OF_SLOT, MIN_OVERSHOOT_KCAL, SLOT_SIGMA, DAY_SIGMA, amountsWereStated, slotCeiling, dayCeiling, PlausibilityInput, PlausibilityResult, enforcePlausibility } from "./meal-plausibility";
export { KCAL_PER_KG, DayIn, DaySource, DayOut, reconcile } from "./energy-reconcile";
export { isObservedDay } from "./observed-day";
export { ALL_SLOTS, Slot, COVERAGE_FLOOR, STREAK_MAX_GAP_DAYS, slotCoverage, meetsCoverageFloor, daysBetween } from "./coverage";
export { WindowDay, DeficitWindow, countsForDeficit, deficitWindow, windowLabel } from "./deficit-window";
export { AdherenceStatus, Adherence, ADHERENCE_TOLERANCE, computeWeeklyAdherence } from "./adherence";
export { TrendAteInput, trendAte } from "./trend-ate";
export { EngagementState, Engagement, WEEK_ENGAGEMENT_FLOOR_DAYS, WEEK_WINDOW_DAYS, NutritionDayInput, nutritionDayState, nutritionEngagement } from "./engagement";
export { DayRow as AdaptiveDayRow, contributes as contributesToAdaptiveTdee, countDeficitDuration, buildDayPoints } from "./adaptive-input";
export { DAY_SLOTS, DaySlot, DEFAULT_MEAL_KCAL, slotForHour, emptySlots, nextMealSlot, slotsRemaining, slotBudget, SLOT_KCAL_SHARES, slotBudgetByShare } from "./meal-slots";
export { MealProteinLevel, MealProteinThresholds, MPS_G_PER_KG, PLENTY_G_PER_KG, mealProteinThresholds, mealProteinLevel } from "./meal-protein";

// Auto-generated barrel.

export { AdaptiveTdeeResult, DietBreakLevel, PlateauResult, PlateauType, computeAdaptiveTdee, computeRefeedPressureScore, detectPlateau, recommendDietBreak } from "./adaptive";
export { AlcoholDisplacement, DrinkEntry, ETHANOL_DENSITY, computeAlcoholDisplacement, computeDrinkEntry, fatOxidationPauseHours } from "./alcohol";
export { FoodCategory, SHRINK_PRIORITY, autoCategorizeFood } from "./auto-categorize";
export { ALL_METHODS, CreatineWaterOpts, DayPoint, ForbesResult, Method, NavyTapeInputs, OverlayResult, biaCreatineCorrection, creatineWaterAdjustment, effectiveSigmaKg, forbesEnergyDensityKcalPerKg, glycogenWaterOverlay, methodSigmaKg, navyTapeBfPct, navyTapeFfmKg, partitionWeightChange, personalKcalPerKg } from "./body-comp";
export { ClimateAdjustment, Environment, Sex as ClimateSex, climateAdjust } from "./climate";
export { DeficitFromGoal, KCAL_PER_KG_FAT, MAX_DEFICIT, Safety, computeDeficitFromGoal, pyRound } from "./deficit";
export { DRINK_DATABASE, Drink } from "./drink-db";
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

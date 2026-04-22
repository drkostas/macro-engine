import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  computeStepCalories,
  computeTdee,
  applyAlcoholOffset,
  redistributeRemaining,
  type MacroTargets,
} from "@/lib/macro-engine";
import {
  classifyBand,
  computeMacroTargetsFromContext,
  computeTrainingLoad,
  type Band,
} from "@/lib/macro-targets";
import type { Mode } from "@/lib/mode-engine";
import { computeTierRaw, type Tier } from "@/lib/safety-rails";
import {
  computeAdaptiveTdee,
  computeRefeedPressureScore,
  detectPlateau,
  recommendDietBreak,
  type AdaptiveTdeeResult,
  type DietBreakLevel,
  type PlateauResult,
} from "@/lib/adaptive";
import type { DayPoint } from "@/lib/body-comp";
import { computeRefeedTargets, isRefeedDay } from "@/lib/refeed";
import { computeHooperAlert } from "@/lib/subjective";
import {
  computeSodiumTarget,
  computeWaterTarget,
  effectiveHydration,
  isHyponatremiaRisk,
} from "@/lib/hydration";

/**
 * GET /api/nutrition/plan?date=2026-04-13
 *
 * Compute daily macro targets, consumed amounts, remaining budgets,
 * and per-slot breakdowns.
 */
export async function GET(req: NextRequest) {
  const dateParam = req.nextUrl.searchParams.get("date");
  const date = dateParam || new Date().toISOString().split("T")[0];

  const sql = getDb();

  try {
    // Sequential DB reads (Neon free tier has limited concurrent connections)
    const profileRows = await sql`SELECT * FROM nutrition_profile LIMIT 1`;
    const dayRows = await sql`SELECT * FROM nutrition_day WHERE date = ${date} LIMIT 1`;
    const mealRows = await sql`SELECT * FROM meal_log WHERE date = ${date} AND (planned IS NULL OR planned = false) ORDER BY meal_slot, logged_at`;
    const plannedRows = await sql`SELECT * FROM meal_log WHERE date = ${date} AND planned = true ORDER BY meal_slot, logged_at`;
    const drinkRows = await sql`SELECT * FROM drink_log WHERE date = ${date}`;
    const healthRows = await sql`SELECT * FROM daily_health_summary WHERE date = ${date} LIMIT 1`;
    const weightRows = await sql`SELECT weight_grams FROM weight_log ORDER BY synced_at DESC LIMIT 1`;

    const profile = profileRows[0];
    if (!profile) {
      return NextResponse.json(
        { error: "No nutrition profile. Complete onboarding first.", needsOnboarding: true },
        { status: 404 },
      );
    }

    // Weight: prefer latest from scale (stored in grams), fall back to profile
    const weightKg = weightRows[0]?.weight_grams
      ? weightRows[0].weight_grams / 1000
      : profile.weight_kg ?? 80;

    // Health data from Garmin
    const health = healthRows[0];
    const day = dayRows[0];
    const deficit = profile.daily_deficit ?? 400;

    // TDEE: dynamically compute from activity selections
    // BMR: only trust Garmin values > 1500 (reject stale/partial-day nonsense)
    let bmr = 0;
    if (health?.bmr_kilocalories && Number(health.bmr_kilocalories) > 1500) {
      bmr = Number(health.bmr_kilocalories);
    } else {
      // Fallback: query most recent valid BMR from any day
      try {
        const bmrRows = await sql`
          SELECT bmr_kilocalories FROM daily_health_summary
          WHERE bmr_kilocalories > 1500
          ORDER BY date DESC LIMIT 1
        `;
        bmr = Number(bmrRows[0]?.bmr_kilocalories) || 0;
      } catch { /* ignore */ }
    }
    if (bmr === 0) {
      bmr = Math.round((Number(profile.tdee_estimate) || 2200) * 0.75);
    }

    // Steps: expected for planning, actual for closed/past, max(actual, expected) for today
    const today = new Date().toISOString().split("T")[0];
    const isPast = date < today;
    const isClosed = (day?.status ?? "active") === "closed";
    const expectedSteps = day?.expected_steps ?? profile.step_goal ?? 10000;
    const actualSteps = health?.total_steps ? Number(health.total_steps) : null;
    let steps: number;
    if (isClosed || isPast) {
      // Past/closed: use actual if available
      steps = actualSteps ?? expectedSteps;
    } else if (date === today && actualSteps != null) {
      // Today: use max of actual vs expected (Garmin updates throughout the day)
      steps = Math.max(actualSteps, expectedSteps);
    } else {
      steps = expectedSteps;
    }

    // Run: dedup steps (running ~1300 steps/km that are already in step count)
    // --- Auto-detect activities from Garmin/Hevy ---
    let runEnabled = day?.run_enabled ?? false;
    let runCals = 0;
    let runStepEstimate = 0;
    let selectedWorkouts: string[] = day?.selected_workouts ?? [];
    let autoDetectedRun = false;
    let autoDetectedGym: string[] = [];

    // Auto-detect runs from Garmin (only if user hasn't manually set run_enabled)
    if (!day?.run_enabled) {
      try {
        const garminRuns = await sql`
          SELECT ROUND(SUM((raw_json->>'calories')::numeric)) AS total_cal,
                 ROUND(SUM((raw_json->>'distance')::numeric)/1000, 1) AS total_km
          FROM garmin_activity_raw
          WHERE endpoint_name = 'activity_detail'
            AND (raw_json->>'startTimeLocal')::date = ${date}::date
            AND raw_json->>'activityType' IN ('running', 'trail_running', 'treadmill_running')
        `;
        if (garminRuns[0]?.total_cal && Number(garminRuns[0].total_cal) > 0) {
          runEnabled = true;
          runCals = Math.round(Number(garminRuns[0].total_cal));
          autoDetectedRun = true;
        }
      } catch { /* table may not exist */ }
    }

    if (runEnabled && !autoDetectedRun && day?.exercise_calories) {
      runCals = day.exercise_calories;
    }

    if (runEnabled && runCals > 0) {
      const runDistanceKm = day?.run_distance_km ?? (runCals / weightKg);
      runStepEstimate = Math.round(runDistanceKm * 1300);
    }

    const stepCals = computeStepCalories(steps, weightKg, runStepEstimate);

    // Auto-detect gym workouts from Hevy (only if user hasn't manually selected any)
    if (selectedWorkouts.length === 0) {
      try {
        const hevyToday = await sql`
          SELECT DISTINCT hevy_title
          FROM workout_enrichment
          WHERE workout_date = ${date}::date AND calories > 0
        `;
        if (hevyToday.length > 0) {
          autoDetectedGym = hevyToday.map((r: Record<string, unknown>) => String(r.hevy_title));
          selectedWorkouts = autoDetectedGym;
        }
      } catch { /* graceful */ }
    }

    // Gym calories: sum avg_calories for selected workouts
    let gymCals = 0;
    if (selectedWorkouts.length > 0) {
      try {
        const gymRows = await sql`
          WITH ranked AS (
            SELECT hevy_title, calories,
              ROW_NUMBER() OVER (PARTITION BY hevy_title ORDER BY workout_date DESC) as rn
            FROM workout_enrichment
            WHERE hevy_title = ANY(${selectedWorkouts}) AND calories > 0
          )
          SELECT hevy_title, ROUND(AVG(calories))::int AS avg_cal
          FROM ranked WHERE rn <= 5
          GROUP BY hevy_title
        `;
        gymCals = gymRows.reduce((s: number, r: Record<string, unknown>) => s + (Number(r.avg_cal) || 0), 0);
      } catch { /* graceful */ }
    }

    const deficitUsed = day?.deficit_used ?? deficit;
    const tdeeTotal = bmr + stepCals + runCals + gymCals;

    const tdee = {
      bmr,
      stepCalories: stepCals,
      runCalories: runCals,
      gymCalories: gymCals,
      deficit: deficitUsed,
      total: tdeeTotal,
      targetCalories: Math.round(tdeeTotal - deficitUsed),
    };

    // Keep training_day_type on the response payload for UI badges; engine
    // below now derives the real training "band" from run/gym kcal directly.
    const trainingDayType = day?.training_day_type ?? "rest";

    // Macro targets: prefer nutrition_day pre-computed, fall back to the
    // 5-band × tier × mode engine (M4 Phase A). Activities change TDEE in
    // real time so we always recompute unless the user manually overrode.
    const mode = (profile.deficit_mode ?? "standard") as Mode;
    const bfPct = profile.estimated_bf_pct != null ? Number(profile.estimated_bf_pct) : null;

    // Derive tier + band up-front so we can surface them in the response even
    // when the user has manually overridden macros (they still want to see
    // their current context).
    const contextTier: Tier = bfPct != null ? computeTierRaw(bfPct) : "T2";
    const contextBand: Band = classifyBand(
      computeTrainingLoad(runCals, gymCals, { weightKg }),
    );

    const engineResult = (day?.manual_override && day?.target_calories)
      ? null
      : computeMacroTargetsFromContext({
          weightKg,
          bfPct,
          mode,
          runKcal: runCals,
          gymKcal: gymCals,
          kcalTarget: tdee.targetCalories,
          inDeficit: deficitUsed > 0,
        });

    const targets: MacroTargets = engineResult ?? {
      calories: Math.round(day!.target_calories),
      protein: Math.round(day!.target_protein ?? weightKg * 2.2),
      carbs: Math.round(day!.target_carbs ?? 0),
      fat: Math.round(day!.target_fat ?? weightKg * 0.8),
      fiber: Math.round(day!.target_fiber ?? tdee.targetCalories * 14 / 1000),
    };

    // Alcohol offset
    let drinkCalories = 0;
    for (const d of drinkRows) {
      drinkCalories += d.calories ?? 0;
    }
    const adjustedTargets = applyAlcoholOffset(targets, drinkCalories);

    // Consumed by slot -- meal_log has items as JSONB and top-level calories
    const eatenBySlot: Record<string, MacroTargets> = {};
    const mealsBySlot: Record<string, Array<Record<string, unknown>>> = {};

    for (const m of mealRows) {
      const slot = m.meal_slot;
      if (!eatenBySlot[slot]) {
        eatenBySlot[slot] = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
        mealsBySlot[slot] = [];
      }
      eatenBySlot[slot].calories += m.calories ?? 0;
      eatenBySlot[slot].protein += m.protein ?? 0;
      eatenBySlot[slot].carbs += m.carbs ?? 0;
      eatenBySlot[slot].fat += m.fat ?? 0;
      eatenBySlot[slot].fiber += m.fiber ?? 0;

      // Flatten items from JSONB for the UI
      const items = m.items ?? [];
      // Items use ingredient_id (e.g. "oats_dry", "milk_2pct") -- humanize for display
      const humanize = (id: string) =>
        id.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
      const mealEntry: Record<string, unknown> = {
        id: m.id,
        meal_slot: m.meal_slot,
        calories: m.calories,
        protein: m.protein,
        carbs: m.carbs,
        fat: m.fat,
        food_name: Array.isArray(items) && items.length > 0
          ? items.map((i: Record<string, unknown>) =>
              (i.name || humanize(String(i.ingredient_id || i.ingredient || ""))) +
              (i.grams ? ` ${i.grams}g` : "")
            ).filter(Boolean).join(", ")
          : m.source ?? "Meal",
        items,
        logged_at: m.logged_at,
      };
      mealsBySlot[slot].push(mealEntry);
    }

    // Planned meals (don't count toward eaten, but show as ghost in UI)
    const plannedBySlot: Record<string, Array<Record<string, unknown>>> = {};
    const humanizePlan = (id: string) =>
      id.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
    for (const m of plannedRows) {
      const slot = m.meal_slot;
      if (!plannedBySlot[slot]) plannedBySlot[slot] = [];
      const items = m.items ?? [];
      plannedBySlot[slot].push({
        id: m.id,
        meal_slot: m.meal_slot,
        calories: m.calories,
        protein: m.protein,
        carbs: m.carbs,
        fat: m.fat,
        fiber: m.fiber,
        planned: true,
        food_name: Array.isArray(items) && items.length > 0
          ? items.map((i: Record<string, unknown>) =>
              (i.name || humanizePlan(String(i.ingredient_id || i.ingredient || ""))) +
              (i.grams ? ` ${i.grams}g` : "")
            ).filter(Boolean).join(", ")
          : m.source ?? "Planned meal",
        items,
        logged_at: m.logged_at,
      });
    }

    // Remaining + slot budgets
    const totalEaten: MacroTargets = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
    for (const s of Object.values(eatenBySlot)) {
      totalEaten.calories += s.calories;
      totalEaten.protein += s.protein;
      totalEaten.carbs += s.carbs;
      totalEaten.fat += s.fat;
      totalEaten.fiber += s.fiber ?? 0;
    }

    const remaining: MacroTargets = {
      calories: Math.max(adjustedTargets.calories - totalEaten.calories, 0),
      protein: Math.max(adjustedTargets.protein - totalEaten.protein, 0),
      carbs: Math.max(adjustedTargets.carbs - totalEaten.carbs, 0),
      fat: Math.max(adjustedTargets.fat - totalEaten.fat, 0),
      fiber: Math.max((adjustedTargets.fiber ?? 0) - (totalEaten.fiber ?? 0), 0),
    };

    const skippedSlots: string[] = day?.skipped_slots ?? [];
    const slotBudgets = redistributeRemaining(
      adjustedTargets,
      eatenBySlot,
      skippedSlots,
    );

    // 7-day trend (with training day type for context)
    const trendRows = await sql`
      SELECT date, target_calories, actual_calories, tdee_used, deficit_used, status, training_day_type
      FROM nutrition_day
      WHERE date >= ${date}::date - interval '6 days' AND date <= ${date}::date
      ORDER BY date ASC
    `;

    // Drink details for the logger
    const drinkDetails = drinkRows.map((d: Record<string, unknown>) => ({
      id: d.id, name: d.name, quantity_ml: d.quantity_ml,
      calories: d.calories, alcohol_grams: d.alcohol_grams,
      fat_oxidation_pause_hours: d.fat_oxidation_pause_hours,
    }));

    // Day status + activity fields
    const dayStatus = day?.status ?? "active";
    const responseExpectedSteps = day?.expected_steps ?? null;

    // ---- M5 Phase B: adaptive signals from last 14 days ----
    // Pull a compact history (date, intake kcal, tdee, weight_kg) for the
    // adaptive engine. Missing intake/tdee rows default to 0 so single-day
    // gaps don't crash; adaptive engine gates on min_days internally.
    const historyRows = (await sql`
      SELECT
        nd.date,
        COALESCE(nd.actual_calories, 0) AS intake_kcal,
        COALESCE(nd.tdee_used, 0) AS tdee_kcal,
        wl.weight_grams
      FROM nutrition_day nd
      LEFT JOIN LATERAL (
        SELECT weight_grams FROM weight_log
        WHERE date <= nd.date
        ORDER BY date DESC LIMIT 1
      ) wl ON true
      WHERE nd.date >= ${date}::date - interval '14 days'
        AND nd.date <= ${date}::date
      ORDER BY nd.date ASC
    `) as Array<{
      date: string | Date;
      intake_kcal: number | string;
      tdee_kcal: number | string;
      weight_grams: number | null;
    }>;

    const history: DayPoint[] = historyRows
      .filter((r) => r.weight_grams != null)
      .map((r, i) => ({
        day: i,
        intakeKcal: Number(r.intake_kcal) || 0,
        tdeeKcal: Number(r.tdee_kcal) || 0,
        weightKg: (r.weight_grams as number) / 1000,
      }));

    const adaptiveTdee: AdaptiveTdeeResult | null = computeAdaptiveTdee(history);

    // Deficit duration (from the M1.7 counter, stored on nutrition_profile
    // via deficit_phase_start_date). Days since phase start, else 0.
    const phaseStart = profile.deficit_phase_start_date;
    const deficitDays = phaseStart
      ? Math.max(0, Math.floor(
          (new Date(date).getTime() - new Date(String(phaseStart)).getTime()) / 86400000,
        ))
      : 0;

    const dietBreakLevel: DietBreakLevel = recommendDietBreak(deficitDays);

    // Weight-stall = consecutive days where weight didn't drop ≥ 0.1 kg.
    let weightStallDays = 0;
    for (let i = history.length - 1; i > 0; i--) {
      const drop = history[i - 1].weightKg - history[i].weightKg;
      if (drop >= 0.1) break;
      weightStallDays++;
    }

    // Weight-loss velocity (%/wk) from the last 7 days of history
    let velocityPctPerWk = 0;
    if (history.length >= 7 && weightKg > 0) {
      const recent = history.slice(-7);
      const dropKg = recent[0].weightKg - recent[recent.length - 1].weightKg;
      velocityPctPerWk = (dropKg / weightKg) * 100;
    }

    // HRV + readiness — default to neutral when not available
    const healthForAdaptive = healthRows[0] ?? {};
    const hrvTrendPct: number = Number(healthForAdaptive.hrv_7d_trend_pct ?? 0);
    const readinessAvg: number = Number(healthForAdaptive.readiness_score ?? 80);

    const refeedPressureScore = computeRefeedPressureScore({
      deficitDays,
      weightStallDays,
      hrv7dTrendPct: hrvTrendPct,
      readinessAvg,
      bfTier: contextTier,
      weightLossVelocityPctPerWk: velocityPctPerWk,
    });

    let plateau: PlateauResult | null = history.length >= 21
      ? detectPlateau(history, {
          tdeeStable: adaptiveTdee != null && !adaptiveTdee.driftFlag,
        })
      : null;

    // ---- M7.7: Hooper alert overrides plateau type → adaptation ----
    // Subjective wellness is the primary plateau classifier per V2 §4.4.
    // An elevated/high Hooper Z-alert upgrades an existing plateau to
    // ADAPTATION so the refeed banner nudges the user.
    if (plateau?.isPlateau) {
      const hooperRows = (await sql`
        SELECT morning_hooper FROM subjective_log
        WHERE date >= CURRENT_DATE - interval '28 days'
          AND morning_hooper IS NOT NULL
        ORDER BY date DESC
      `) as Array<{ morning_hooper: { fatigue: number; sleep: number; stress: number; soreness: number } | null }>;
      if (hooperRows.length > 0) {
        const totals = hooperRows
          .map((r) => r.morning_hooper)
          .filter((h): h is NonNullable<typeof h> => h != null)
          .map((h) => h.fatigue + h.sleep + h.stress + h.soreness);
        const today = totals[0];
        const historyTotals = totals.slice(1);
        if (today != null) {
          const alert = computeHooperAlert(today, historyTotals);
          if (alert.alertLevel !== "normal") {
            plateau = { ...plateau, type: "adaptation" };
          }
        }
      }
    }

    // ---- M6 Phase B: refeed detection + target macros ----
    const refeedDetected = tdee.total > 0 && weightKg > 0
      ? isRefeedDay({
          kcal: totalEaten.calories,
          tdee: tdee.total,
          carbsG: totalEaten.carbs,
          fatG: totalEaten.fat,
          weightKg,
        })
      : false;

    const refeedSuggested = weightKg > 0 && tdee.total > 0
      ? computeRefeedTargets({
          weightKg, tdee: tdee.total, intensity: "maintenance",
        })
      : null;

    // ---- M8 Phase B: hydration context ----
    interface HydrationLogRow {
      logs: Array<{ volume_ml: number; ethanol_g?: number; caffeine_mg?: number }>;
      sodium_mg: number;
    }
    const hydrationRows = (await sql`
      SELECT logs, sodium_mg FROM hydration_log WHERE date = ${date}::date
    `) as HydrationLogRow[];
    const hydrationLogs = hydrationRows[0]?.logs ?? [];
    const sodiumCurrent = hydrationRows[0]?.sodium_mg ?? 0;
    const waterEffective = hydrationLogs.reduce(
      (sum, d) => sum + effectiveHydration(d.volume_ml, {
        ethanolG: d.ethanol_g ?? 0, caffeineMg: d.caffeine_mg ?? 0,
      }),
      0,
    );
    const waterTarget = weightKg > 0 ? computeWaterTarget(weightKg) : null;
    const sodiumTarget = computeSodiumTarget({ sweatL: 0 });
    // Rough hourly rate for the hyponatremia check: assume the water was
    // consumed across the last N hours (we estimate from timestamp span
    // when available). Fall back to false without enough data.
    const hyponatremiaRiskFlag = hydrationLogs.length >= 3
      ? isHyponatremiaRisk({
          waterMlPerHour: waterEffective / 3, // conservative: assume 3-hour window
          hours: 3,
          sodiumMgPerHour: sodiumCurrent / 3,
        })
      : false;

    return NextResponse.json({
      date,
      weightKg,
      tdee,
      targets: adjustedTargets,
      context: {
        band: contextBand,
        tier: contextTier,
        mode,
        adaptive: {
          tdee: adaptiveTdee,
          refeedPressureScore,
          dietBreakLevel,
          plateau,
        },
        refeed: {
          detected: refeedDetected,
          suggestedTargets: refeedSuggested,
        },
        hydration: {
          water: {
            targetMl: waterTarget?.beverageMl ?? 0,
            effectiveMl: waterEffective,
          },
          sodium: {
            targetMg: sodiumTarget,
            currentMg: sodiumCurrent,
          },
          hyponatremiaRisk: hyponatremiaRiskFlag,
        },
      },
      eaten: totalEaten,
      remaining,
      slotBudgets,
      mealsBySlot,
      plannedBySlot,
      drinkCalories,
      drinks: drinkDetails,
      trainingDayType,
      skippedSlots,
      dayStatus,
      runEnabled,
      selectedWorkouts,
      expectedSteps: responseExpectedSteps,
      autoDetected: {
        run: autoDetectedRun,
        gym: autoDetectedGym,
      },
      trend: trendRows.map((r: Record<string, unknown>) => ({
        date: r.date,
        target_calories: r.target_calories,
        actual_calories: r.actual_calories,
        tdee_used: r.tdee_used,
        deficit_used: r.deficit_used,
        status: r.status,
        training_day_type: r.training_day_type ?? "rest",
      })),
      pctComplete: adjustedTargets.calories > 0
        ? Math.round((totalEaten.calories / adjustedTargets.calories) * 100)
        : 0,
    }, {
      headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=60" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Plan computation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

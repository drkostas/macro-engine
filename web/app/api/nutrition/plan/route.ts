import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  computeStepCalories,
  computeTdee,
  computeMacroTargets,
  applyAlcoholOffset,
  redistributeRemaining,
  type MacroTargets,
} from "@/lib/macro-engine";

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

    // Macro targets: prefer nutrition_day pre-computed, fall back to engine
    const trainingDayType = day?.training_day_type ?? "rest";

    // Always compute targets dynamically (activities change TDEE in real-time)
    const targets = (day?.manual_override && day?.target_calories)
      ? {
          calories: Math.round(day.target_calories),
          protein: Math.round(day.target_protein ?? weightKg * 2.2),
          carbs: Math.round(day.target_carbs ?? 0),
          fat: Math.round(day.target_fat ?? weightKg * 0.8),
          fiber: Math.round(day.target_fiber ?? tdee.targetCalories * 14 / 1000),
        }
      : computeMacroTargets({
          targetCalories: tdee.targetCalories,
          weightKg,
          proteinGPerKg: profile.protein_g_per_kg ?? 2.2,
          fatGPerKg: profile.fat_g_per_kg ?? 0.8,
          trainingDayType,
          carbPeriodization: true,
        });

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

    return NextResponse.json({
      date,
      weightKg,
      tdee,
      targets: adjustedTargets,
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

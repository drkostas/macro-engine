import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  computeStepCalories,
  computeRunCalories,
  computeTdee,
  computeMacroTargets,
  applyAlcoholOffset,
  redistributeRemaining,
  type MacroTargets,
} from "@/lib/macro-engine";

export const runtime = "edge";

/**
 * GET /api/nutrition/plan?date=2026-04-13
 *
 * Compute daily macro targets, consumed amounts, remaining budgets,
 * and per-slot breakdowns. The core engine route.
 */
export async function GET(req: NextRequest) {
  const dateParam = req.nextUrl.searchParams.get("date");
  const date = dateParam || new Date().toISOString().split("T")[0];

  const sql = getDb();

  try {
    // Parallel DB reads
    const [profileRows, dayRows, mealRows, drinkRows, healthRows, weightRows] =
      await Promise.all([
        sql`SELECT * FROM nutrition_profile LIMIT 1`,
        sql`SELECT * FROM nutrition_day WHERE day = ${date} LIMIT 1`,
        sql`SELECT * FROM meal_log WHERE day = ${date} ORDER BY meal_slot, logged_at`,
        sql`SELECT * FROM drink_log WHERE day = ${date}`,
        sql`SELECT * FROM daily_health_summary WHERE day = ${date} LIMIT 1`,
        sql`SELECT weight_kg FROM weight_log ORDER BY measured_at DESC LIMIT 1`,
      ]);

    const profile = profileRows[0];
    if (!profile) {
      return NextResponse.json(
        { error: "No nutrition profile. Complete onboarding first.", needsOnboarding: true },
        { status: 404 },
      );
    }

    // Weight: prefer latest from scale, fall back to profile
    const weightKg = weightRows[0]?.weight_kg ?? profile.weight_kg ?? 80;

    // Health data from Garmin
    const health = healthRows[0];
    const actualSteps = health?.total_steps ?? profile.expected_steps ?? 8000;

    // TDEE computation using lib/macro-engine.ts
    const bmr = health?.bmr_calories ?? (profile.tdee_estimate ?? 2200) * 0.75;
    const stepCals = computeStepCalories(actualSteps, weightKg, 0);
    const runCals = computeRunCalories(
      profile.run_distance_km ?? 0,
      weightKg,
    );
    const gymCals = profile.gym_calories ?? 0;
    const deficit = profile.deficit ?? 400;

    const tdee = computeTdee(bmr, stepCals, runCals, gymCals, deficit);

    // Macro targets
    const day = dayRows[0];
    const trainingDayType = day?.training_day_type ?? "rest";
    const carbPeriodization = profile.carb_periodization ?? false;

    const targets = computeMacroTargets({
      targetCalories: tdee.targetCalories,
      weightKg,
      trainingDayType,
      carbPeriodization,
    });

    // Alcohol offset
    let drinkCalories = 0;
    for (const d of drinkRows) {
      drinkCalories += d.calories ?? 0;
    }
    const adjustedTargets = applyAlcoholOffset(targets, drinkCalories);

    // Consumed by slot
    const eatenBySlot: Record<string, MacroTargets> = {};
    const mealsBySlot: Record<string, Array<Record<string, unknown>>> = {};

    for (const m of mealRows) {
      const slot = m.meal_slot;
      if (!eatenBySlot[slot]) {
        eatenBySlot[slot] = { calories: 0, protein: 0, carbs: 0, fat: 0 };
        mealsBySlot[slot] = [];
      }
      eatenBySlot[slot].calories += m.calories ?? 0;
      eatenBySlot[slot].protein += m.protein ?? 0;
      eatenBySlot[slot].carbs += m.carbs ?? 0;
      eatenBySlot[slot].fat += m.fat ?? 0;
      mealsBySlot[slot].push(m);
    }

    // Remaining + slot budgets
    const totalEaten: MacroTargets = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    for (const s of Object.values(eatenBySlot)) {
      totalEaten.calories += s.calories;
      totalEaten.protein += s.protein;
      totalEaten.carbs += s.carbs;
      totalEaten.fat += s.fat;
    }

    const remaining: MacroTargets = {
      calories: Math.max(adjustedTargets.calories - totalEaten.calories, 0),
      protein: Math.max(adjustedTargets.protein - totalEaten.protein, 0),
      carbs: Math.max(adjustedTargets.carbs - totalEaten.carbs, 0),
      fat: Math.max(adjustedTargets.fat - totalEaten.fat, 0),
    };

    const skippedSlots: string[] = day?.skipped_slots ?? [];
    const slotBudgets = redistributeRemaining(
      adjustedTargets,
      eatenBySlot,
      skippedSlots,
    );

    return NextResponse.json({
      date,
      weightKg,
      tdee,
      targets: adjustedTargets,
      eaten: totalEaten,
      remaining,
      slotBudgets,
      mealsBySlot,
      drinkCalories,
      trainingDayType,
      skippedSlots,
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

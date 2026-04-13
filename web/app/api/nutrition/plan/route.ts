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
    const mealRows = await sql`SELECT * FROM meal_log WHERE date = ${date} ORDER BY meal_slot, logged_at`;
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
    const actualSteps = health?.total_steps ?? profile.step_goal ?? 8000;

    const day = dayRows[0];
    const deficit = profile.daily_deficit ?? 400;

    // TDEE: use pre-computed values from nutrition_day if available (soma pipeline)
    const bmr = health?.bmr_kilocalories ?? (profile.tdee_estimate ?? 2200) * 0.75;
    const stepCals = day?.step_calories ?? computeStepCalories(actualSteps, weightKg, 0);
    const runCals = day?.exercise_calories ?? 0;
    const gymCals = 0;
    const tdeeUsed = day?.tdee_used ?? (bmr + stepCals + runCals + gymCals);
    const deficitUsed = day?.deficit_used ?? deficit;

    const tdee = {
      bmr,
      stepCalories: stepCals,
      runCalories: runCals,
      gymCalories: gymCals,
      deficit: deficitUsed,
      total: tdeeUsed,
      targetCalories: Math.round(tdeeUsed - deficitUsed),
    };

    // Macro targets: prefer nutrition_day pre-computed, fall back to engine
    const trainingDayType = day?.training_day_type ?? "rest";

    const targets = day?.target_calories
      ? {
          calories: Math.round(day.target_calories),
          protein: Math.round(day.target_protein ?? weightKg * 2.2),
          carbs: Math.round(day.target_carbs ?? 0),
          fat: Math.round(day.target_fat ?? weightKg * 0.8),
        }
      : computeMacroTargets({
          targetCalories: tdee.targetCalories,
          weightKg,
          proteinGPerKg: profile.protein_g_per_kg ?? 2.2,
          fatGPerKg: profile.fat_g_per_kg ?? 0.8,
          trainingDayType,
          carbPeriodization: false,
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
        eatenBySlot[slot] = { calories: 0, protein: 0, carbs: 0, fat: 0 };
        mealsBySlot[slot] = [];
      }
      eatenBySlot[slot].calories += m.calories ?? 0;
      eatenBySlot[slot].protein += m.protein ?? 0;
      eatenBySlot[slot].carbs += m.carbs ?? 0;
      eatenBySlot[slot].fat += m.fat ?? 0;

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

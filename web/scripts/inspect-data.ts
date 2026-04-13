import { neon } from "@neondatabase/serverless";
import { join } from "path";
import { config } from "dotenv";

config({ path: join(__dirname, "../.env.local") });

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  console.log("=== SOMA DATA INSPECTION ===\n");

  // 1. Nutrition Profile
  console.log("── NUTRITION PROFILE ──");
  const [profile] = await sql`SELECT * FROM nutrition_profile LIMIT 1`;
  if (profile) {
    console.log(`  Weight: ${profile.weight_kg}kg | Height: ${profile.height_cm}cm | Age: ${profile.age} | Sex: ${profile.sex}`);
    console.log(`  TDEE estimate: ${profile.tdee_estimate} | Deficit: ${profile.daily_deficit} | Goal: ${profile.goal}`);
    console.log(`  Protein: ${profile.protein_g_per_kg}g/kg | Fat: ${profile.fat_g_per_kg}g/kg`);
    console.log(`  Target: ${profile.target_calories} kcal | ${profile.target_protein}g P | ${profile.target_carbs}g C | ${profile.target_fat}g F`);
    console.log(`  BF%: ${profile.estimated_bf_pct} | FFM: ${profile.estimated_ffm_kg}kg | Target BF%: ${profile.target_bf_pct}`);
    console.log(`  Step goal: ${profile.step_goal} | VO2max: ${profile.vo2max}`);
  }

  // 2. Ingredients
  console.log("\n── INGREDIENTS ──");
  const ingredients = await sql`SELECT id, name, category FROM ingredients ORDER BY category, name`;
  console.log(`  ${ingredients.length} ingredients:`);
  let lastCat = "";
  for (const ing of ingredients) {
    if (ing.category !== lastCat) { lastCat = ing.category; console.log(`  [${ing.category}]`); }
    console.log(`    - ${ing.name}`);
  }

  // 3. Preset Meals
  console.log("\n── PRESET MEALS ──");
  const presets = await sql`SELECT id, name, items FROM preset_meals ORDER BY name`;
  console.log(`  ${presets.length} presets:`);
  for (const p of presets) {
    const items = Array.isArray(p.items) ? p.items : [];
    const names = items.map((i: Record<string, unknown>) => i.name || i.ingredient).join(", ");
    console.log(`    - ${p.name}: ${names}`);
  }

  // 4. Recent Meal Logs (last 14 days)
  console.log("\n── RECENT MEAL LOGS (14 days) ──");
  const meals = await sql`
    SELECT date, meal_slot, calories, protein, carbs, fat, source, items
    FROM meal_log
    WHERE date >= CURRENT_DATE - INTERVAL '14 days'
    ORDER BY date DESC, meal_slot
  `;
  console.log(`  ${meals.length} meal entries:`);
  let lastDate = "";
  for (const m of meals) {
    const d = String(m.date).split("T")[0];
    if (d !== lastDate) { lastDate = d; console.log(`  [${d}]`); }
    const items = Array.isArray(m.items) ? m.items : [];
    const names = items.map((i: Record<string, unknown>) => i.name || i.ingredient || "").filter(Boolean).join(", ");
    console.log(`    ${m.meal_slot}: ${Math.round(m.calories)} kcal | ${Math.round(m.protein)}g P | ${names || m.source || "?"}`);
  }

  // 5. Drink Logs (last 14 days)
  console.log("\n── RECENT DRINK LOGS (14 days) ──");
  const drinks = await sql`
    SELECT date, name, drink_type, quantity_ml, calories, alcohol_grams
    FROM drink_log
    WHERE date >= CURRENT_DATE - INTERVAL '14 days'
    ORDER BY date DESC
  `;
  console.log(`  ${drinks.length} drink entries:`);
  for (const d of drinks) {
    console.log(`    ${String(d.date).split("T")[0]}: ${d.name || d.drink_type} ${d.quantity_ml}ml (${d.calories} kcal, ${d.alcohol_grams}g alcohol)`);
  }

  // 6. Nutrition Days (last 14 days)
  console.log("\n── NUTRITION DAYS (14 days) ──");
  const days = await sql`
    SELECT date, status, training_day_type, target_calories, target_protein,
           actual_calories, actual_protein, tdee_used, deficit_used, step_calories,
           exercise_calories, is_refeed, skipped_slots
    FROM nutrition_day
    WHERE date >= CURRENT_DATE - INTERVAL '14 days'
    ORDER BY date DESC
  `;
  console.log(`  ${days.length} days:`);
  for (const d of days) {
    const dt = String(d.date).split("T")[0];
    console.log(`    ${dt} [${d.status}] ${d.training_day_type}: target ${d.target_calories} kcal (${d.target_protein}g P) | actual ${d.actual_calories ?? "?"} kcal | TDEE ${d.tdee_used} - deficit ${d.deficit_used} | steps +${Math.round(d.step_calories || 0)} | exercise +${Math.round(d.exercise_calories || 0)}${d.is_refeed ? " REFEED" : ""}${d.skipped_slots?.length ? ` skipped: ${d.skipped_slots}` : ""}`);
  }

  // 7. Weight Log (last 30 days)
  console.log("\n── WEIGHT LOG (30 days) ──");
  const weights = await sql`
    SELECT date, weight_grams, body_fat_pct, muscle_mass_grams
    FROM weight_log
    WHERE date >= CURRENT_DATE - INTERVAL '30 days'
    ORDER BY date DESC
  `;
  console.log(`  ${weights.length} weigh-ins:`);
  for (const w of weights) {
    const kg = (w.weight_grams / 1000).toFixed(1);
    console.log(`    ${String(w.date).split("T")[0]}: ${kg}kg${w.body_fat_pct ? ` | BF ${w.body_fat_pct}%` : ""}${w.muscle_mass_grams ? ` | Muscle ${(w.muscle_mass_grams/1000).toFixed(1)}kg` : ""}`);
  }

  // 8. TDEE History (last 14 days)
  console.log("\n── TDEE HISTORY (14 days) ──");
  const tdee = await sql`
    SELECT date, tdee_estimate, weight_kg, step_count, run_calories, gym_calories
    FROM tdee_history
    WHERE date >= CURRENT_DATE - INTERVAL '14 days'
    ORDER BY date DESC
  `;
  console.log(`  ${tdee.length} entries:`);
  for (const t of tdee) {
    console.log(`    ${String(t.date).split("T")[0]}: TDEE ${t.tdee_estimate} | ${t.weight_kg}kg | ${t.step_count} steps | run +${t.run_calories} | gym +${t.gym_calories}`);
  }

  // 9. Training Plan (last 14 days)
  console.log("\n── TRAINING PLAN (14 days) ──");
  const plan = await sql`
    SELECT date, day_type, run_distance_km, run_intensity, workout_steps
    FROM training_plan_day
    WHERE date >= CURRENT_DATE - INTERVAL '14 days'
    ORDER BY date DESC
  `;
  console.log(`  ${plan.length} plan days:`);
  for (const p of plan) {
    console.log(`    ${String(p.date).split("T")[0]}: ${p.day_type}${p.run_distance_km ? ` | run ${p.run_distance_km}km ${p.run_intensity}` : ""}${p.workout_steps ? ` | steps: ${JSON.stringify(p.workout_steps).substring(0, 80)}...` : ""}`);
  }

  // 10. Daily Health Summary (last 7 days)
  console.log("\n── GARMIN HEALTH (7 days) ──");
  const health = await sql`
    SELECT date, total_steps, bmr_kilocalories, active_kilocalories, total_kilocalories,
           resting_heart_rate, body_battery_max, sleep_time_seconds, training_readiness_score
    FROM daily_health_summary
    WHERE date >= CURRENT_DATE - INTERVAL '7 days'
    ORDER BY date DESC
  `;
  console.log(`  ${health.length} days:`);
  for (const h of health) {
    const sleep = h.sleep_time_seconds ? `${(h.sleep_time_seconds/3600).toFixed(1)}h` : "?";
    console.log(`    ${String(h.date).split("T")[0]}: ${h.total_steps} steps | BMR ${h.bmr_kilocalories} | Active ${h.active_kilocalories} | Total ${h.total_kilocalories} | RHR ${h.resting_heart_rate} | BB ${h.body_battery_max} | Sleep ${sleep} | Readiness ${h.training_readiness_score}`);
  }

  console.log("\n=== DONE ===");
}

main().catch((e) => console.error("Error:", e.message));

import { getTestDb } from "./setup";

/** Wipe transactional test data between test runs. */
export async function resetTestDb() {
  const sql = getTestDb();
  await sql`TRUNCATE meal_log, drink_log, nutrition_day, weight_log, analytics_weight_trend RESTART IDENTITY CASCADE`;
}

interface ProfileOverrides {
  weight_kg?: number;
  height_cm?: number;
  age?: number;
  sex?: string;
  daily_deficit?: number;
  protein_g_per_kg?: number;
  fat_g_per_kg?: number;
  target_bf_pct?: number;
  estimated_bf_pct?: number;
  step_goal?: number;
  tdee_estimate?: number;
}

export async function seedProfile(overrides: ProfileOverrides = {}) {
  const sql = getTestDb();
  const p = {
    weight_kg: 80,
    height_cm: 178,
    age: 32,
    sex: "male",
    daily_deficit: 500,
    protein_g_per_kg: 2.2,
    fat_g_per_kg: 0.8,
    target_bf_pct: 15,
    estimated_bf_pct: 20,
    step_goal: 10000,
    tdee_estimate: 2600,
    ...overrides,
  };
  await sql`
    INSERT INTO nutrition_profile (
      id, weight_kg, height_cm, age, sex, daily_deficit,
      protein_g_per_kg, fat_g_per_kg, target_bf_pct, estimated_bf_pct,
      step_goal, tdee_estimate
    ) VALUES (
      1, ${p.weight_kg}, ${p.height_cm}, ${p.age}, ${p.sex}, ${p.daily_deficit},
      ${p.protein_g_per_kg}, ${p.fat_g_per_kg}, ${p.target_bf_pct}, ${p.estimated_bf_pct},
      ${p.step_goal}, ${p.tdee_estimate}
    )
    ON CONFLICT (id) DO UPDATE SET
      weight_kg = EXCLUDED.weight_kg,
      daily_deficit = EXCLUDED.daily_deficit,
      target_bf_pct = EXCLUDED.target_bf_pct,
      estimated_bf_pct = EXCLUDED.estimated_bf_pct
  `;
}

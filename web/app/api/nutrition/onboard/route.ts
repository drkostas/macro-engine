import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  const sql = getDb();
  const body = await req.json();

  const {
    weight_kg, height_cm, age, sex, goal,
    tdee_estimate, daily_deficit, estimated_bf_pct,
    target_bf_pct, estimated_ffm_kg,
    protein_g_per_kg = 2.2, fat_g_per_kg = 0.8,
    step_goal = 10000,
  } = body;

  if (!weight_kg || !height_cm || !age || !sex) {
    return NextResponse.json({ error: "Required: weight_kg, height_cm, age, sex" }, { status: 400 });
  }

  try {
    await sql`
      INSERT INTO nutrition_profile (
        id, weight_kg, height_cm, age, sex, goal,
        tdee_estimate, daily_deficit, estimated_bf_pct,
        target_bf_pct, estimated_ffm_kg,
        protein_g_per_kg, fat_g_per_kg, step_goal, updated_at
      ) VALUES (
        1, ${weight_kg}, ${height_cm}, ${age}, ${sex}, ${goal},
        ${tdee_estimate}, ${daily_deficit}, ${estimated_bf_pct},
        ${target_bf_pct}, ${estimated_ffm_kg},
        ${protein_g_per_kg}, ${fat_g_per_kg}, ${step_goal}, NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        weight_kg = EXCLUDED.weight_kg,
        height_cm = EXCLUDED.height_cm,
        age = EXCLUDED.age,
        sex = EXCLUDED.sex,
        goal = EXCLUDED.goal,
        tdee_estimate = EXCLUDED.tdee_estimate,
        daily_deficit = EXCLUDED.daily_deficit,
        estimated_bf_pct = EXCLUDED.estimated_bf_pct,
        target_bf_pct = EXCLUDED.target_bf_pct,
        estimated_ffm_kg = EXCLUDED.estimated_ffm_kg,
        protein_g_per_kg = EXCLUDED.protein_g_per_kg,
        fat_g_per_kg = EXCLUDED.fat_g_per_kg,
        step_goal = EXCLUDED.step_goal,
        updated_at = NOW()
    `;

    return NextResponse.json({ saved: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to save profile";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

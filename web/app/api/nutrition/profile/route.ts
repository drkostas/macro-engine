import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * GET/PATCH /api/nutrition/profile
 * Read and update the user's nutrition profile (targets, goals, integrations).
 */
export async function GET() {
  const sql = getDb();
  try {
    const rows = await sql`SELECT * FROM nutrition_profile WHERE id = 1`;
    const p = rows[0];
    if (!p) return NextResponse.json({ error: "No profile" }, { status: 404 });

    const targetDate = p.target_date instanceof Date
      ? p.target_date.toISOString().split("T")[0]
      : p.target_date ? String(p.target_date).split("T")[0] : null;

    return NextResponse.json({
      profile: {
        weight_kg: Number(p.weight_kg),
        height_cm: Number(p.height_cm) || null,
        age: Number(p.age) || null,
        sex: p.sex,
        activity_level: p.activity_level,
        goal: p.goal,
        daily_deficit: Number(p.daily_deficit) || 0,
        protein_g_per_kg: Number(p.protein_g_per_kg) || 2.2,
        fat_g_per_kg: Number(p.fat_g_per_kg) || 0.8,
        estimated_bf_pct: Number(p.estimated_bf_pct) || null,
        target_bf_pct: Number(p.target_bf_pct) || null,
        target_date: targetDate,
        step_goal: Number(p.step_goal) || 10000,
        tdee_estimate: Number(p.tdee_estimate) || null,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const sql = getDb();
  const body = await req.json();

  const fields: Record<string, unknown> = {};
  const allowed = [
    "weight_kg", "height_cm", "age", "sex", "activity_level", "goal",
    "daily_deficit", "protein_g_per_kg", "fat_g_per_kg",
    "estimated_bf_pct", "target_bf_pct", "target_date", "step_goal", "tdee_estimate",
  ];
  for (const key of allowed) {
    if (body[key] !== undefined) fields[key] = body[key];
  }

  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: "No updatable fields" }, { status: 400 });
  }

  try {
    // Build dynamic UPDATE via individual tagged template calls
    // Neon driver doesn't support dynamic column names in a single template,
    // so we use a series of updates for each changed field.
    for (const [key, value] of Object.entries(fields)) {
      if (key === "weight_kg") await sql`UPDATE nutrition_profile SET weight_kg = ${Number(value)}, updated_at = NOW() WHERE id = 1`;
      else if (key === "height_cm") await sql`UPDATE nutrition_profile SET height_cm = ${Number(value)}, updated_at = NOW() WHERE id = 1`;
      else if (key === "age") await sql`UPDATE nutrition_profile SET age = ${Number(value)}, updated_at = NOW() WHERE id = 1`;
      else if (key === "sex") await sql`UPDATE nutrition_profile SET sex = ${String(value)}, updated_at = NOW() WHERE id = 1`;
      else if (key === "activity_level") await sql`UPDATE nutrition_profile SET activity_level = ${String(value)}, updated_at = NOW() WHERE id = 1`;
      else if (key === "goal") await sql`UPDATE nutrition_profile SET goal = ${String(value)}, updated_at = NOW() WHERE id = 1`;
      else if (key === "daily_deficit") await sql`UPDATE nutrition_profile SET daily_deficit = ${Number(value)}, updated_at = NOW() WHERE id = 1`;
      else if (key === "protein_g_per_kg") await sql`UPDATE nutrition_profile SET protein_g_per_kg = ${Number(value)}, updated_at = NOW() WHERE id = 1`;
      else if (key === "fat_g_per_kg") await sql`UPDATE nutrition_profile SET fat_g_per_kg = ${Number(value)}, updated_at = NOW() WHERE id = 1`;
      else if (key === "estimated_bf_pct") await sql`UPDATE nutrition_profile SET estimated_bf_pct = ${Number(value)}, updated_at = NOW() WHERE id = 1`;
      else if (key === "target_bf_pct") await sql`UPDATE nutrition_profile SET target_bf_pct = ${Number(value)}, updated_at = NOW() WHERE id = 1`;
      else if (key === "target_date") await sql`UPDATE nutrition_profile SET target_date = ${String(value)}::date, updated_at = NOW() WHERE id = 1`;
      else if (key === "step_goal") await sql`UPDATE nutrition_profile SET step_goal = ${Number(value)}, updated_at = NOW() WHERE id = 1`;
      else if (key === "tdee_estimate") await sql`UPDATE nutrition_profile SET tdee_estimate = ${Number(value)}, updated_at = NOW() WHERE id = 1`;
    }

    return NextResponse.json({ ok: true, updated: Object.keys(fields) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

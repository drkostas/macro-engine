import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * POST /api/nutrition/weigh-in
 * Body: { weight_kg: number, date?: string (YYYY-MM-DD) }
 *
 * Records a weigh-in in weight_log, recomputes the 7-day moving average,
 * upserts analytics_weight_trend for that date, and updates the profile weight.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { weight_kg, date } = body as { weight_kg: number; date?: string };

  if (typeof weight_kg !== "number" || weight_kg < 20 || weight_kg > 400) {
    return NextResponse.json({ error: "Invalid weight (must be 20-400 kg)" }, { status: 400 });
  }

  const target = date ?? new Date().toISOString().split("T")[0];
  const weight_grams = Math.round(weight_kg * 1000);

  const sql = getDb();

  try {
    // Replace any prior manual weigh-in for this date, then insert new value.
    // Unique constraint is on (date, weight_grams) so a plain upsert on date alone
    // would fail.
    await sql`DELETE FROM weight_log WHERE date = ${target} AND source_type = 'manual'`;
    await sql`
      INSERT INTO weight_log (date, weight_grams, source_type, synced_at)
      VALUES (${target}, ${weight_grams}, 'manual', NOW())
      ON CONFLICT (date, weight_grams) DO UPDATE SET
        source_type = EXCLUDED.source_type,
        synced_at = NOW()
    `;

    // Compute 7-day moving avg ending on target date
    const rows = await sql`
      WITH daily AS (
        SELECT date, AVG(weight_grams) / 1000.0 AS kg
        FROM weight_log
        WHERE date >= ${target}::date - 6 AND date <= ${target}::date
        GROUP BY date
      )
      SELECT AVG(kg) AS avg_7d FROM daily
    `;
    const avg7 = Number(rows[0]?.avg_7d) || weight_kg;

    // Upsert analytics row (surface in chart)
    await sql`
      INSERT INTO analytics_weight_trend (date, weight_kg, avg_7d)
      VALUES (${target}, ${weight_kg}, ${avg7})
      ON CONFLICT (date) DO UPDATE SET
        weight_kg = EXCLUDED.weight_kg,
        avg_7d = EXCLUDED.avg_7d
    `;

    // Update profile current weight so dashboards show the latest
    await sql`
      UPDATE nutrition_profile SET weight_kg = ${weight_kg}, updated_at = NOW() WHERE id = 1
    `;

    return NextResponse.json({ ok: true, weight_kg, avg_7d: avg7 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}

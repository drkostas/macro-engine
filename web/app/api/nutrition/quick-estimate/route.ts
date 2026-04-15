import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * POST /api/nutrition/quick-estimate
 *
 * For past days with no meals logged, let the user set an estimated
 * total calorie intake. Writes to nutrition_day as actual_calories
 * with source="estimate" so it shows in the trend.
 */
export async function POST(req: NextRequest) {
  const sql = getDb();
  const { date, estimated_calories } = (await req.json()) as {
    date: string;
    estimated_calories: number;
  };

  if (!date || estimated_calories == null) {
    return NextResponse.json({ error: "date and estimated_calories required" }, { status: 400 });
  }

  const cals = Math.round(Math.max(0, Math.min(estimated_calories, 10000)));

  // Rough macro split from calories: 30% protein, 40% carbs, 30% fat
  const protein = Math.round((cals * 0.30) / 4);
  const carbs = Math.round((cals * 0.40) / 4);
  const fat = Math.round((cals * 0.30) / 9);

  try {
    // Upsert nutrition_day with estimated values
    await sql`
      INSERT INTO nutrition_day (date, status, actual_calories, actual_protein, actual_carbs, actual_fat,
        plan, training_day_type)
      VALUES (${date}, 'closed', ${cals}, ${protein}, ${carbs}, ${fat},
        ${sql.json({ source: "estimate", estimated_at: new Date().toISOString() })},
        'rest')
      ON CONFLICT (date) DO UPDATE SET
        actual_calories = ${cals}, actual_protein = ${protein},
        actual_carbs = ${carbs}, actual_fat = ${fat},
        status = 'closed',
        plan = nutrition_day.plan || ${sql.json({ source: "estimate", estimated_at: new Date().toISOString() })}
    `;

    return NextResponse.json({ status: "ok", calories: cals, protein, carbs, fat });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}

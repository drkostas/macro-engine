import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  const sql = getDb();
  const body = (await req.json()) as {
    date: string;
    run_enabled?: boolean;
    selected_workouts?: string[];
    expected_steps?: number | null;
    manual_override?: boolean;
  };

  if (!body.date) {
    return NextResponse.json({ error: "date is required" }, { status: 400 });
  }

  await sql`INSERT INTO nutrition_day (date) VALUES (${body.date}) ON CONFLICT (date) DO NOTHING`;

  if (body.manual_override !== undefined) {
    await sql`UPDATE nutrition_day SET manual_override = ${body.manual_override} WHERE date = ${body.date}`;
    if (body.manual_override === false) {
      const profRows = await sql`SELECT daily_deficit FROM nutrition_profile WHERE id = 1`;
      const defaultDeficit = profRows[0]?.daily_deficit != null ? Number(profRows[0].daily_deficit) : 800;
      await sql`UPDATE nutrition_day SET target_calories = NULL, deficit_used = ${defaultDeficit} WHERE date = ${body.date}`;
    }
  }

  if (body.run_enabled !== undefined && body.selected_workouts !== undefined) {
    await sql`
      UPDATE nutrition_day
      SET run_enabled = ${body.run_enabled},
          selected_workouts = ${body.selected_workouts},
          expected_steps = ${body.expected_steps ?? null}
      WHERE date = ${body.date}
    `;
  }

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * GET /api/nutrition/weekly-summary?weeks=4
 *
 * Returns per-week rollup: avg calories, avg deficit, adherence %, weight change,
 * days hit target, training days completed.
 */
export async function GET(req: NextRequest) {
  const weeks = Math.min(Number(req.nextUrl.searchParams.get("weeks")) || 4, 12);
  const sql = getDb();

  try {
    const dayRows = await sql`
      SELECT
        DATE_TRUNC('week', date)::date AS week_start,
        COUNT(*) FILTER (WHERE status = 'closed') AS days_closed,
        AVG(actual_calories) FILTER (WHERE status = 'closed' AND actual_calories > 0) AS avg_calories,
        AVG(target_calories) FILTER (WHERE target_calories > 0) AS avg_target,
        AVG(tdee_used - actual_calories) FILTER (WHERE status = 'closed' AND actual_calories > 0 AND tdee_used > 0) AS avg_actual_deficit,
        AVG(deficit_used) FILTER (WHERE deficit_used > 0) AS avg_goal_deficit,
        COUNT(*) FILTER (WHERE status = 'closed' AND actual_calories > 0 AND (tdee_used - actual_calories) >= deficit_used) AS days_hit_deficit,
        COUNT(*) FILTER (WHERE training_day_type IS NOT NULL AND training_day_type != 'rest') AS training_days
      FROM nutrition_day
      WHERE date >= CURRENT_DATE - ${weeks * 7}::int
      GROUP BY DATE_TRUNC('week', date)
      ORDER BY week_start DESC
    `;

    // Weight change per week
    const weightRows = await sql`
      SELECT
        DATE_TRUNC('week', date)::date AS week_start,
        AVG(weight_kg) AS avg_weight,
        COUNT(*) AS weigh_ins
      FROM analytics_weight_trend
      WHERE date >= CURRENT_DATE - ${weeks * 7}::int
      GROUP BY DATE_TRUNC('week', date)
      ORDER BY week_start DESC
    `;

    const weightByWeek: Record<string, { avg: number; count: number }> = {};
    for (const w of weightRows) {
      const key = w.week_start instanceof Date
        ? w.week_start.toISOString().split("T")[0]
        : String(w.week_start).split("T")[0];
      weightByWeek[key] = { avg: Number(w.avg_weight), count: Number(w.weigh_ins) };
    }

    const weeksData = dayRows.map((r: Record<string, unknown>) => {
      const weekStart = r.week_start instanceof Date
        ? r.week_start.toISOString().split("T")[0]
        : String(r.week_start).split("T")[0];
      const daysClosed = Number(r.days_closed) || 0;
      const daysHit = Number(r.days_hit_deficit) || 0;
      return {
        week: weekStart,
        daysClosed,
        daysHit,
        adherencePct: daysClosed > 0 ? Math.round((daysHit / daysClosed) * 100) : 0,
        avgCalories: Math.round(Number(r.avg_calories) || 0),
        avgTarget: Math.round(Number(r.avg_target) || 0),
        avgActualDeficit: Math.round(Number(r.avg_actual_deficit) || 0),
        avgGoalDeficit: Math.round(Number(r.avg_goal_deficit) || 0),
        trainingDays: Number(r.training_days) || 0,
        avgWeight: weightByWeek[weekStart]?.avg ?? null,
        weighIns: weightByWeek[weekStart]?.count ?? 0,
      };
    });

    // Weight change across weeks (most recent - oldest)
    let weightChange: number | null = null;
    if (weeksData.length >= 2) {
      const latest = weeksData.find((w) => w.avgWeight != null);
      const earliest = [...weeksData].reverse().find((w) => w.avgWeight != null);
      if (latest?.avgWeight && earliest?.avgWeight) {
        weightChange = Math.round((latest.avgWeight - earliest.avgWeight) * 10) / 10;
      }
    }

    return NextResponse.json({ weeks: weeksData, weightChange });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}

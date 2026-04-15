import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { MILESTONES, type Stats } from "@/lib/milestones";
import { computeStreak, type ClosedDay } from "@/app/api/nutrition/streak/route";

/**
 * GET /api/nutrition/milestones
 *
 * Computes live stats, evaluates MILESTONES, persists newly-achieved ones in
 * user_milestones, and returns:
 *   { all: Array<{ id, label, achieved, achieved_at }>, newlyAchieved: string[] }
 */
export async function GET() {
  const sql = getDb();

  const closedDays = (await sql`
    SELECT date, tdee_used, actual_calories, deficit_used
    FROM nutrition_day
    WHERE status = 'closed'
      AND tdee_used IS NOT NULL
      AND actual_calories IS NOT NULL
      AND deficit_used IS NOT NULL
    ORDER BY date DESC
  `) as ClosedDay[];
  const { streak } = computeStreak(closedDays);

  const mealRows = (await sql`SELECT COUNT(*)::int AS c FROM meal_log`) as Array<{ c: number }>;
  const dayRows = (await sql`SELECT COUNT(*)::int AS c FROM nutrition_day WHERE status = 'closed'`) as Array<{ c: number }>;
  const weightRows = (await sql`
    SELECT MIN(weight_grams)::int AS lowest, MAX(weight_grams)::int AS highest
    FROM weight_log
  `) as Array<{ lowest: number | null; highest: number | null }>;

  const highest = weightRows[0]?.highest ?? 0;
  const lowest = weightRows[0]?.lowest ?? 0;
  const kgLost = highest > 0 && lowest > 0 ? (highest - lowest) / 1000 : 0;

  const stats: Stats = {
    streak,
    totalMealsLogged: mealRows[0]?.c ?? 0,
    daysClosed: dayRows[0]?.c ?? 0,
    kgLost,
  };

  const achieved = MILESTONES.filter((m) => m.test(stats));
  const existing = (await sql`
    SELECT milestone_id, achieved_at FROM user_milestones
  `) as Array<{ milestone_id: string; achieved_at: string | Date }>;
  const existingIds = new Set(existing.map((r) => r.milestone_id));

  const newlyAchieved: string[] = [];
  for (const m of achieved) {
    if (!existingIds.has(m.id)) {
      await sql`
        INSERT INTO user_milestones (milestone_id)
        VALUES (${m.id})
        ON CONFLICT (milestone_id) DO NOTHING
      `;
      newlyAchieved.push(m.id);
    }
  }

  const byId = new Map(existing.map((r) => [r.milestone_id, r.achieved_at]));
  const all = MILESTONES.map((m) => ({
    id: m.id,
    label: m.label,
    achieved: achieved.some((a) => a.id === m.id),
    achieved_at: byId.get(m.id) ?? (newlyAchieved.includes(m.id) ? new Date().toISOString() : null),
  }));

  return NextResponse.json({ all, newlyAchieved, stats });
}

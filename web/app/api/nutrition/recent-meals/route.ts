import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * GET /api/nutrition/recent-meals?slot=lunch&days=14
 *
 * Returns recent unique meals for a given slot, ranked by frequency + recency.
 * Used for "quick re-log" suggestions.
 */
export async function GET(req: NextRequest) {
  const slot = req.nextUrl.searchParams.get("slot") || null;
  const days = Math.min(Number(req.nextUrl.searchParams.get("days")) || 14, 60);
  const sql = getDb();

  try {
    // Get recent meals grouped by items (same ingredient combo = same meal)
    const rows = slot
      ? await sql`
          SELECT items, meal_slot, calories, protein, carbs, fat, fiber,
                 COUNT(*)::int AS freq, MAX(logged_at) AS last_logged
          FROM meal_log
          WHERE date >= CURRENT_DATE - ${days}::int
            AND meal_slot = ${slot}
            AND items IS NOT NULL AND jsonb_array_length(items) > 0
          GROUP BY items, meal_slot, calories, protein, carbs, fat, fiber
          ORDER BY freq DESC, last_logged DESC
          LIMIT 5
        `
      : await sql`
          SELECT items, meal_slot, calories, protein, carbs, fat, fiber,
                 COUNT(*)::int AS freq, MAX(logged_at) AS last_logged
          FROM meal_log
          WHERE date >= CURRENT_DATE - ${days}::int
            AND items IS NOT NULL AND jsonb_array_length(items) > 0
          GROUP BY items, meal_slot, calories, protein, carbs, fat, fiber
          ORDER BY freq DESC, last_logged DESC
          LIMIT 10
        `;

    const meals = rows.map((r: Record<string, unknown>) => ({
      items: r.items,
      slot: r.meal_slot,
      calories: Number(r.calories),
      protein: Number(r.protein),
      carbs: Number(r.carbs),
      fat: Number(r.fat),
      fiber: Number(r.fiber) || 0,
      freq: Number(r.freq),
      lastLogged: r.last_logged,
    }));

    return NextResponse.json({ meals });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed", meals: [] },
      { status: 500 },
    );
  }
}

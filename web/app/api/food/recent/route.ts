import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * GET /api/food/recent?days=30&limit=15
 *
 * Returns recently used ingredient IDs ranked by frequency,
 * extracted from meal_log items JSONB.
 */
export async function GET(req: NextRequest) {
  const days = Math.min(Number(req.nextUrl.searchParams.get("days")) || 30, 90);
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit")) || 15, 30);
  const sql = getDb();

  try {
    const rows = await sql`
      SELECT item->>'ingredient_id' AS ingredient_id,
             COUNT(*)::int AS freq,
             MAX(logged_at) AS last_used
      FROM meal_log, jsonb_array_elements(items) AS item
      WHERE date >= CURRENT_DATE - ${days}::int
        AND item->>'ingredient_id' IS NOT NULL
      GROUP BY item->>'ingredient_id'
      ORDER BY freq DESC, last_used DESC
      LIMIT ${limit}
    `;

    return NextResponse.json({
      recentIds: rows.map((r: Record<string, unknown>) => String(r.ingredient_id)),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed", recentIds: [] },
      { status: 500 },
    );
  }
}

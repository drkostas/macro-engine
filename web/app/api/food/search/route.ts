import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

/**
 * GET /api/food/search?q=chicken+breast&limit=20&source=all
 *
 * Search foods across USDA database and user custom foods.
 * Uses PostgreSQL full-text search (tsvector) + fuzzy matching (pg_trgm).
 *
 * Query params:
 *   q      - search query (required, min 2 chars)
 *   limit  - max results (default 20, max 50)
 *   source - "all" | "usda" | "custom" | "favorites" (default "all")
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const limit = Math.min(
    parseInt(req.nextUrl.searchParams.get("limit") || "20"),
    50,
  );
  const source = req.nextUrl.searchParams.get("source") || "all";

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [], query: q || "" });
  }

  const sql = getDb();

  try {
    const results: Array<Record<string, unknown>> = [];

    // Search user custom foods first (if source allows)
    if (source === "all" || source === "custom" || source === "favorites") {
      const pattern = `%${q}%`;
      const custom = source === "favorites"
        ? await sql`
            SELECT id, name, brand, calories, protein, carbs, fat, fiber,
              serving_size_g, serving_description, barcode, source,
              use_count, is_favorite, 'custom' as db_source
            FROM user_foods
            WHERE (name ILIKE ${pattern} OR brand ILIKE ${pattern}) AND is_favorite = TRUE
            ORDER BY use_count DESC LIMIT ${limit}`
        : await sql`
            SELECT id, name, brand, calories, protein, carbs, fat, fiber,
              serving_size_g, serving_description, barcode, source,
              use_count, is_favorite, 'custom' as db_source
            FROM user_foods
            WHERE name ILIKE ${pattern} OR brand ILIKE ${pattern}
            ORDER BY use_count DESC LIMIT ${limit}`;

      results.push(...custom.map((r: Record<string, unknown>) => ({
        ...r,
        db_source: "custom",
      })));
    }

    // Search USDA foods (if source allows)
    if (source === "all" || source === "usda") {
      const remaining = limit - results.length;
      if (remaining > 0) {
        const pattern = `%${q}%`;
        const usda = await sql`
          SELECT
            fdc_id as id, description as name, brand_owner as brand,
            calories, protein, carbs, fat, fiber,
            serving_size_g, serving_description,
            data_type, 'usda' as db_source
          FROM usda_foods
          WHERE
            search_vector @@ plainto_tsquery('english', ${q})
            OR description ILIKE ${pattern}
          ORDER BY
            CASE data_type
              WHEN 'foundation' THEN 0
              WHEN 'sr_legacy' THEN 1
              WHEN 'branded_food' THEN 2
              ELSE 3
            END,
            ts_rank_cd(search_vector, plainto_tsquery('english', ${q})) DESC,
            length(description) ASC
          LIMIT ${remaining}
        `;

        results.push(...usda.map((r: Record<string, unknown>) => ({
          ...r,
          db_source: "usda",
        })));
      }
    }

    return NextResponse.json(
      { results, query: q, count: results.length },
      {
        headers: {
          "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400",
        },
      },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Search failed";
    return NextResponse.json({ error: msg, results: [] }, { status: 500 });
  }
}

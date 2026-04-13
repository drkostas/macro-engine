import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "edge";

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
      const customFilter =
        source === "favorites"
          ? "AND is_favorite = TRUE"
          : "";

      const custom = await sql(`
        SELECT
          id, name, brand, calories, protein, carbs, fat, fiber,
          serving_size_g, serving_description, barcode, source,
          use_count, is_favorite, 'custom' as db_source,
          similarity(name, $1) as rank
        FROM user_foods
        WHERE (name ILIKE $2 OR brand ILIKE $2) ${customFilter}
        ORDER BY use_count DESC, rank DESC
        LIMIT $3
      `, [q, `%${q}%`, limit]);

      results.push(...custom.map((r: Record<string, unknown>) => ({
        ...r,
        db_source: "custom",
      })));
    }

    // Search USDA foods (if source allows)
    if (source === "all" || source === "usda") {
      const remaining = limit - results.length;
      if (remaining > 0) {
        // Hybrid search: full-text (tsvector) for relevance + trigram for fuzzy
        const usda = await sql(`
          SELECT
            fdc_id as id, description as name, brand_owner as brand,
            calories, protein, carbs, fat, fiber,
            serving_size_g, serving_description,
            data_type, 'usda' as db_source,
            ts_rank(search_vector, plainto_tsquery('english', $1)) as ts_rank,
            similarity(description, $1) as trgm_rank
          FROM usda_foods
          WHERE
            search_vector @@ plainto_tsquery('english', $1)
            OR description % $1
          ORDER BY
            -- Prefer Foundation/SR Legacy over Branded
            CASE data_type
              WHEN 'foundation' THEN 0
              WHEN 'sr_legacy' THEN 1
              WHEN 'branded_food' THEN 2
              ELSE 3
            END,
            -- Then by combined relevance score
            (ts_rank * 2 + trgm_rank) DESC
          LIMIT $2
        `, [q, remaining]);

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

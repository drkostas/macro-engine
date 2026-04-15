import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * GET /api/nutrition/export
 *
 * Exports all meal/drink/day data as CSV.
 * Useful for sharing with a nutritionist or backing up data.
 */
export async function GET() {
  const sql = getDb();
  try {
    const meals = await sql`
      SELECT date, meal_slot, source, calories, protein, carbs, fat, fiber,
             notes, weigh_method, logged_at, items
      FROM meal_log ORDER BY date DESC, logged_at DESC
    `;

    const rows: string[] = [
      "date,meal_slot,source,calories,protein,carbs,fat,fiber,notes,weigh_method,logged_at,ingredients",
    ];

    for (const m of meals) {
      const items = Array.isArray(m.items) ? m.items as Array<Record<string, unknown>> : [];
      const ingredients = items.map((i) =>
        `${i.name || i.ingredient_id || "?"}(${i.grams || "?"}g)`
      ).join("; ");

      const esc = (v: unknown) => {
        if (v == null) return "";
        const s = String(v).replace(/"/g, '""');
        return s.includes(",") || s.includes("\n") || s.includes('"') ? `"${s}"` : s;
      };

      rows.push([
        m.date instanceof Date ? m.date.toISOString().split("T")[0] : String(m.date).split("T")[0],
        esc(m.meal_slot),
        esc(m.source),
        m.calories ?? 0,
        m.protein ?? 0,
        m.carbs ?? 0,
        m.fat ?? 0,
        m.fiber ?? 0,
        esc(m.notes),
        esc(m.weigh_method),
        m.logged_at instanceof Date ? m.logged_at.toISOString() : String(m.logged_at),
        esc(ingredients),
      ].join(","));
    }

    const csv = rows.join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="macroengine-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to export" },
      { status: 500 },
    );
  }
}

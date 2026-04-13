import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * POST /api/nutrition/log-meal
 * Body: { date, meal_slot, items: [{ name, grams, calories, protein, carbs, fat, fiber? }] }
 *
 * Writes to soma's meal_log schema: date, meal_slot, source, items (JSONB),
 * calories, protein, carbs, fat, fiber, portion_multiplier, logged_at.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { date, meal_slot, items } = body;

  if (!date || !meal_slot || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { error: "Required: date, meal_slot, items[]" },
      { status: 400 },
    );
  }

  const jsonbItems = items.map((item: Record<string, unknown>) => ({
    ingredient_id: String(item.name ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "_"),
    name: item.name,
    grams: item.grams ?? null,
    calories: item.calories ?? 0,
    protein: item.protein ?? 0,
    carbs: item.carbs ?? 0,
    fat: item.fat ?? 0,
    fiber: item.fiber ?? 0,
  }));

  const totalCal = jsonbItems.reduce((s, i) => s + Number(i.calories ?? 0), 0);
  const totalP = jsonbItems.reduce((s, i) => s + Number(i.protein ?? 0), 0);
  const totalC = jsonbItems.reduce((s, i) => s + Number(i.carbs ?? 0), 0);
  const totalF = jsonbItems.reduce((s, i) => s + Number(i.fat ?? 0), 0);
  const totalFiber = jsonbItems.reduce((s, i) => s + Number(i.fiber ?? 0), 0);

  const sql = getDb();

  try {
    const [row] = await sql`
      INSERT INTO meal_log (date, meal_slot, source, items, calories, protein, carbs, fat, fiber, portion_multiplier, logged_at)
      VALUES (
        ${date}, ${meal_slot}, 'macro_engine',
        ${JSON.stringify(jsonbItems)}::jsonb,
        ${totalCal}, ${totalP}, ${totalC}, ${totalF}, ${totalFiber},
        1.0, NOW()
      )
      RETURNING *
    `;
    return NextResponse.json({ logged: row, count: 1 }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to log meal";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const sql = getDb();
  try {
    await sql`DELETE FROM meal_log WHERE id = ${parseInt(id)}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to delete";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

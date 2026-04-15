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
  const { date, meal_slot, items, notes, weigh_method, preset_meal_id, source, planned } = body;

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
    // Ensure the nutrition_day row exists (needed due to FK on meal_log.date)
    await sql`
      INSERT INTO nutrition_day (date, status, training_day_type)
      VALUES (${date}, 'active', 'rest')
      ON CONFLICT (date) DO NOTHING
    `;
    const [row] = await sql`
      INSERT INTO meal_log (date, meal_slot, source, preset_meal_id, items, calories, protein, carbs, fat, fiber, portion_multiplier, notes, weigh_method, planned, logged_at)
      VALUES (
        ${date}, ${meal_slot}, ${source ?? 'macro_engine'}, ${preset_meal_id ?? null},
        ${sql.json(jsonbItems)},
        ${totalCal}, ${totalP}, ${totalC}, ${totalF}, ${totalFiber},
        1.0, ${notes ?? null}, ${weigh_method ?? null}, ${Boolean(planned)}, NOW()
      )
      RETURNING *
    `;
    // Bump preset use_count if this was logged from a preset
    if (preset_meal_id) {
      try {
        await sql`UPDATE preset_meals SET use_count = COALESCE(use_count, 0) + 1 WHERE id = ${preset_meal_id}`;
      } catch { /* graceful */ }
    }
    return NextResponse.json({ logged: row, count: 1 }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to log meal";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, items, notes, weigh_method, planned } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const sql = getDb();
  try {
    if (typeof planned === "boolean") {
      // Convert planned → actual (or back), updating logged_at when promoting
      if (planned === false) {
        await sql`UPDATE meal_log SET planned = false, logged_at = NOW() WHERE id = ${Number(id)}`;
      } else {
        await sql`UPDATE meal_log SET planned = true WHERE id = ${Number(id)}`;
      }
      return NextResponse.json({ ok: true, planned });
    }
    if (Array.isArray(items)) {
      const totalCal = items.reduce((s, i) => s + Number(i.calories ?? 0), 0);
      const totalP = items.reduce((s, i) => s + Number(i.protein ?? 0), 0);
      const totalC = items.reduce((s, i) => s + Number(i.carbs ?? 0), 0);
      const totalF = items.reduce((s, i) => s + Number(i.fat ?? 0), 0);
      const totalFiber = items.reduce((s, i) => s + Number(i.fiber ?? 0), 0);
      await sql`
        UPDATE meal_log SET
          items = ${sql.json(items)},
          calories = ${totalCal}, protein = ${totalP}, carbs = ${totalC},
          fat = ${totalF}, fiber = ${totalFiber},
          notes = COALESCE(${notes ?? null}, notes),
          weigh_method = COALESCE(${weigh_method ?? null}, weigh_method)
        WHERE id = ${Number(id)}
      `;
    } else {
      // Metadata-only update
      await sql`
        UPDATE meal_log SET
          notes = COALESCE(${notes ?? null}, notes),
          weigh_method = COALESCE(${weigh_method ?? null}, weigh_method)
        WHERE id = ${Number(id)}
      `;
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
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

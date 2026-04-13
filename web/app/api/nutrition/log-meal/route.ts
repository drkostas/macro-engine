import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// Node.js runtime (Neon works better without Edge in dev)

/**
 * POST /api/nutrition/log-meal
 * Body: { date, meal_slot, items: [{ name, grams, calories, protein, carbs, fat, fiber? }] }
 *
 * DELETE /api/nutrition/log-meal?id=123
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

  const sql = getDb();
  const logged: Array<Record<string, unknown>> = [];

  for (const item of items) {
    const [row] = await sql`
      INSERT INTO meal_log (day, meal_slot, food_name, grams, calories, protein, carbs, fat, fiber, logged_at)
      VALUES (
        ${date}, ${meal_slot}, ${item.name},
        ${item.grams ?? null}, ${item.calories ?? 0}, ${item.protein ?? 0},
        ${item.carbs ?? 0}, ${item.fat ?? 0}, ${item.fiber ?? 0}, NOW()
      )
      RETURNING *
    `;
    logged.push(row);
  }

  return NextResponse.json({ logged, count: logged.length }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const sql = getDb();
  await sql`DELETE FROM meal_log WHERE id = ${parseInt(id)}`;
  return NextResponse.json({ ok: true });
}

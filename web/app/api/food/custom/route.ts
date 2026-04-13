import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "edge";

/** GET /api/food/custom - list user's custom foods */
export async function GET(req: NextRequest) {
  const favOnly = req.nextUrl.searchParams.get("favorites") === "true";
  const sql = getDb();

  const filter = favOnly ? "WHERE is_favorite = TRUE" : "";
  const rows = await sql(`
    SELECT * FROM user_foods ${filter} ORDER BY use_count DESC, created_at DESC LIMIT 200
  `);

  return NextResponse.json({ foods: rows });
}

/** POST /api/food/custom - create a custom food */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, brand, calories, protein, carbs, fat, fiber, serving_size_g, serving_description, barcode } = body;

  if (!name || calories == null || protein == null || carbs == null || fat == null) {
    return NextResponse.json(
      { error: "Required: name, calories, protein, carbs, fat" },
      { status: 400 },
    );
  }

  const sql = getDb();
  const [row] = await sql`
    INSERT INTO user_foods (name, brand, calories, protein, carbs, fat, fiber, serving_size_g, serving_description, barcode)
    VALUES (${name}, ${brand || null}, ${calories}, ${protein}, ${carbs}, ${fat}, ${fiber || 0}, ${serving_size_g || 100}, ${serving_description || null}, ${barcode || null})
    RETURNING *
  `;

  return NextResponse.json({ food: row }, { status: 201 });
}

/** DELETE /api/food/custom?id=123 - delete a custom food */
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const sql = getDb();
  await sql`DELETE FROM user_foods WHERE id = ${parseInt(id)}`;
  return NextResponse.json({ ok: true });
}

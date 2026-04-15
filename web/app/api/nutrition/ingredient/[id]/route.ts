import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * PATCH /api/nutrition/ingredient/:id
 * Body: { is_favorite?: boolean }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const body = await req.json();
  const { is_favorite } = body;
  if (typeof is_favorite !== "boolean") {
    return NextResponse.json({ error: "is_favorite (boolean) required" }, { status: 400 });
  }

  const sql = getDb();
  try {
    const rows = await sql`
      UPDATE ingredients SET is_favorite = ${is_favorite}
      WHERE id = ${id}
      RETURNING id, is_favorite
    `;
    if (rows.length === 0) {
      return NextResponse.json({ error: "Ingredient not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, id, is_favorite });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}

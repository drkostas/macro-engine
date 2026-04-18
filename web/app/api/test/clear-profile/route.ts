import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * POST /api/test/clear-profile
 *
 * Deletes the nutrition_profile row (id=1). Used by e2e tests only.
 * Returns 403 in production.
 */
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Forbidden in production" }, { status: 403 });
  }

  const sql = getDb();
  await sql`DELETE FROM nutrition_profile WHERE id = 1`;
  return NextResponse.json({ cleared: true });
}

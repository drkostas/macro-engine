import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  let db = "unknown";
  try {
    const sql = getDb();
    await sql`SELECT 1`;
    db = "connected";
  } catch {
    db = "disconnected";
  }
  return NextResponse.json({
    status: db === "connected" ? "ok" : "degraded",
    db,
  }, { status: db === "connected" ? 200 : 503 });
}

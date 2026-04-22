import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  ALL_METHODS,
  effectiveSigmaKg,
  methodSigmaKg,
  type Method,
} from "@/lib/body-comp";

/**
 * GET/POST /api/nutrition/ffm-anchor
 *
 * Persists body-composition measurements and exposes the most-recent one as
 * the current anchor (V2 §8.2 most-recent-wins policy — don't blend).
 *
 * On POST, if the new anchor becomes the most recent we also propagate it to
 * `nutrition_profile.estimated_ffm_kg` so downstream code (BMR, floors) uses
 * the fresh value without having to query this table.
 */

function isMethod(v: unknown): v is Method {
  return typeof v === "string" && (ALL_METHODS as readonly string[]).includes(v);
}

interface AnchorRow {
  id: number;
  date: string | Date;
  method: Method;
  ffm_kg: number;
  sigma_kg: number;
  notes: string | null;
  created_at: string | Date;
}

function weeksBetween(earlier: Date, later: Date): number {
  const ms = later.getTime() - earlier.getTime();
  return ms / (7 * 24 * 60 * 60 * 1000);
}

function serializeAnchor(r: AnchorRow, now: Date = new Date()) {
  const anchorDate = r.date instanceof Date ? r.date : new Date(String(r.date));
  const weeksSince = weeksBetween(anchorDate, now);
  return {
    id: r.id,
    date: anchorDate.toISOString().split("T")[0],
    method: r.method,
    ffm_kg: Number(r.ffm_kg),
    sigma_kg: Number(r.sigma_kg),
    effective_sigma_kg: effectiveSigmaKg(r.method, weeksSince),
    notes: r.notes,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Body required" }, { status: 400 });
    }
    const { date, method, ffm_kg, notes } = body as Record<string, unknown>;

    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: "date must be an ISO YYYY-MM-DD string" },
        { status: 400 },
      );
    }
    if (!isMethod(method)) {
      return NextResponse.json(
        { error: `method must be one of ${ALL_METHODS.join(", ")}` },
        { status: 400 },
      );
    }
    const ffm = Number(ffm_kg);
    if (!Number.isFinite(ffm) || ffm <= 0) {
      return NextResponse.json(
        { error: "ffm_kg must be a positive number" },
        { status: 400 },
      );
    }

    const sigma = methodSigmaKg(method);
    const notesVal = typeof notes === "string" && notes ? notes : null;

    const sql = getDb();
    const inserted = (await sql`
      INSERT INTO ffm_anchor (date, method, ffm_kg, sigma_kg, notes)
      VALUES (${date}::date, ${method}, ${ffm}, ${sigma}, ${notesVal})
      RETURNING id, date, method, ffm_kg, sigma_kg, notes, created_at
    `) as AnchorRow[];

    // Propagate to profile only if no OTHER anchor has a later date. We query
    // the max of "other" anchors so the test mock (and intent) is unambiguous:
    // a null/empty result means this anchor is the most recent.
    const newId = inserted[0].id;
    const laterRow = (await sql`
      SELECT MAX(date) AS max_date FROM ffm_anchor WHERE id <> ${newId}
    `) as { max_date: string | Date | null }[];
    const otherMax = laterRow[0]?.max_date ?? null;
    const otherMaxStr = otherMax == null
      ? null
      : (otherMax instanceof Date
          ? otherMax.toISOString().split("T")[0]
          : String(otherMax).split("T")[0]);
    const isLatest = otherMaxStr == null || date >= otherMaxStr;
    if (isLatest) {
      await sql`UPDATE nutrition_profile SET estimated_ffm_kg = ${ffm}, updated_at = NOW() WHERE id = 1`;
    }

    return NextResponse.json(
      { ok: true, anchor: serializeAnchor(inserted[0]) },
      { status: 201 },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const limitParam = Number(url.searchParams.get("limit") ?? 10);
    const limit = Number.isFinite(limitParam) && limitParam > 0 && limitParam <= 200
      ? Math.floor(limitParam)
      : 10;

    const sql = getDb();
    const rows = (await sql`
      SELECT id, date, method, ffm_kg, sigma_kg, notes, created_at
      FROM ffm_anchor
      ORDER BY date DESC, created_at DESC
      LIMIT ${limit}
    `) as AnchorRow[];

    if (rows.length === 0) {
      return NextResponse.json({ error: "No anchors logged" }, { status: 404 });
    }

    const now = new Date();
    return NextResponse.json({
      current: serializeAnchor(rows[0], now),
      history: rows.map((r) => serializeAnchor(r, now)),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { computeHooperAlert, type HooperAlert } from "@/lib/subjective";

/**
 * GET/POST /api/nutrition/subjective
 *
 * Per-day wellness log storing four partial payloads (Hooper, hunger, RPE,
 * screeners) as JSONB. POST is an upsert by date; only the provided fields
 * are updated, others preserved. GET returns today, last 28 days, and a
 * Hooper Z-alert computed over history.
 */

interface HooperPayload {
  fatigue: number;
  sleep: number;
  stress: number;
  soreness: number;
}

interface SubjectiveRow {
  date: string | Date;
  morning_hooper: HooperPayload | null;
  hunger_by_slot: Record<string, number> | null;
  workout_rpe: { rpe: number; duration_min: number } | null;
  phq2: { little_interest: number; feeling_down: number } | null;
  scoff: Record<string, boolean> | null;
}

function validateHooper(v: unknown): v is HooperPayload {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  for (const k of ["fatigue", "sleep", "stress", "soreness"]) {
    const val = o[k];
    if (typeof val !== "number" || val < 1 || val > 7) return false;
  }
  return true;
}

function serialize(r: SubjectiveRow) {
  const d = r.date instanceof Date ? r.date.toISOString().split("T")[0] : String(r.date).split("T")[0];
  return { ...r, date: d };
}

function hooperTotal(h: HooperPayload | null): number | null {
  if (!h) return null;
  return h.fatigue + h.sleep + h.stress + h.soreness;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Body required" }, { status: 400 });
    }

    const { morning_hooper, hunger_by_slot, workout_rpe, phq2, scoff } = body as Record<string, unknown>;
    if (!morning_hooper && !hunger_by_slot && !workout_rpe && !phq2 && !scoff) {
      return NextResponse.json(
        { error: "at least one of morning_hooper, hunger_by_slot, workout_rpe, phq2, scoff is required" },
        { status: 400 },
      );
    }

    if (morning_hooper !== undefined && !validateHooper(morning_hooper)) {
      return NextResponse.json(
        { error: "morning_hooper values must be integers 1-7" },
        { status: 400 },
      );
    }

    const sql = getDb();
    const today = new Date().toISOString().split("T")[0];

    // COALESCE-merge only the provided fields; preserves unspecified columns.
    const rows = (await sql`
      INSERT INTO subjective_log (date, morning_hooper, hunger_by_slot, workout_rpe, phq2, scoff)
      VALUES (
        ${today}::date,
        ${morning_hooper ?? null}::jsonb,
        ${hunger_by_slot ?? null}::jsonb,
        ${workout_rpe ?? null}::jsonb,
        ${phq2 ?? null}::jsonb,
        ${scoff ?? null}::jsonb
      )
      ON CONFLICT (date) DO UPDATE SET
        morning_hooper = COALESCE(EXCLUDED.morning_hooper, subjective_log.morning_hooper),
        hunger_by_slot = COALESCE(EXCLUDED.hunger_by_slot, subjective_log.hunger_by_slot),
        workout_rpe    = COALESCE(EXCLUDED.workout_rpe,    subjective_log.workout_rpe),
        phq2           = COALESCE(EXCLUDED.phq2,           subjective_log.phq2),
        scoff          = COALESCE(EXCLUDED.scoff,          subjective_log.scoff)
      RETURNING date, morning_hooper, hunger_by_slot, workout_rpe, phq2, scoff
    `) as SubjectiveRow[];

    return NextResponse.json(
      { ok: true, row: serialize(rows[0]) },
      { status: 201 },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const sql = getDb();
    const rows = (await sql`
      SELECT date, morning_hooper, hunger_by_slot, workout_rpe, phq2, scoff
      FROM subjective_log
      WHERE date >= CURRENT_DATE - interval '28 days'
      ORDER BY date DESC
      LIMIT 28
    `) as SubjectiveRow[];

    const today = new Date().toISOString().split("T")[0];
    const todayRow = rows.find((r) => {
      const d = r.date instanceof Date ? r.date.toISOString().split("T")[0] : String(r.date).split("T")[0];
      return d === today;
    }) ?? null;

    const hooperHistory = rows
      .map((r) => hooperTotal(r.morning_hooper))
      .filter((v): v is number => v != null);

    const todayTotal = hooperTotal(todayRow?.morning_hooper ?? null);
    const alert: HooperAlert = todayTotal != null
      ? computeHooperAlert(todayTotal, hooperHistory)
      : { zScore: 0, alertLevel: "normal", baselineMean: 0, baselineStd: 0 };

    return NextResponse.json({
      today: todayRow ? serialize(todayRow) : null,
      recent: rows.map(serialize),
      alert,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}

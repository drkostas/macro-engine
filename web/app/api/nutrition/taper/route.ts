import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  classifyTaperPhase,
  taperCarbGPerKg,
  taperProteinGPerKg,
  type TaperPhase,
} from "@/lib/taper";

interface ProfileRow {
  race_date: string | Date | null;
  weight_kg: number | string | null;
  protein_g_per_kg: number | string | null;
}

function toDate(v: string | Date): Date {
  if (v instanceof Date) return v;
  return new Date(String(v) + "T00:00:00Z");
}

function deriveTaper(row: ProfileRow) {
  if (!row.race_date) return null;
  const raceDate = toDate(row.race_date);
  const today = new Date();
  const phase: TaperPhase = classifyTaperPhase(raceDate, today);
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const raceUtc = Date.UTC(
    raceDate.getUTCFullYear(), raceDate.getUTCMonth(), raceDate.getUTCDate(),
  );
  const daysUntil = Math.round((raceUtc - todayUtc) / 86400000);
  const baselineProtein = Number(row.protein_g_per_kg ?? 2.0);
  // Default carb baseline: ~5 g/kg for endurance athletes, 3 for general training.
  const baselineCarb = 5.0;
  return {
    raceDate: raceDate.toISOString().split("T")[0],
    daysUntil,
    phase,
    carbGPerKg: taperCarbGPerKg(phase, { baselineGPerKg: baselineCarb }),
    proteinGPerKg: taperProteinGPerKg(phase, { baselineGPerKg: baselineProtein }),
    weightKg: row.weight_kg != null ? Number(row.weight_kg) : null,
  };
}

export async function GET() {
  try {
    const sql = getDb();
    const rows = (await sql`
      SELECT race_date, weight_kg, protein_g_per_kg
      FROM nutrition_profile WHERE id = 1
    `) as ProfileRow[];
    if (rows.length === 0) {
      return NextResponse.json({ taper: null });
    }
    return NextResponse.json({ taper: deriveTaper(rows[0]) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const raw = body?.race_date;
    let raceDate: string | null;
    if (raw === null || raw === undefined || raw === "") {
      raceDate = null;
    } else if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      raceDate = raw;
    } else {
      return NextResponse.json(
        { error: "race_date must be ISO YYYY-MM-DD string or null" },
        { status: 400 },
      );
    }
    const sql = getDb();
    await sql`
      UPDATE nutrition_profile SET race_date = ${raceDate}::date
      WHERE id = 1
    `;
    const rows = (await sql`
      SELECT race_date, weight_kg, protein_g_per_kg
      FROM nutrition_profile WHERE id = 1
    `) as ProfileRow[];
    return NextResponse.json({ taper: rows[0] ? deriveTaper(rows[0]) : null });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  ALL_INJURY_TYPES,
  classifyInjuryPhase,
  getInjuryModule,
  injuredEaHardFloor,
  injuryProteinGPerKg,
  type InjuryType,
} from "@/lib/injured";

interface InjuryRow {
  id: number;
  injury_date: string | Date;
  recovered_date: string | Date | null;
  type: InjuryType;
  notes: string | null;
  rehab_kcal: number;
  pre_injury_protein_g_per_kg: number | string;
}

async function loadFfm(sql: ReturnType<typeof getDb>): Promise<number> {
  const rows = await sql`SELECT estimated_ffm_kg FROM nutrition_profile WHERE id = 1`;
  const raw = (rows[0] as { estimated_ffm_kg: number | string | null } | undefined)?.estimated_ffm_kg;
  return raw != null ? Number(raw) : 60; // safe default for onboarding edge
}

function isKnownType(v: unknown): v is InjuryType {
  return typeof v === "string" && (ALL_INJURY_TYPES as readonly string[]).includes(v);
}

function toDate(v: string | Date): Date {
  if (v instanceof Date) return v;
  return new Date(String(v) + "T00:00:00Z");
}

function deriveActive(row: InjuryRow, ffmKg: number) {
  const injuryDate = toDate(row.injury_date);
  const phase = classifyInjuryPhase(injuryDate, new Date());
  const preInjury = Number(row.pre_injury_protein_g_per_kg);
  const protein = injuryProteinGPerKg(row.type, { preInjuryGPerKg: preInjury });
  const ea = injuredEaHardFloor({ ffmKg, rehabKcal: row.rehab_kcal ?? 0 });
  const module_ = getInjuryModule(row.type);
  return {
    id: row.id,
    injuryDate: injuryDate.toISOString().split("T")[0],
    type: row.type,
    notes: row.notes,
    rehabKcal: row.rehab_kcal,
    phase,
    proteinGPerKg: protein,
    eaFloorKcal: ea,
    module: module_,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const injury_date = body?.injury_date;
    if (typeof injury_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(injury_date)) {
      return NextResponse.json(
        { error: "injury_date must be ISO YYYY-MM-DD string" },
        { status: 400 },
      );
    }
    if (!isKnownType(body?.type)) {
      return NextResponse.json(
        { error: `type must be one of ${ALL_INJURY_TYPES.join(", ")}` },
        { status: 400 },
      );
    }
    const type = body.type as InjuryType;
    const rehab_kcal = Number(body?.rehab_kcal ?? 0);
    const pre_injury_protein_g_per_kg = Number(body?.pre_injury_protein_g_per_kg ?? 2.0);
    const notes = typeof body?.notes === "string" && body.notes ? body.notes : null;

    const sql = getDb();

    // Close any previously-active injury by stamping recovered_date = today.
    await sql`
      UPDATE injury_log SET recovered_date = CURRENT_DATE
      WHERE recovered_date IS NULL
    `;

    const rows = (await sql`
      INSERT INTO injury_log (injury_date, type, notes, rehab_kcal, pre_injury_protein_g_per_kg)
      VALUES (${injury_date}::date, ${type}, ${notes}, ${rehab_kcal}, ${pre_injury_protein_g_per_kg})
      RETURNING id, injury_date, recovered_date, type, notes, rehab_kcal, pre_injury_protein_g_per_kg
    `) as InjuryRow[];

    const ffm = await loadFfm(sql);
    return NextResponse.json(
      { ok: true, injury: deriveActive(rows[0], ffm) },
      { status: 201 },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const id = Number(body?.id);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    const recovered = typeof body?.recovered_date === "string"
      ? body.recovered_date
      : new Date().toISOString().split("T")[0];

    const sql = getDb();
    await sql`
      UPDATE injury_log SET recovered_date = ${recovered}::date
      WHERE id = ${id}
    `;
    return NextResponse.json({ ok: true });
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
      SELECT id, injury_date, recovered_date, type, notes, rehab_kcal, pre_injury_protein_g_per_kg
      FROM injury_log
      WHERE recovered_date IS NULL
      ORDER BY injury_date DESC
      LIMIT 1
    `) as InjuryRow[];

    if (rows.length === 0) {
      return NextResponse.json({ injury: null });
    }
    const ffm = await loadFfm(sql);
    return NextResponse.json({ injury: deriveActive(rows[0], ffm) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}

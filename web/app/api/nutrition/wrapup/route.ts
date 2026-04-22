import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  computeWeeklyWrapup,
  wrapupTakeaway,
  type DayRecord,
} from "@/lib/weekly-wrapup";

function parseEndDate(raw: string | null): string {
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return new Date().toISOString().split("T")[0];
}

interface NutritionDayRow {
  date: string | Date;
  target_calories: number | string | null;
  actual_calories: number | string | null;
  status: string | null;
  training_day_type: string | null;
}

interface ProteinRow {
  date: string | Date;
  total_protein: number | string | null;
}

interface WeightRow {
  date: string | Date;
  weight_grams: number | string | null;
}

function isoDate(v: string | Date): string {
  if (v instanceof Date) return v.toISOString().split("T")[0];
  return String(v).slice(0, 10);
}

export async function GET(req: NextRequest) {
  const end = parseEndDate(req.nextUrl.searchParams.get("end"));
  try {
    const sql = getDb();
    const profileRows = await sql`SELECT weight_kg FROM nutrition_profile WHERE id = 1` as Array<{ weight_kg: number | string | null }>;
    const weightKg = profileRows[0]?.weight_kg != null
      ? Number(profileRows[0].weight_kg)
      : 75;

    const dayRows = (await sql`
      SELECT date, target_calories, actual_calories, status, training_day_type
      FROM nutrition_day
      WHERE date > ${end}::date - interval '7 days' AND date <= ${end}::date
      ORDER BY date ASC
    `) as NutritionDayRow[];

    const proteinRows = (await sql`
      SELECT date, SUM(protein) AS total_protein
      FROM meal_log
      WHERE date > ${end}::date - interval '7 days' AND date <= ${end}::date
        AND (planned IS NULL OR planned = false)
      GROUP BY date
    `) as ProteinRow[];
    const proteinByDate: Record<string, number> = {};
    for (const r of proteinRows) {
      proteinByDate[isoDate(r.date)] = Number(r.total_protein ?? 0);
    }

    const weightRows = (await sql`
      SELECT DATE(synced_at) AS date, weight_grams
      FROM weight_log
      WHERE synced_at > ${end}::date - interval '7 days'
        AND synced_at <= (${end}::date + interval '1 day')
      ORDER BY synced_at ASC
    `) as WeightRow[];
    const weightByDate: Record<string, number> = {};
    for (const r of weightRows) {
      if (r.weight_grams != null) {
        weightByDate[isoDate(r.date)] = Number(r.weight_grams) / 1000;
      }
    }

    const records: DayRecord[] = dayRows.map((r) => {
      const d = isoDate(r.date);
      const training = (r.training_day_type ?? "rest").toLowerCase();
      return {
        day: d,
        targetKcal: Number(r.target_calories ?? 0),
        actualKcal: Number(r.actual_calories ?? 0),
        proteinG: proteinByDate[d] ?? 0,
        weightKg: weightByDate[d] ?? null,
        hadTraining: training !== "rest" && training !== "",
        wasClosed: (r.status ?? "active") === "closed",
      };
    });

    const wrapup = computeWeeklyWrapup(records, { weightKg });
    return NextResponse.json({
      wrapup,
      takeaway: wrapupTakeaway(wrapup),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}

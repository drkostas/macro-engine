import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  ALLOWED_WINDOWS,
  computeProgressionWindow,
  type DayRecord,
} from "@/lib/progression";

interface NutritionDayRow {
  date: string | Date;
  target_calories: number | string | null;
  actual_calories: number | string | null;
  tdee_used: number | string | null;
  status: string | null;
  training_day_type: string | null;
}

interface WeightRow {
  date: string | Date;
  weight_grams: number | string | null;
}

function isoDate(v: string | Date): string {
  if (v instanceof Date) return v.toISOString().split("T")[0];
  return String(v).slice(0, 10);
}

function parseWindow(raw: string | null): number {
  if (raw === null) return 30;
  const n = Number(raw);
  if (!Number.isFinite(n)) return NaN;
  return n;
}

export async function GET(req: NextRequest) {
  const windowDays = parseWindow(req.nextUrl.searchParams.get("window"));
  if (!ALLOWED_WINDOWS.includes(windowDays)) {
    return NextResponse.json(
      { error: `window must be one of ${[...ALLOWED_WINDOWS].join(", ")}` },
      { status: 400 },
    );
  }

  try {
    const sql = getDb();
    const profileRows = (await sql`
      SELECT weight_kg FROM nutrition_profile WHERE id = 1
    `) as Array<{ weight_kg: number | string | null }>;
    const weightKg = profileRows[0]?.weight_kg != null
      ? Number(profileRows[0].weight_kg)
      : 75;

    const dayRows = (await sql`
      SELECT date, target_calories, actual_calories, tdee_used, status, training_day_type
      FROM nutrition_day
      WHERE date > CURRENT_DATE - (${windowDays}::int) * interval '1 day'
        AND date <= CURRENT_DATE
      ORDER BY date ASC
    `) as NutritionDayRow[];

    const weightRows = (await sql`
      SELECT DATE(synced_at) AS date, weight_grams
      FROM weight_log
      WHERE synced_at > CURRENT_DATE - (${windowDays}::int) * interval '1 day'
        AND synced_at <= (CURRENT_DATE + interval '1 day')
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
        tdeeKcal: r.tdee_used != null ? Number(r.tdee_used) : null,
        weightKg: weightByDate[d] ?? null,
        hadTraining: training !== "rest" && training !== "",
        wasClosed: (r.status ?? "active") === "closed",
      };
    });

    const progression = computeProgressionWindow(records, { weightKg, windowDays });
    return NextResponse.json({ progression });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}

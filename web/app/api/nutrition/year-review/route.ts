import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  computeYearReview,
  type YearDayRecord,
} from "@/lib/year-review";

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
  const raw = req.nextUrl.searchParams.get("year");
  const currentYear = new Date().getUTCFullYear();
  let year: number;
  if (raw === null || raw === "") {
    year = currentYear;
  } else {
    year = Number(raw);
    if (!Number.isInteger(year)) {
      return NextResponse.json(
        { error: "year must be an integer" },
        { status: 400 },
      );
    }
    if (year < 1970 || year > 9999) {
      return NextResponse.json(
        { error: "year must be between 1970 and 9999" },
        { status: 400 },
      );
    }
  }

  try {
    const sql = getDb();

    const dayRows = (await sql`
      SELECT date, target_calories, actual_calories, status, training_day_type
      FROM nutrition_day
      WHERE EXTRACT(YEAR FROM date) = ${year}
      ORDER BY date ASC
    `) as NutritionDayRow[];

    const proteinRows = (await sql`
      SELECT date, SUM(protein) AS total_protein
      FROM meal_log
      WHERE EXTRACT(YEAR FROM date) = ${year}
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
      WHERE EXTRACT(YEAR FROM synced_at) = ${year}
      ORDER BY synced_at ASC
    `) as WeightRow[];
    const weightByDate: Record<string, number> = {};
    for (const r of weightRows) {
      if (r.weight_grams != null) {
        weightByDate[isoDate(r.date)] = Number(r.weight_grams) / 1000;
      }
    }

    const records: YearDayRecord[] = dayRows.map((r) => {
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

    const review = computeYearReview(records, { year });
    return NextResponse.json({ review });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}

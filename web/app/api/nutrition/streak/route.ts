import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * GET /api/nutrition/streak
 * Walks closed days backward from today; a day "hits" when
 * (tdee_used - actual_calories) >= deficit_used - 100 (the 100 kcal
 * slack mirrors the close-day adherence band).
 *
 * Returns: { streak: number, longest: number }
 */
export async function GET() {
  const sql = getDb();
  const rows = (await sql`
    SELECT date, tdee_used, actual_calories, deficit_used
    FROM nutrition_day
    WHERE status = 'closed'
      AND tdee_used IS NOT NULL
      AND actual_calories IS NOT NULL
      AND deficit_used IS NOT NULL
    ORDER BY date DESC
  `) as Array<{
    date: string;
    tdee_used: number;
    actual_calories: number;
    deficit_used: number;
  }>;

  const { streak, longest } = computeStreak(rows);
  return NextResponse.json({ streak, longest });
}

export interface ClosedDay {
  /** ISO date string "YYYY-MM-DD" or a Date instance (both are normalized). */
  date: string | Date;
  tdee_used: number;
  actual_calories: number;
  deficit_used: number;
}

/**
 * Given closed days sorted DESC by date, returns:
 * - streak: consecutive hits starting from the most recent closed day
 * - longest: longest consecutive-hit run across the entire history
 *
 * A day "hits" when (tdee_used - actual_calories) >= deficit_used - 100.
 * Calendar gaps break the streak (we do not count skipped days as hits).
 */
export function computeStreak(rows: ClosedDay[]): { streak: number; longest: number } {
  if (rows.length === 0) return { streak: 0, longest: 0 };

  const hit = (r: ClosedDay) => r.tdee_used - r.actual_calories >= r.deficit_used - 100;

  const oneDayMs = 24 * 60 * 60 * 1000;
  const asDate = (d: string | Date) => {
    if (d instanceof Date) {
      // Normalize to UTC midnight of the calendar date in the Date's local value.
      // Neon/postgres.js return DATE as midnight UTC already, so Date.UTC extracts cleanly.
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    }
    return new Date(`${d}T00:00:00Z`).getTime();
  };

  // Current streak: walk from most recent down while days are consecutive + hits.
  let streak = 0;
  if (hit(rows[0])) {
    streak = 1;
    for (let i = 1; i < rows.length; i++) {
      const prev = asDate(rows[i - 1].date);
      const curr = asDate(rows[i].date);
      if (prev - curr !== oneDayMs) break;
      if (!hit(rows[i])) break;
      streak += 1;
    }
  }

  // Longest streak: one pass over rows (still DESC), reset on miss or calendar gap.
  let longest = 0;
  let run = 0;
  for (let i = 0; i < rows.length; i++) {
    if (!hit(rows[i])) { run = 0; continue; }
    if (i === 0) { run = 1; }
    else {
      const prev = asDate(rows[i - 1].date);
      const curr = asDate(rows[i].date);
      run = prev - curr === oneDayMs ? run + 1 : 1;
    }
    if (run > longest) longest = run;
  }

  return { streak, longest: Math.max(longest, streak) };
}

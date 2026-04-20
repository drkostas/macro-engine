import { NextResponse } from "next/server";
import postgres from "postgres";
import { getDb } from "@/lib/db";

/**
 * GET /api/garmin/sync
 *
 * Reads latest Garmin health data from the soma project's Neon DB
 * and writes it into the local macro-engine database (weight_log,
 * nutrition_day, nutrition_profile).
 *
 * Requires SOMA_DATABASE_URL env var. Returns 503 if not configured.
 */
export async function GET() {
  const somaUrl = process.env.SOMA_DATABASE_URL;
  if (!somaUrl) {
    return NextResponse.json(
      {
        error: "SOMA_DATABASE_URL not configured",
        hint: "Set SOMA_DATABASE_URL in .env.local to enable Garmin data sync from the soma project database.",
      },
      { status: 503 },
    );
  }

  const somaSql = postgres(somaUrl, { prepare: false, idle_timeout: 5 });
  const sql = getDb();

  try {
    // 1. Fetch last 7 days of daily health summaries from soma
    const healthRows = await somaSql`
      SELECT date, total_steps, bmr_kilocalories, active_kilocalories,
             total_kilocalories, resting_heart_rate
      FROM daily_health_summary
      WHERE date >= NOW() - INTERVAL '7 days'
      ORDER BY date DESC
    `;

    // 2. Fetch step_goal from soma's nutrition_profile
    const profileRows = await somaSql`
      SELECT step_goal FROM nutrition_profile WHERE id = 1 LIMIT 1
    `;

    // 3. Fetch latest weight entry from soma (any source)
    const weightRows = await somaSql`
      SELECT date, weight_grams, body_fat_pct, source_type
      FROM weight_log
      ORDER BY date DESC, synced_at DESC
      LIMIT 1
    `;

    let syncedDays = 0;
    let latestWeight: number | null = null;
    let stepGoal: number | null = null;

    // Read step goal from soma profile
    if (profileRows.length > 0 && profileRows[0].step_goal) {
      stepGoal = Number(profileRows[0].step_goal);
    }

    // 4. Upsert daily health data into local nutrition_day
    for (const row of healthRows) {
      const date = typeof row.date === "string"
        ? row.date
        : (row.date as Date).toISOString().split("T")[0];

      const stepCals = row.active_kilocalories ?? 0;
      const exerciseCals = 0; // exercise calories come from activity detection, not health summary
      const expectedSteps = row.total_steps ?? null;

      // Ensure nutrition_day row exists (needed for FK constraints on meal_log etc.)
      await sql`
        INSERT INTO nutrition_day (date)
        VALUES (${date})
        ON CONFLICT (date) DO NOTHING
      `;

      // Update step/calorie data from Garmin
      await sql`
        UPDATE nutrition_day
        SET step_calories = COALESCE(${stepCals}, step_calories),
            expected_steps = COALESCE(${expectedSteps}, expected_steps),
            exercise_calories = COALESCE(NULLIF(${exerciseCals}, 0), exercise_calories)
        WHERE date = ${date}
      `;

      syncedDays++;
    }

    // 5. Upsert latest weight into local weight_log
    if (weightRows.length > 0) {
      const w = weightRows[0];
      const weightDate = typeof w.date === "string"
        ? w.date
        : (w.date as Date).toISOString().split("T")[0];
      const weightGrams = Number(w.weight_grams);
      latestWeight = weightGrams / 1000;
      const sourceType = w.source_type ?? "garmin";

      await sql`
        INSERT INTO weight_log (date, weight_grams, body_fat_pct, source_type, synced_at)
        VALUES (${weightDate}, ${weightGrams}, ${w.body_fat_pct ?? null}, ${sourceType}, NOW())
        ON CONFLICT (date, weight_grams) DO UPDATE
        SET body_fat_pct = EXCLUDED.body_fat_pct,
            source_type = EXCLUDED.source_type,
            synced_at = NOW()
      `;

      // 6. Update nutrition_profile with latest weight
      await sql`
        UPDATE nutrition_profile
        SET weight_kg = ${latestWeight},
            updated_at = NOW()
        WHERE id = 1
      `;
    }

    // 7. Update step_goal in nutrition_profile if we got one
    if (stepGoal !== null) {
      await sql`
        UPDATE nutrition_profile
        SET step_goal = ${stepGoal},
            updated_at = NOW()
        WHERE id = 1
      `;
    }

    return NextResponse.json({
      synced: {
        days: syncedDays,
        latestWeight,
        stepGoal,
      },
    });
  } catch (err) {
    console.error("[garmin/sync] Error:", err);
    return NextResponse.json(
      { error: "Sync failed", details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  } finally {
    await somaSql.end();
  }
}

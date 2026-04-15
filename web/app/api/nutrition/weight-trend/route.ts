import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * GET /api/nutrition/weight-trend?days=30
 *
 * Returns weight + BF% trend, goal info, and projection data for charting.
 */
export async function GET(req: NextRequest) {
  const days = Math.min(Number(req.nextUrl.searchParams.get("days")) || 30, 180);
  const sql = getDb();

  try {
    // Weight trend from analytics table
    const trendRows = await sql`
      SELECT date, weight_kg, avg_7d
      FROM analytics_weight_trend
      WHERE date >= CURRENT_DATE - ${days}::int
      ORDER BY date ASC
    `;

    // Profile for goal data
    const profileRows = await sql`
      SELECT weight_kg, estimated_bf_pct, target_bf_pct, target_date, daily_deficit
      FROM nutrition_profile LIMIT 1
    `;

    const profile = profileRows[0];
    if (!profile) {
      return NextResponse.json({ error: "No profile" }, { status: 404 });
    }

    // Use ACTUAL latest weight, not stale profile
    const latestWeightRow = await sql`
      SELECT weight_grams / 1000.0 AS kg FROM weight_log ORDER BY date DESC LIMIT 1
    `;
    const currentWeight = latestWeightRow[0]?.kg
      ? Number(latestWeightRow[0].kg)
      : trendRows.length > 0
        ? Number(trendRows[trendRows.length - 1].weight_kg)
        : Number(profile.weight_kg);

    // BF% estimation: use constant FFM model from latest known BF%
    // BF% changes proportionally with weight if FFM stays constant
    const profileBf = Number(profile.estimated_bf_pct) || null;
    const profileWeight = Number(profile.weight_kg) || currentWeight;
    const ffm = profileBf ? profileWeight * (1 - profileBf / 100) : null;

    // Compute BF% for each trend point using constant FFM
    const trendWithBf = trendRows.map((r: Record<string, unknown>) => {
      const w = Number(r.weight_kg);
      const bfPct = ffm && w > 0 ? Math.round(((w - ffm) / w) * 1000) / 10 : null;
      return {
        date: String(r.date).split("T")[0],
        weight: w,
        avg7d: Number(r.avg_7d),
        bfPct,
      };
    });

    const currentBf = ffm && currentWeight > 0
      ? Math.round(((currentWeight - ffm) / currentWeight) * 1000) / 10
      : profileBf;
    const targetBf = Number(profile.target_bf_pct) || null;
    const rawTargetDate = profile.target_date;
    const targetDate = rawTargetDate
      ? (rawTargetDate instanceof Date
          ? rawTargetDate.toISOString().split("T")[0]
          : String(rawTargetDate).includes("T")
            ? String(rawTargetDate).split("T")[0]
            : String(rawTargetDate).substring(0, 10))
      : null;

    // Goal calculations using CURRENT weight (not stale profile)
    let targetWeight: number | null = null;
    let fatToLose: number | null = null;
    let daysRemaining: number | null = null;
    let weeklyRateLoss: number | null = null;
    let progressPct: number | null = null;

    if (ffm && targetBf && targetDate) {
      targetWeight = Math.round((ffm / (1 - targetBf / 100)) * 10) / 10;
      fatToLose = Math.max(0, Math.round((currentWeight - targetWeight) * 10) / 10);

      const msLeft = new Date(targetDate).getTime() - Date.now();
      daysRemaining = Math.max(0, Math.ceil(msLeft / 86400000));
      weeklyRateLoss = daysRemaining > 7
        ? Math.round((fatToLose / (daysRemaining / 7)) * 100) / 100
        : null;

      if (trendWithBf.length >= 2) {
        const startWeight = trendWithBf[0].weight;
        const totalToLose = startWeight - targetWeight;
        const lostSoFar = startWeight - currentWeight;
        progressPct = totalToLose > 0
          ? Math.min(100, Math.round((lostSoFar / totalToLose) * 100))
          : 0;
      }
    }

    // Projection: extend trend forward based on weekly rate of loss
    const projection: Array<{ date: string; weight: number; bfPct: number | null }> = [];
    if (targetWeight && weeklyRateLoss && weeklyRateLoss > 0 && daysRemaining && daysRemaining > 0) {
      const dailyLoss = weeklyRateLoss / 7;
      const projDays = Math.min(daysRemaining, 90); // cap at 90 days forward
      let projWeight = currentWeight;
      const todayMs = Date.now();
      for (let d = 7; d <= projDays; d += 7) {
        projWeight = Math.max(targetWeight, projWeight - dailyLoss * 7);
        const projDate = new Date(todayMs + d * 86400000).toISOString().split("T")[0];
        const projBf = ffm ? Math.round(((projWeight - ffm) / projWeight) * 1000) / 10 : null;
        projection.push({ date: projDate, weight: Math.round(projWeight * 10) / 10, bfPct: projBf });
      }
    }

    return NextResponse.json({
      trend: trendWithBf,
      projection,
      current: {
        weight: Math.round(currentWeight * 10) / 10,
        bfPct: currentBf,
        deficit: Number(profile.daily_deficit) || 0,
      },
      goal: {
        targetWeight,
        targetBf,
        targetDate,
        fatToLose,
        daysRemaining,
        weeklyRateLoss,
        progressPct,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load weight trend" },
      { status: 500 },
    );
  }
}

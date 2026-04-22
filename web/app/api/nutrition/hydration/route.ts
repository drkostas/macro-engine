import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  computeSodiumTarget,
  computeWaterTarget,
  effectiveHydration,
} from "@/lib/hydration";

/**
 * GET/POST /api/nutrition/hydration
 *
 * Per-day drink log + targets. POST appends a drink and updates running
 * sodium. GET returns today's log, the accumulated effective_ml, sodium
 * running total, and derived targets from profile weight.
 */

interface DrinkEntry {
  ts: string;
  volume_ml: number;
  ethanol_g: number;
  caffeine_mg: number;
}

interface HydrationRow {
  date: string | Date;
  logs: DrinkEntry[];
  sodium_mg: number;
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}

async function loadProfileWeight(sql: ReturnType<typeof getDb>): Promise<number | null> {
  const rows = await sql`SELECT weight_kg FROM nutrition_profile WHERE id = 1`;
  if (!rows[0]) return null;
  const w = (rows[0] as { weight_kg: number | string }).weight_kg;
  return w != null ? Number(w) : null;
}

function sumEffective(logs: DrinkEntry[]): number {
  return logs.reduce(
    (sum, d) => sum + effectiveHydration(d.volume_ml, {
      ethanolG: d.ethanol_g ?? 0,
      caffeineMg: d.caffeine_mg ?? 0,
    }),
    0,
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const volume_ml = Number(body?.volume_ml);
    if (!Number.isFinite(volume_ml) || volume_ml <= 0) {
      return NextResponse.json(
        { error: "volume_ml must be a positive number" },
        { status: 400 },
      );
    }
    const ethanol_g = Number(body?.ethanol_g ?? 0);
    const caffeine_mg = Number(body?.caffeine_mg ?? 0);
    const sodium_mg = Number(body?.sodium_mg ?? 0);

    const sql = getDb();
    const weight = await loadProfileWeight(sql);
    if (weight == null) {
      return NextResponse.json({ error: "No profile" }, { status: 404 });
    }

    const date = today();
    const newEntry: DrinkEntry = {
      ts: new Date().toISOString(),
      volume_ml, ethanol_g, caffeine_mg,
    };

    // Upsert: insert an empty row if none exists, then append via jsonb ||.
    await sql`
      INSERT INTO hydration_log (date, logs, sodium_mg)
      VALUES (${date}::date, '[]'::jsonb, 0)
      ON CONFLICT (date) DO NOTHING
    `;
    const rows = (await sql`
      UPDATE hydration_log
      SET logs = logs || ${newEntry}::jsonb
      WHERE date = ${date}::date
      RETURNING date, logs, sodium_mg
    `) as HydrationRow[];

    if (sodium_mg > 0) {
      await sql`
        UPDATE hydration_log
        SET sodium_mg = sodium_mg + ${sodium_mg}
        WHERE date = ${date}::date
      `;
    }

    const effective = effectiveHydration(volume_ml, {
      ethanolG: ethanol_g, caffeineMg: caffeine_mg,
    });

    return NextResponse.json(
      {
        ok: true,
        effective_ml: effective,
        log: rows[0],
      },
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
    const weight = await loadProfileWeight(sql);
    if (weight == null) {
      return NextResponse.json({ error: "No profile" }, { status: 404 });
    }

    const date = today();
    const rows = (await sql`
      SELECT date, logs, sodium_mg FROM hydration_log WHERE date = ${date}::date
    `) as HydrationRow[];

    const logs = rows[0]?.logs ?? [];
    const sodiumTotal = rows[0]?.sodium_mg ?? 0;
    const effective = sumEffective(logs);

    const water = computeWaterTarget(weight);
    const sodiumTarget = computeSodiumTarget({ sweatL: 0 });

    return NextResponse.json({
      date,
      logs,
      effectiveMl: effective,
      sodiumMg: sodiumTotal,
      targets: {
        waterBeverageMl: water.beverageMl,
        waterTotalMl: water.totalMl,
        sodiumMg: sodiumTarget,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { climateAdjust, type Environment, type Sex } from "@/lib/climate";

const KNOWN_ENVS: readonly Environment[] = ["normal", "altitude", "heat", "cold"];

interface ProfileRow {
  climate_env: Environment | null;
  weight_kg: number | string | null;
  sex: string | null;
  climate_sweat_l_per_hour: number | string | null;
  climate_hours: number | string | null;
}

function normalizeSex(v: string | null | undefined): Sex {
  const s = (v ?? "M").toUpperCase();
  return s === "F" ? "F" : "M";
}

function buildResponse(row: ProfileRow) {
  const env: Environment = (row.climate_env ?? "normal") as Environment;
  const weightKg = row.weight_kg != null ? Number(row.weight_kg) : 70;
  const sex = normalizeSex(row.sex);
  const sweat = row.climate_sweat_l_per_hour != null
    ? Number(row.climate_sweat_l_per_hour) : undefined;
  const hours = row.climate_hours != null
    ? Number(row.climate_hours) : undefined;
  const adjustment = climateAdjust(env, {
    weightKg, sex,
    sweatLPerHour: sweat, hours: hours,
  });
  return {
    env,
    sweatLPerHour: sweat ?? null,
    hours: hours ?? null,
    adjustment,
  };
}

async function loadProfile(sql: ReturnType<typeof getDb>): Promise<ProfileRow | null> {
  const rows = (await sql`
    SELECT climate_env, weight_kg, sex,
           climate_sweat_l_per_hour, climate_hours
    FROM nutrition_profile WHERE id = 1
  `) as ProfileRow[];
  return rows[0] ?? null;
}

export async function GET() {
  try {
    const sql = getDb();
    const row = await loadProfile(sql);
    if (!row) return NextResponse.json({ climate: null });
    return NextResponse.json({ climate: buildResponse(row) });
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
    const env = body?.env;
    if (!KNOWN_ENVS.includes(env)) {
      return NextResponse.json(
        { error: `env must be one of ${KNOWN_ENVS.join(", ")}` },
        { status: 400 },
      );
    }
    const sweat = body?.sweat_l_per_hour != null ? Number(body.sweat_l_per_hour) : null;
    const hours = body?.hours != null ? Number(body.hours) : null;
    if (sweat !== null && (!Number.isFinite(sweat) || sweat < 0)) {
      return NextResponse.json(
        { error: "sweat_l_per_hour must be a non-negative number" },
        { status: 400 },
      );
    }
    if (hours !== null && (!Number.isFinite(hours) || hours < 0)) {
      return NextResponse.json(
        { error: "hours must be a non-negative number" },
        { status: 400 },
      );
    }

    const sql = getDb();
    await sql`
      UPDATE nutrition_profile
      SET climate_env = ${env as string},
          climate_sweat_l_per_hour = ${sweat},
          climate_hours = ${hours}
      WHERE id = 1
    `;
    const row = await loadProfile(sql);
    if (!row) return NextResponse.json({ climate: null });
    return NextResponse.json({ climate: buildResponse(row) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}

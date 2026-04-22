import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { computeTierRaw } from "@/lib/safety-rails";
import {
  ALL_MODES,
  checkTransition,
  getModeConfig,
  type Mode,
  type TransitionResult,
} from "@/lib/mode-engine";

/**
 * GET/POST /api/nutrition/mode
 *
 * GET  — returns current mode, its config, and per-mode transition availability
 *        so the UI can render a switcher with blocked reasons per mode.
 * POST — validates and applies a mode switch via M2 core-logic transition rules.
 */

function isKnownMode(v: unknown): v is Mode {
  return typeof v === "string" && (ALL_MODES as readonly string[]).includes(v);
}

async function loadProfile() {
  const sql = getDb();
  const rows = await sql`
    SELECT deficit_mode, estimated_bf_pct,
           aggressive_phase_start, reverse_diet_start, deficit_phase_start_date
    FROM nutrition_profile WHERE id = 1
  `;
  return rows[0] as
    | {
        deficit_mode: Mode;
        estimated_bf_pct: number | null;
        aggressive_phase_start: string | null;
        reverse_diet_start: string | null;
        deficit_phase_start_date: string | null;
      }
    | undefined;
}

function configToJSON(mode: Mode) {
  const c = getModeConfig(mode);
  return {
    tierAllowed: [...c.tierAllowed],
    bfHardFloorPct: c.bfHardFloorPct,
    requiresReverseBridgeFrom: [...c.requiresReverseBridgeFrom],
    maxDurationDays: c.maxDurationDays,
  };
}

function transitionToJSON(t: TransitionResult) {
  return { allowed: t.allowed, reason: t.reason, requiresBridge: t.requiresBridge };
}

export async function GET() {
  try {
    const profile = await loadProfile();
    if (!profile) {
      return NextResponse.json({ error: "No profile" }, { status: 404 });
    }
    const bfPct = profile.estimated_bf_pct;
    if (bfPct == null) {
      return NextResponse.json(
        { error: "estimated_bf_pct required to compute mode availability" },
        { status: 400 },
      );
    }
    const current = profile.deficit_mode;
    const tier = computeTierRaw(Number(bfPct));

    const availableTransitions: Record<string, ReturnType<typeof transitionToJSON>> = {};
    for (const m of ALL_MODES) {
      if (m === current) continue;
      availableTransitions[m] = transitionToJSON(
        checkTransition(current, m, tier, Number(bfPct)),
      );
    }

    return NextResponse.json({
      current,
      config: configToJSON(current),
      availableTransitions,
    });
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
    if (!isKnownMode(body.mode)) {
      return NextResponse.json(
        { error: "Body must include { mode: Mode }" },
        { status: 400 },
      );
    }
    const next = body.mode;
    const profile = await loadProfile();
    if (!profile) {
      return NextResponse.json({ error: "No profile" }, { status: 404 });
    }
    const bfPct = profile.estimated_bf_pct;
    if (bfPct == null) {
      return NextResponse.json(
        { error: "estimated_bf_pct required to validate transition" },
        { status: 400 },
      );
    }

    const current = profile.deficit_mode;

    // Same-mode POST is a no-op success — lets the UI "confirm" the active mode.
    if (current === next) {
      return NextResponse.json({ ok: true, current });
    }

    const tier = computeTierRaw(Number(bfPct));
    const result = checkTransition(current, next, tier, Number(bfPct));
    if (!result.allowed) {
      return NextResponse.json(
        {
          error: "Transition not allowed",
          reason: result.reason,
          requires_bridge: result.requiresBridge,
        },
        { status: 409 },
      );
    }

    const sql = getDb();

    // Core mode field.
    await sql`UPDATE nutrition_profile SET deficit_mode = ${next}, updated_at = NOW() WHERE id = 1`;

    // Phase-start stamps: set on entry, clear on exit.
    // Aggressive phase_start — set on entering, clear when leaving.
    if (next === "aggressive") {
      await sql`UPDATE nutrition_profile SET aggressive_phase_start = CURRENT_DATE WHERE id = 1`;
    } else if (current === "aggressive") {
      await sql`UPDATE nutrition_profile SET aggressive_phase_start = NULL WHERE id = 1`;
    }

    // Reverse diet start — same pattern.
    if (next === "reverse") {
      await sql`UPDATE nutrition_profile SET reverse_diet_start = CURRENT_DATE WHERE id = 1`;
    } else if (current === "reverse") {
      await sql`UPDATE nutrition_profile SET reverse_diet_start = NULL WHERE id = 1`;
    }

    // Deficit phase start — stamp once when entering a deficit mode from a
    // non-deficit mode; clear when leaving all deficit modes.
    const DEFICIT_MODES: Mode[] = ["standard", "aggressive"];
    const enteringDeficit = DEFICIT_MODES.includes(next) && !DEFICIT_MODES.includes(current);
    const leavingDeficit = !DEFICIT_MODES.includes(next) && DEFICIT_MODES.includes(current);
    if (enteringDeficit) {
      await sql`UPDATE nutrition_profile SET deficit_phase_start_date = CURRENT_DATE WHERE id = 1`;
    } else if (leavingDeficit) {
      await sql`UPDATE nutrition_profile SET deficit_phase_start_date = NULL WHERE id = 1`;
    }

    return NextResponse.json({ ok: true, current: next });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}

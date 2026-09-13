import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const tokens = body?.tokens;

  if (
    !tokens ||
    typeof tokens !== "object" ||
    !tokens.di_token ||
    !tokens.di_refresh_token ||
    !tokens.di_client_id
  ) {
    return NextResponse.json(
      { error: "Invalid tokens: expected di_token, di_refresh_token, di_client_id" },
      { status: 400 }
    );
  }

  const payload = {
    di_token: tokens.di_token,
    di_refresh_token: tokens.di_refresh_token,
    di_client_id: tokens.di_client_id,
  };

  try {
    const sql = getDb();
    await sql`
      INSERT INTO platform_credentials (platform, auth_type, credentials, status, connected_at)
      VALUES (
        'garmin',
        'oauth_di',
        jsonb_build_object('garmin_tokens', ${sql.json(payload)}),
        'active',
        NOW()
      )
      ON CONFLICT (platform)
      DO UPDATE SET
        credentials = jsonb_build_object('garmin_tokens', ${sql.json(payload)}),
        status = 'active',
        connected_at = NOW()
    `;
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg.slice(0, 200) }, { status: 500 });
  }
}

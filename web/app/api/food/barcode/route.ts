import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

/**
 * GET /api/food/barcode?code=5060337500012
 *
 * Proxy to Open Food Facts API for barcode lookup.
 * Returns normalized nutrition data per 100g.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code")?.trim();

  if (!code || code.length < 8) {
    return NextResponse.json(
      { error: "Invalid barcode (min 8 digits)" },
      { status: 400 },
    );
  }

  try {
    const resp = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}?fields=product_name,brands,nutriments,serving_size,image_url`,
      { headers: { "User-Agent": "MacroEngine/1.0" } },
    );

    if (!resp.ok) {
      return NextResponse.json(
        { error: `Open Food Facts returned ${resp.status}` },
        { status: 502 },
      );
    }

    const data = await resp.json();

    if (data.status === 0 || !data.product) {
      return NextResponse.json(
        { found: false, code },
        { status: 404 },
      );
    }

    const p = data.product;
    const n = p.nutriments || {};

    return NextResponse.json(
      {
        found: true,
        code,
        product: {
          name: p.product_name || "Unknown",
          brand: p.brands || null,
          image_url: p.image_url || null,
          calories: n["energy-kcal_100g"] ?? n["energy-kcal"] ?? null,
          protein: n.proteins_100g ?? null,
          carbs: n.carbohydrates_100g ?? null,
          fat: n.fat_100g ?? null,
          fiber: n.fiber_100g ?? null,
          sugar: n.sugars_100g ?? null,
          sodium: n.sodium_100g ? n.sodium_100g * 1000 : null, // g -> mg
          serving_size: p.serving_size || null,
        },
      },
      {
        headers: {
          "Cache-Control": "s-maxage=86400, stale-while-revalidate=604800",
        },
      },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Lookup failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

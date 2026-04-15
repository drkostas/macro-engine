import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { z } from "zod";

/**
 * POST /api/nutrition/parse-nl
 * Body: { text: string }
 *
 * Uses Vercel AI Gateway + Claude to parse a free-text meal description into
 * ingredient items with gram weights and macro estimates.
 */
export const maxDuration = 20;

const ItemSchema = z.object({
  name: z.string(),
  grams: z.number().min(1).max(2000),
  calories: z.number().min(0).max(5000),
  protein: z.number().min(0).max(500),
  carbs: z.number().min(0).max(500),
  fat: z.number().min(0).max(500),
  fiber: z.number().min(0).max(100).default(0),
});

const ResponseSchema = z.object({
  items: z.array(ItemSchema).min(1).max(20),
});

export async function POST(req: NextRequest) {
  const { text } = await req.json();
  if (typeof text !== "string" || text.trim().length < 3) {
    return NextResponse.json({ error: "text required (min 3 chars)" }, { status: 400 });
  }

  try {
    const { object } = await generateObject({
      model: "anthropic/claude-opus-4-6",
      schema: ResponseSchema,
      prompt: `Parse this meal description into ingredient items. Use USDA food data conventions.
Return each food component separately with accurate macro estimates per the gram weight.
If quantity is ambiguous, pick a reasonable typical portion.

Examples:
- "200g chicken and a cup of rice" → chicken breast 200g, cooked rice 160g
- "2 eggs with toast and butter" → whole egg 100g, bread 50g, butter 10g
- "yogurt and granola" → greek yogurt 170g, granola 40g

Meal description: "${text.trim()}"`,
      temperature: 0,
    });

    return NextResponse.json({ items: object.items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Parse failed";
    // Common case: no AI_GATEWAY_API_KEY configured
    if (msg.toLowerCase().includes("api key") || msg.toLowerCase().includes("auth")) {
      return NextResponse.json(
        { error: "AI Gateway not configured. Set AI_GATEWAY_API_KEY." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

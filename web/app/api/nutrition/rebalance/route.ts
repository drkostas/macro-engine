import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  // An empty or non-JSON body used to throw at JSON.parse and surface as a 500 (macro-engine#264).
  let body: { date?: unknown; changedSlot?: unknown; lockedSlots?: unknown } | null = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON with date and changedSlot" }, { status: 400 });
  }
  const date = typeof body?.date === "string" ? body.date : null;
  const changedSlot = typeof body?.changedSlot === "string" ? body.changedSlot : null;
  const lockedSlots = Array.isArray(body?.lockedSlots) ? body.lockedSlots.map(String) : [];
  if (!date || !changedSlot) {
    return NextResponse.json({ error: "date and changedSlot are required" }, { status: 400 });
  }
  const lockedSet = new Set<string>(lockedSlots);
  const sql = getDb();

  const planRows = await sql`SELECT target_calories, manual_override FROM nutrition_day WHERE date = ${date}`;
  const plan = planRows[0];
  if (!plan || !Number(plan.target_calories)) return NextResponse.json({ changes: [] });
  const dayTarget = Number(plan.target_calories);

  const mealRows = await sql`SELECT id, meal_slot, items, calories FROM meal_log WHERE date = ${date} ORDER BY logged_at`;
  const drinkRows = await sql`SELECT calories FROM drink_log WHERE date = ${date}`;
  const drinkCal = drinkRows.reduce((s: number, r: Record<string, unknown>) => s + (Number(r.calories) || 0), 0);

  const totalEaten = mealRows.reduce((s: number, m: Record<string, unknown>) => s + (Number(m.calories) || 0), 0) + drinkCal;
  const remaining = dayTarget - totalEaten;

  if (remaining >= 0) return NextResponse.json({ changes: [] });

  let calToRemove = Math.abs(remaining);

  const ingredientRows = await sql`SELECT id, shrink_priority, calories_per_100g FROM ingredients`;
  const ingMap: Record<string, { priority: number; calPer100g: number }> = {};
  for (const r of ingredientRows) {
    ingMap[r.id as string] = { priority: Number(r.shrink_priority) || 2, calPer100g: Number(r.calories_per_100g) || 0 };
  }

  const SLOT_ORDER: Record<string, number> = { breakfast: 0, lunch: 1, during_workout: 2, dinner: 3, pre_sleep: 4 };
  const changedSlotOrder = changedSlot ? (SLOT_ORDER[changedSlot] ?? 99) : -1;

  type AdjItem = {
    mealId: number; slot: string; idx: number; id: string; name: string;
    grams: number; calories: number; calPerGram: number; priority: number;
  };

  const adjustable: AdjItem[] = [];
  for (const meal of mealRows) {
    const mealSlot = meal.meal_slot as string;
    const mealSlotOrder = SLOT_ORDER[mealSlot] ?? 99;
    if (mealSlotOrder <= changedSlotOrder) continue;
    if (lockedSet.has(mealSlot)) continue;
    const items = meal.items as Array<Record<string, unknown>>;
    if (!items) continue;
    items.forEach((item, idx) => {
      const ing = ingMap[item.ingredient_id as string];
      if (!ing || ing.priority >= 99) return;
      const grams = Number(item.grams) || 0;
      if (grams <= 10) return;
      adjustable.push({
        mealId: Number(meal.id), slot: mealSlot, idx,
        id: item.ingredient_id as string,
        name: ((item.name || item.ingredient_id || "") as string).replace(/_/g, " "),
        grams, calories: Number(item.calories) || 0,
        calPerGram: ing.calPer100g / 100, priority: ing.priority,
      });
    });
  }

  adjustable.sort((a, b) => a.priority - b.priority);

  const changes: { slot: string; ingredient: string; from: number; to: number }[] = [];
  const mealUpdates: Record<number, Array<Record<string, unknown>>> = {};

  for (const item of adjustable) {
    if (calToRemove <= 0) break;
    const minGrams = Math.round(item.grams * 0.2);
    const maxCutGrams = item.grams - minGrams;
    const maxCutCal = maxCutGrams * item.calPerGram;
    const cutCal = Math.min(calToRemove, maxCutCal);
    if (!item.calPerGram || item.calPerGram <= 0) continue;
    const cutGrams = Math.round(cutCal / item.calPerGram);
    if (cutGrams < 3) continue;
    const newGrams = item.grams - cutGrams;
    calToRemove -= cutCal;

    changes.push({ slot: item.slot, ingredient: item.name, from: item.grams, to: newGrams });

    if (!mealUpdates[item.mealId]) {
      const meal = mealRows.find((m: Record<string, unknown>) => Number(m.id) === item.mealId);
      mealUpdates[item.mealId] = JSON.parse(JSON.stringify(meal?.items || []));
    }
    const mItem = mealUpdates[item.mealId][item.idx];
    if (mItem) {
      const ratio = newGrams / item.grams;
      mItem.grams = newGrams;
      if (mItem.cooked_grams) mItem.cooked_grams = Math.round((mItem.cooked_grams as number) * ratio);
      mItem.calories = Math.round(((mItem.calories as number) || 0) * ratio);
      mItem.protein = Math.round((((mItem.protein as number) || 0) * ratio) * 10) / 10;
      mItem.carbs = Math.round((((mItem.carbs as number) || 0) * ratio) * 10) / 10;
      mItem.fat = Math.round((((mItem.fat as number) || 0) * ratio) * 10) / 10;
      mItem.fiber = Math.round((((mItem.fiber as number) || 0) * ratio) * 10) / 10;
    }
  }

  for (const [mealId, items] of Object.entries(mealUpdates)) {
    const cal = items.reduce((s, i) => s + (Number(i.calories) || 0), 0);
    const p = items.reduce((s, i) => s + (Number(i.protein) || 0), 0);
    const c = items.reduce((s, i) => s + (Number(i.carbs) || 0), 0);
    const f = items.reduce((s, i) => s + (Number(i.fat) || 0), 0);
    const fi = items.reduce((s, i) => s + (Number(i.fiber) || 0), 0);
    await sql`UPDATE meal_log SET items = ${sql.json(items)},
      calories = ${cal}, protein = ${p}, carbs = ${c}, fat = ${f}, fiber = ${fi}
      WHERE id = ${Number(mealId)}`;
  }

  return NextResponse.json({ changes });
}

# Phase 3a: Backend Foundation -- Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Port the portion solver and all 11 missing API routes from soma to macro-engine, adapting them for the shared Neon database. This is the backend foundation that Phase 3b (UI) depends on.

**Architecture:** Copy soma's API routes with minimal changes (they already use the same DB). Port portion-solver.ts as-is. Add auto-categorization utility for USDA foods. No Edge runtime (Neon free tier connection limits).

**Tech Stack:** Next.js 16, TypeScript, Neon Postgres (@neondatabase/serverless)

**Source reference:** All soma routes are at `/Users/gkos/Insync/Gdrive/Projects/soma/web/app/api/nutrition/`

---

## Task 1: Port portion-solver.ts

The portion solver is a client-side library (no DB calls). Direct copy from soma.

**Files:**
- Copy: `soma/web/lib/portion-solver.ts` -> `web/lib/portion-solver.ts`

**Step 1: Copy the file**

```bash
cp /Users/gkos/Insync/Gdrive/Projects/soma/web/lib/portion-solver.ts \
   /Users/gkos/Projects/macro-engine/web/lib/portion-solver.ts
```

**Step 2: Verify it compiles**

```bash
cd /Users/gkos/Projects/macro-engine/web && npm run build 2>&1 | tail -5
```

Expected: Build succeeds (portion-solver.ts is pure TS, no external deps).

**Step 3: Commit**

```bash
git add web/lib/portion-solver.ts
git commit -m "feat: port portion-solver.ts from soma

Client-side constraint solver for meal composition.
Protein-first -> carbs -> fat -> vegetables fill.
Supports raw/cooked toggle, count-based units,
category-specific increments and bounds."
```

---

## Task 2: Add auto-categorization utility

New utility for categorizing USDA foods by their macro profile.

**Files:**
- Create: `web/lib/auto-categorize.ts`

**Step 1: Create the utility**

```typescript
/**
 * Auto-categorize a food by its per-100g macro profile.
 * Used when adding USDA foods to a meal or saving to My Ingredients.
 */

export type FoodCategory =
  | "protein" | "carbs" | "fat" | "dairy"
  | "vegetable" | "fruit" | "sauce" | "supplement" | "other";

interface MacroPer100g {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
}

export function autoCategorizFood(macros: MacroPer100g): FoodCategory {
  const { calories, protein, carbs, fat, fiber, sugar } = macros;

  // Calories from each macro
  const pCal = protein * 4;
  const cCal = carbs * 4;
  const fCal = fat * 9;
  const dominant = Math.max(pCal, cCal, fCal);

  // Protein source: >15g protein AND protein is dominant
  if (protein > 15 && pCal === dominant) return "protein";

  // Carb source: >40g carbs AND carbs is dominant
  if (carbs > 40 && cCal === dominant) return "carbs";

  // Fat source: >30g fat AND fat is dominant
  if (fat > 30 && fCal === dominant) return "fat";

  // Dairy: moderate protein (8-15g) AND significant fat (>15g)
  if (protein >= 8 && protein <= 15 && fat > 15) return "dairy";

  // Vegetable: high fiber, low calories
  if ((fiber ?? 0) > 3 && calories < 50) return "vegetable";

  // Fruit: notable sugar, low calories
  if ((sugar ?? 0) > 10 && calories < 80) return "fruit";

  return "other";
}

/** Default shrink priority by category (lower = shrink first in rebalancing) */
export const SHRINK_PRIORITY: Record<FoodCategory, number> = {
  carbs: 1,
  fat: 2,
  dairy: 3,
  fruit: 4,
  sauce: 5,
  other: 6,
  protein: 7,
  supplement: 8,
  vegetable: 99, // never shrink
};
```

**Step 2: Verify build**

```bash
cd /Users/gkos/Projects/macro-engine/web && npm run build 2>&1 | tail -5
```

**Step 3: Commit**

```bash
git add web/lib/auto-categorize.ts
git commit -m "feat: add auto-categorization for USDA foods

Heuristic assigns category (protein/carbs/fat/dairy/vegetable/
fruit/other) from per-100g macros. Used by portion solver and
rebalancing engine. Includes shrink priority map."
```

---

## Task 3: Port skip-slot API

Simplest route. Toggle a slot as skipped, delete any meals in it.

**Files:**
- Create: `web/app/api/nutrition/skip-slot/route.ts`

**Step 1: Create the route**

Direct port from soma (53 lines). Only change: remove `export const runtime = "edge"`.

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  const sql = getDb();
  const { date, slot } = (await req.json()) as { date: string; slot: string };

  if (!date || !slot) {
    return NextResponse.json({ error: "date and slot are required" }, { status: 400 });
  }

  await sql`INSERT INTO nutrition_day (date) VALUES (${date}) ON CONFLICT (date) DO NOTHING`;

  const rows = await sql`SELECT skipped_slots FROM nutrition_day WHERE date = ${date}`;
  const current: string[] = rows[0]?.skipped_slots ?? [];

  if (current.includes(slot)) {
    await sql`UPDATE nutrition_day SET skipped_slots = array_remove(skipped_slots, ${slot}) WHERE date = ${date}`;
  } else {
    await sql`UPDATE nutrition_day SET skipped_slots = array_append(skipped_slots, ${slot}) WHERE date = ${date}`;
    await sql`DELETE FROM meal_log WHERE date = ${date} AND meal_slot = ${slot}`;
  }

  return NextResponse.json({ skipped: !current.includes(slot), slot });
}
```

**Step 2: Test with curl**

```bash
curl -s -X POST http://localhost:3457/api/nutrition/skip-slot \
  -H "Content-Type: application/json" \
  -d '{"date":"2026-04-13","slot":"pre_sleep"}' | python3 -m json.tool
```

Expected: `{"skipped": true, "slot": "pre_sleep"}`

**Step 3: Commit**

```bash
git add web/app/api/nutrition/skip-slot/route.ts
git commit -m "feat: port skip-slot API from soma"
```

---

## Task 4: Port reopen-day API

Simplest route (9 lines).

**Files:**
- Create: `web/app/api/nutrition/reopen-day/route.ts`

**Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { date } = await req.json();
  const sql = getDb();
  await sql`UPDATE nutrition_day SET status = 'active' WHERE date = ${date}`;
  return NextResponse.json({ ok: true });
}
```

**Step 2: Commit**

```bash
git add web/app/api/nutrition/reopen-day/route.ts
git commit -m "feat: port reopen-day API from soma"
```

---

## Task 5: Port activity-select API

**Files:**
- Create: `web/app/api/nutrition/activity-select/route.ts`

**Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  const sql = getDb();
  const body = (await req.json()) as {
    date: string;
    run_enabled?: boolean;
    selected_workouts?: string[];
    expected_steps?: number | null;
    manual_override?: boolean;
  };

  if (!body.date) {
    return NextResponse.json({ error: "date is required" }, { status: 400 });
  }

  await sql`INSERT INTO nutrition_day (date) VALUES (${body.date}) ON CONFLICT (date) DO NOTHING`;

  if (body.manual_override !== undefined) {
    await sql`UPDATE nutrition_day SET manual_override = ${body.manual_override} WHERE date = ${body.date}`;
    if (body.manual_override === false) {
      const profRows = await sql`SELECT daily_deficit FROM nutrition_profile WHERE id = 1`;
      const defaultDeficit = profRows[0]?.daily_deficit != null ? Number(profRows[0].daily_deficit) : 800;
      await sql`UPDATE nutrition_day SET target_calories = NULL, deficit_used = ${defaultDeficit} WHERE date = ${body.date}`;
    }
  }

  if (body.run_enabled !== undefined && body.selected_workouts !== undefined) {
    await sql`
      UPDATE nutrition_day
      SET run_enabled = ${body.run_enabled},
          selected_workouts = ${body.selected_workouts},
          expected_steps = ${body.expected_steps ?? null}
      WHERE date = ${body.date}
    `;
  }

  return NextResponse.json({ ok: true });
}
```

**Step 2: Commit**

```bash
git add web/app/api/nutrition/activity-select/route.ts
git commit -m "feat: port activity-select API from soma"
```

---

## Task 6: Port workout-calories API

**Files:**
- Create: `web/app/api/nutrition/workout-calories/route.ts`

**Step 1: Create the route**

```typescript
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const sql = getDb();
  const rows = await sql`
    WITH ranked AS (
      SELECT hevy_title, calories, duration_s,
        ROW_NUMBER() OVER (PARTITION BY hevy_title ORDER BY workout_date DESC) as rn
      FROM workout_enrichment
      WHERE hevy_title IS NOT NULL AND calories IS NOT NULL AND calories > 0
    )
    SELECT hevy_title, ROUND(AVG(calories))::int AS avg_calories,
      ROUND(AVG(duration_s))::int AS avg_duration_s, COUNT(*)::int AS session_count
    FROM ranked WHERE rn <= 5
    GROUP BY hevy_title ORDER BY hevy_title
  `;
  return NextResponse.json({ routines: rows });
}
```

**Step 2: Commit**

```bash
git add web/app/api/nutrition/workout-calories/route.ts
git commit -m "feat: port workout-calories API from soma"
```

---

## Task 7: Port log-drink API

**Files:**
- Create: `web/app/api/nutrition/log-drink/route.ts`

**Step 1: Create the route**

Full 180-line port from soma with DRINK_DB, fatOxidationPause function, GET/POST/DELETE handlers. Direct copy with `runtime = "edge"` removed.

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

const DRINK_DB: Record<string, {
  name: string; calories_per_100ml: number; carbs_per_100ml: number;
  alcohol_pct: number; default_ml: number;
}> = {
  beer_light:    { name: "Light Beer",           calories_per_100ml: 29,    carbs_per_100ml: 1.3,  alcohol_pct: 4.2,  default_ml: 355 },
  beer_regular:  { name: "Regular Beer",          calories_per_100ml: 43,    carbs_per_100ml: 3.6,  alcohol_pct: 5.0,  default_ml: 355 },
  beer_ipa:      { name: "IPA",                   calories_per_100ml: 60,    carbs_per_100ml: 4.0,  alcohol_pct: 6.5,  default_ml: 355 },
  beer_craft:    { name: "Craft Beer",            calories_per_100ml: 73.2,  carbs_per_100ml: 5.0,  alcohol_pct: 7.8,  default_ml: 355 },
  wine_red:      { name: "Red Wine",              calories_per_100ml: 85,    carbs_per_100ml: 2.6,  alcohol_pct: 13.5, default_ml: 150 },
  wine_white:    { name: "White Wine",            calories_per_100ml: 82,    carbs_per_100ml: 2.6,  alcohol_pct: 12.5, default_ml: 150 },
  spirit:        { name: "Spirit (neat/rocks)",   calories_per_100ml: 220.5, carbs_per_100ml: 0,    alcohol_pct: 40.0, default_ml: 44  },
  margarita:     { name: "Margarita",             calories_per_100ml: 110,   carbs_per_100ml: 11.0, alcohol_pct: 13.0, default_ml: 240 },
  old_fashioned: { name: "Old Fashioned",         calories_per_100ml: 140,   carbs_per_100ml: 5.0,  alcohol_pct: 20.0, default_ml: 120 },
};

const ETHANOL_DENSITY = 0.789;

function fatOxidationPause(alcoholGrams: number): number {
  if (alcoholGrams <= 0) return 0;
  if (alcoholGrams <= 14) return (alcoholGrams / 14) * 4;
  if (alcoholGrams <= 28) return 4 + ((alcoholGrams - 14) / 14) * 2;
  if (alcoholGrams <= 56) return 6 + ((alcoholGrams - 28) / 28) * 6;
  return Math.min(24, 12 + ((alcoholGrams - 56) / 56) * 12);
}

export async function GET() {
  return NextResponse.json({ drinks: DRINK_DB });
}

export async function POST(req: NextRequest) {
  const sql = getDb();
  const { date, drink_type, quantity = 1 } = (await req.json()) as {
    date: string; drink_type: string; quantity?: number;
  };

  if (!date || !drink_type) {
    return NextResponse.json({ error: "date and drink_type are required" }, { status: 400 });
  }

  const drink = DRINK_DB[drink_type];
  if (!drink) {
    return NextResponse.json({ error: `Unknown drink_type: ${drink_type}` }, { status: 400 });
  }

  const totalMl = drink.default_ml * quantity;
  const calories = Math.round((drink.calories_per_100ml * totalMl) / 100);
  const carbs = Math.round(((drink.carbs_per_100ml * totalMl) / 100) * 10) / 10;
  const alcoholGrams = Math.round(totalMl * (drink.alcohol_pct / 100) * ETHANOL_DENSITY * 10) / 10;
  const pauseHours = Math.round(fatOxidationPause(alcoholGrams) * 10) / 10;

  await sql`INSERT INTO nutrition_day (date) VALUES (${date}) ON CONFLICT (date) DO NOTHING`;

  const result = await sql`
    INSERT INTO drink_log (date, drink_type, name, quantity, quantity_ml, calories, carbs, alcohol_grams, fat_oxidation_pause_hours)
    VALUES (${date}, ${drink_type}, ${drink.name}, ${quantity}, ${totalMl}, ${calories}, ${carbs}, ${alcoholGrams}, ${pauseHours})
    RETURNING id
  `;

  return NextResponse.json({ id: result[0].id, calories, alcohol_grams: alcoholGrams, fat_oxidation_pause_hours: pauseHours });
}

export async function DELETE(req: NextRequest) {
  const sql = getDb();
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  await sql`DELETE FROM drink_log WHERE id = ${Number(id)}`;
  return NextResponse.json({ deleted: true });
}
```

**Step 2: Test**

```bash
# GET drink types
curl -s http://localhost:3457/api/nutrition/log-drink | python3 -c "import sys,json; d=json.load(sys.stdin); print(list(d['drinks'].keys()))"

# POST a drink
curl -s -X POST http://localhost:3457/api/nutrition/log-drink \
  -H "Content-Type: application/json" \
  -d '{"date":"2026-04-13","drink_type":"beer_ipa","quantity":1}' | python3 -m json.tool
```

**Step 3: Commit**

```bash
git add web/app/api/nutrition/log-drink/route.ts
git commit -m "feat: port log-drink API from soma (9 drink types, fat oxidation pause)"
```

---

## Task 8: Port presets API

**Files:**
- Create: `web/app/api/nutrition/presets/route.ts`

**Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const sql = getDb();
  const [presets, ingredients] = await Promise.all([
    sql`SELECT id, name, items, tags, meal_slot, total_calories, total_protein,
               total_carbs, total_fat, total_fiber, is_system, use_count, created_at
        FROM preset_meals ORDER BY name`,
    sql`SELECT * FROM ingredients ORDER BY category, name`,
  ]);
  return NextResponse.json({ presets, ingredients });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const sql = getDb();
  await sql`DELETE FROM preset_meals WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  const sql = getDb();
  const { name, items, slot, totals } = (await req.json()) as {
    name: string;
    items: { ingredient_id: string; grams: number }[];
    slot: string;
    totals: { calories: number; protein: number; carbs: number; fat: number; fiber: number };
  };

  if (!name || !items?.length) {
    return NextResponse.json({ error: "name and items are required" }, { status: 400 });
  }

  const tagsLiteral = slot ? `{${slot}}` : "{}";
  const presetId = `preset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const itemsJson = JSON.stringify({ items, ...totals });

  try {
    const result = await sql`
      INSERT INTO preset_meals (id, name, items, tags, meal_slot, total_calories, total_protein, total_carbs, total_fat, total_fiber, is_system)
      VALUES (${presetId}, ${name}, ${itemsJson}::jsonb, ${tagsLiteral}::text[], ${slot || null},
        ${Math.round(totals.calories)}, ${Math.round(totals.protein)},
        ${Math.round(totals.carbs)}, ${Math.round(totals.fat)},
        ${Math.round(totals.fiber)}, false)
      RETURNING id
    `;
    return NextResponse.json({ id: result[0].id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Failed to save preset", detail: msg }, { status: 500 });
  }
}
```

**Step 2: Commit**

```bash
git add web/app/api/nutrition/presets/route.ts
git commit -m "feat: port presets API from soma (GET/POST/DELETE)"
```

---

## Task 9: Port rebalance API

The most complex route (143 lines). Auto-shrinks future meal portions when over budget.

**Files:**
- Create: `web/app/api/nutrition/rebalance/route.ts`

**Step 1: Create the route**

Direct port from soma. The full 143-line route as documented in the source reading above. Key change: remove edge runtime.

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { date, changedSlot, lockedSlots = [] } = await req.json();
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

  type AdjItem = { mealId: number; slot: string; idx: number; id: string; name: string; grams: number; calories: number; calPerGram: number; priority: number };

  const adjustable: AdjItem[] = [];
  for (const meal of mealRows) {
    const mealSlotOrder = SLOT_ORDER[meal.meal_slot as string] ?? 99;
    if (mealSlotOrder <= changedSlotOrder) continue;
    if (lockedSet.has(meal.meal_slot as string)) continue;
    const items = meal.items as Array<Record<string, unknown>>;
    if (!items) continue;
    items.forEach((item, idx) => {
      const ing = ingMap[item.ingredient_id as string];
      if (!ing || ing.priority >= 99) return;
      const grams = Number(item.grams) || 0;
      if (grams <= 10) return;
      adjustable.push({
        mealId: Number(meal.id), slot: meal.meal_slot as string, idx,
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
    await sql`UPDATE meal_log SET items = ${JSON.stringify(items)}::jsonb,
      calories = ${cal}, protein = ${p}, carbs = ${c}, fat = ${f}, fiber = ${fi}
      WHERE id = ${Number(mealId)}`;
  }

  return NextResponse.json({ changes });
}
```

**Step 2: Commit**

```bash
git add web/app/api/nutrition/rebalance/route.ts
git commit -m "feat: port rebalance API from soma (auto-shrink future meals)"
```

---

## Task 10: Port close-day API

The adaptive feedback loop (179 lines). Reconciles actual vs predicted.

**Files:**
- Create: `web/app/api/nutrition/close-day/route.ts`

**Step 1: Create the route**

Direct port from soma's 179-line close-day route. Includes: meal/drink sum, Garmin activity reconciliation, weight-based deficit recalculation, analytics_weight_trend update, nutrition_profile update.

The full route code is documented in the source reading. Copy it with:
- Remove `export const runtime = "edge"`
- Fix the typo at soma line 16: `const existing[0]` -> `if (existing[0]`
- All DB queries stay the same (same Neon database)

**Step 2: Commit**

```bash
git add web/app/api/nutrition/close-day/route.ts
git commit -m "feat: port close-day API from soma (actual vs predicted reconciliation)"
```

---

## Task 11: Port copy-day API

**Files:**
- Create: `web/app/api/nutrition/copy-day/route.ts`

**Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  const sql = getDb();
  const { from_date, to_date } = (await req.json()) as { from_date: string; to_date: string };

  if (!from_date || !to_date) {
    return NextResponse.json({ error: "from_date and to_date are required" }, { status: 400 });
  }

  await sql`INSERT INTO nutrition_day (date) VALUES (${to_date}) ON CONFLICT (date) DO NOTHING`;

  const sourceMeals = await sql`
    SELECT meal_slot, source, preset_meal_id, portion_multiplier, items, calories, protein, carbs, fat, fiber, notes
    FROM meal_log WHERE date = ${from_date} ORDER BY logged_at
  `;

  if (sourceMeals.length === 0) {
    return NextResponse.json({ copied: 0, message: "No meals found for source date" });
  }

  await sql`DELETE FROM meal_log WHERE date = ${to_date}`;

  let copied = 0;
  for (const m of sourceMeals) {
    await sql`
      INSERT INTO meal_log (date, meal_slot, source, preset_meal_id, portion_multiplier, items, calories, protein, carbs, fat, fiber, notes)
      VALUES (${to_date}, ${m.meal_slot}, ${m.source}, ${m.preset_meal_id}, ${m.portion_multiplier},
        ${m.items ? JSON.stringify(m.items) : null}, ${m.calories}, ${m.protein}, ${m.carbs}, ${m.fat}, ${m.fiber}, ${m.notes})
    `;
    copied++;
  }

  return NextResponse.json({ copied });
}
```

**Step 2: Commit**

```bash
git add web/app/api/nutrition/copy-day/route.ts
git commit -m "feat: port copy-day API from soma"
```

---

## Task 12: Build and verify all routes

**Step 1: Build**

```bash
cd /Users/gkos/Projects/macro-engine/web && npm run build 2>&1 | tail -20
```

Expected: All routes listed, build succeeds.

**Step 2: Test each route**

```bash
# skip-slot
curl -s -X POST http://localhost:3457/api/nutrition/skip-slot -H "Content-Type: application/json" -d '{"date":"2026-04-13","slot":"pre_sleep"}'

# activity-select
curl -s -X POST http://localhost:3457/api/nutrition/activity-select -H "Content-Type: application/json" -d '{"date":"2026-04-13","run_enabled":false,"selected_workouts":[]}'

# workout-calories
curl -s http://localhost:3457/api/nutrition/workout-calories

# log-drink (GET types)
curl -s http://localhost:3457/api/nutrition/log-drink | python3 -c "import sys,json; print(len(json.load(sys.stdin)['drinks']), 'drink types')"

# presets (GET)
curl -s http://localhost:3457/api/nutrition/presets | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d['presets']), 'presets,', len(d['ingredients']), 'ingredients')"
```

**Step 3: Push**

```bash
git push
```

---

## Verification Checklist

After all 12 tasks:

- [ ] `web/lib/portion-solver.ts` exists and compiles
- [ ] `web/lib/auto-categorize.ts` exists with heuristic + shrink priorities
- [ ] All 11 API routes exist and respond:
  - [ ] POST /api/nutrition/skip-slot
  - [ ] POST /api/nutrition/reopen-day
  - [ ] POST /api/nutrition/activity-select
  - [ ] GET /api/nutrition/workout-calories
  - [ ] GET/POST/DELETE /api/nutrition/log-drink
  - [ ] GET/POST/DELETE /api/nutrition/presets
  - [ ] POST /api/nutrition/rebalance
  - [ ] POST /api/nutrition/close-day
  - [ ] POST /api/nutrition/copy-day
- [ ] `npm run build` passes
- [ ] All routes return valid JSON responses

---

## What's Next

After Phase 3a, proceed to:
- **Phase 3b**: MealComposer component (inline composition, ingredient picker, presets, live preview)
- **Phase 3c**: Dashboard integration (activity selector, drink logger, date nav, trend table)

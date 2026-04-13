# Phase 3: Intelligence Layer -- Design Document

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Port soma's nutrition intelligence into MacroEngine -- inline meal composition with portion solver, rebalancing, day lifecycle, activity selection, drink logging, date navigation, and 7-day trend. Transform the dashboard from a read-only display into a full interactive nutrition workstation.

**Architecture:** All changes in the macro-engine `web/` directory. Port API routes from soma, adapt UI components. Keep the USDA search + My Ingredients hybrid. Portion solver runs client-side. Rebalancing runs server-side.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind 4, Neon Postgres, portion-solver.ts (ported from soma)

---

## Decisions Made

| Decision | Choice |
|----------|--------|
| Meal composition location | Inline on dashboard (cards expand) |
| Ingredient sources | USDA search + My Ingredients library (hybrid) |
| Auto-categorization | Heuristic from per-100g macros, override on save |
| Portion solver | Port from soma, works with USDA + saved ingredients |
| Rebalancing | Port from soma (auto-shrink, lock/flex, toast) |
| Day lifecycle | Port close/reopen/copy-yesterday with adaptive deficit |
| Activity selector | Port from soma (run toggle, step override, gym chips) |
| Drink logging | Port from soma (9 types, alcohol tracking, fat oxidation) |
| /log page | Repurpose as /foods (Food Library management) |
| Date navigation | Left/right arrows, URL param, browse history |

---

## Meal Composition Flow

### Collapsed Meal Card (current, no change)
- Slot header with color, name, total kcal + protein
- Per-ingredient rows: name, grams, calories, protein
- "remove meal" link per logged meal
- "+ Add food" button at bottom

### Expanded Meal Card (new)
Clicking "+" or card header expands inline. Three tabs:

**Tab 1: My Ingredients**
- User's saved library, grouped by category (protein/carbs/fat/vegetable/dairy/fruit/sauce/supplement)
- Multi-select checkboxes
- Each shows: name, per-100g macros, favorite star
- Fast path for daily logging

**Tab 2: Search**
- USDA full-text search (debounced, from existing /api/food/search)
- Results show: name, per-100g macros, auto-detected category badge
- Tap: add to current meal (one-time use)
- Star icon: save to My Ingredients (with category override option)

**Tab 3: Presets**
- Saved meal presets, filtered by slot tags
- Each shows: name, total macros, ingredient count
- Tap: load all ingredients with saved portions
- Portion multiplier slider (0.5x-2x)
- "Customize" opens ingredients in composition view

### Composition View (below tabs, after selecting ingredients)
- Each ingredient as a row: name, grams (NumberInput +/-), per-item macros (cal, P, C, F)
- Category-specific increments: protein 25g, carbs 10g, fat 5g, vegetable 25g, dairy 25g
- Raw/cooked toggle for applicable ingredients
- Count-based mode for eggs, gels

**Portion Solver** runs on initial ingredient selection and recalculates when ingredients are added/removed:
- Takes: selected ingredients + slot macro budget (from redistributeRemaining)
- Returns: optimal gram amounts per ingredient
- Algorithm (from soma's portion-solver.ts):
  1. Fixed portions for vegetables (120g), sauces (50g), supplements (30-35g)
  2. Scalable ingredients get calorie share proportional to macro role weight
  3. Scale down to fit tightest macro constraint
  4. Per-macro targeted reduction for protein/fat overshoot
  5. Iterative protein-vs-carb rebalancing
  6. Whole egg capping
  7. Final calorie check (rescale if >2% over)

Users can manually override any portion after solver runs.

**Live Macro Preview** above ingredient list:
- 4 horizontal progress bars (kcal, P, C, F) showing meal totals vs slot budget
- Goal markers on each bar
- Overflow turns amber
- Updates on every portion change

**Day-level preview**: dashboard macro rings + remaining line update in real-time via onTotalsPreview callback as user adjusts portions.

**Actions at bottom of composition view:**
- "Log Meal" button (primary)
- "Save as Preset" link (prompts for name, auto-generates from top 3 ingredients)
- "Cancel" (collapse card back)

---

## Auto-Categorization Heuristic

For USDA foods (per 100g):

| Condition | Category |
|-----------|----------|
| protein > 15g AND protein is dominant macro by calories | protein |
| carbs > 40g AND carbs is dominant macro | carbs |
| fat > 30g AND fat is dominant macro | fat |
| protein 8-15g AND fat > 15g | dairy |
| fiber > 3g AND calories < 50 | vegetable |
| sugar > 10g AND calories < 80 | fruit |
| none of the above | other |

"Dominant macro by calories" = that macro contributes the most calories (P*4, C*4, F*9).

Users override when saving to My Ingredients. Category determines:
- Solver scaling behavior (protein scales with protein target, etc.)
- Fixed vs scalable (vegetables/sauces/supplements are fixed)
- +/- increment step size
- Shrink priority in rebalancing (lower priority = shrink first)

---

## My Ingredients Library

Schema (extends existing `ingredients` table or new `user_ingredients` table):

```
id, name, category, calories_per_100g, protein_per_100g, carbs_per_100g,
fat_per_100g, fiber_per_100g, raw_to_cooked_ratio, is_count_based,
count_unit, count_grams, default_portion_g, usda_fdc_id, off_barcode,
use_count, is_favorite, shrink_priority, created_at
```

Starting data: migrate soma's 71 ingredients for existing users. New users start empty, build library by starring USDA search results or creating custom foods.

---

## Rebalancing Engine

Triggered after: meal logged, meal edited, meal deleted, slot skipped.

1. Calculate day remaining: target - sum(all eaten slots)
2. Identify future flex (unlocked, uneaten) slots with planned meals
3. For each flex slot, load ingredient items
4. Sort adjustable items by `shrink_priority` (carbs first, protein last, vegetables never)
5. Reduce grams proportionally, never below 20% of original
6. Update meal_log rows with recalculated per-item macros
7. Show toast: "Adjusted dinner: Rice 150g -> 120g, Chicken stays at 200g"

Lock/flex toggle: badge on each meal card header. Locked = excluded from rebalancing. Persisted per date in localStorage.

---

## Day Lifecycle

### Close Day
Button appears after pre-sleep time window. Triggers:
1. Sum actual consumed macros from meal_log + drink_log
2. Query Garmin for actual steps, run calories, gym calories for the date
3. Store reconciliation blob in nutrition_day.plan JSONB
4. Write actual_calories/protein/carbs/fat to nutrition_day
5. If weigh-in exists: recalculate deficit using constant-FFM model (fat_to_lose * 7700 / days_left), cap at current deficit
6. Update nutrition_profile with new weight, BF%, recalculated deficit
7. Set status = 'closed', disable all editing

### Reopen Day
Link next to "Closed" badge. Sets status back to 'active'. Re-enables editing.

### Copy Yesterday
Appears when today has zero meals. Duplicates all meal_log rows from previous day with today's date. Opens as editable so user can adjust.

### Date Navigation
Left/right arrow buttons in dashboard header. URL param `?date=YYYY-MM-DD`. Past closed days are read-only. Future days show empty state.

---

## Activity Selector

Compact strip on dashboard between macro rings and suggestion banner.

- **Run toggle**: ON/OFF for today's planned run. Shows distance + intensity from training_plan_day. TDEE recalculates on toggle.
- **Step override**: NumberInput, default from Garmin or step_goal. +/- in 250-step increments.
- **Gym workout chips**: horizontal scroll, from workout_enrichment (avg calories per routine from last 5 sessions). Tap to toggle. Multiple active.
- **During-workout slot**: auto-appears when run > 10km or > 60min. Auto-removes when run toggled off.
- **Actual vs predicted badges**: "predicted" (amber) before Garmin sync, "actual" (green) after.
- Disabled when day is closed.

---

## Drink Logging

Collapsible card below meal slots, above Energy Balance.

Collapsed: total drink calories + fat oxidation pause warning.
Expanded: drink type picker (9 types), quantity +/- counter, "Log Drink" button, logged drinks list with delete.

Drink types (from soma): light beer, lager, IPA, craft beer, red wine, white wine, spirit, margarita, old fashioned. Each with calories/carbs/alcohol per 100ml and default ml.

Alcohol offset: reduces macro targets (carbs first, then fat). Rings update immediately. Fat oxidation pause hours displayed as warning banner.

---

## /foods Page (formerly /log)

Repurposed as Food Library management:
- **Browse My Ingredients**: categorized list, edit/delete, adjust defaults
- **Search USDA**: full-text search, star to save, auto-categorize
- **Custom Foods**: create from scratch (name, macros, category, barcode)
- **Barcode Scanner**: camera overlay, Open Food Facts lookup, save to library
- **Favorites**: filtered view of starred ingredients

Not used for meal logging (that's inline on dashboard).

---

## 7-Day Trend Table

New section on dashboard below Energy Balance.

| Date | Ate | Burn | Deficit | Goal |
|------|-----|------|---------|------|
| Mon | 1,960 | 2,535 | -575 | -800 |
| Tue | 2,180 | 2,890 | -710 | -800 |
| ... | | | | |
| **Total** | **13,800** | **18,200** | **-4,400** | **-5,600** |

Color coding: green (beat goal), amber (within 100), red (missed by >100 or surplus).
Today shown as in-progress. Only closed days have actual data.

---

## New API Routes (11)

| Route | Method | Ported from |
|-------|--------|-------------|
| /api/nutrition/rebalance | POST | soma (143 lines) |
| /api/nutrition/close-day | POST | soma (179 lines) |
| /api/nutrition/reopen-day | POST | soma (9 lines) |
| /api/nutrition/skip-slot | POST | soma (53 lines) |
| /api/nutrition/activity-select | POST | soma (51 lines) |
| /api/nutrition/log-drink | GET/POST/DELETE | soma (181 lines) |
| /api/nutrition/presets | GET/POST/DELETE | soma (73 lines) |
| /api/nutrition/copy-day | POST | soma (67 lines) |
| /api/nutrition/onboard | GET/POST | soma (274 lines) |
| /api/nutrition/workout-calories | GET | soma (32 lines) |
| /api/nutrition/body-comp | GET | soma (327 lines) |

---

## New Components

| Component | Purpose |
|-----------|---------|
| MealComposer | Expanded card: ingredient picker tabs + composition view + solver + preview bars |
| IngredientPicker | My Ingredients (categorized) + USDA search + presets tabs |
| CompositionView | Per-ingredient rows with NumberInput, +/-, macros, raw/cooked |
| MacroPreviewBars | Horizontal progress bars for meal vs slot budget |
| PresetPicker | Saved meal cards with multiplier slider and customize button |
| ActivitySelector | Run toggle + step override + gym chips + during-workout slot |
| DrinkLogger | Drink type picker + quantity + logged list + alcohol warning |
| DateNavigator | Left/right arrows + date display + close/reopen/copy actions |
| TrendTable | 7-day ate/burn/deficit with color coding |
| SlotLockBadge | Fixed/flex toggle per meal card |

---

## Build Order

1. **Port portion-solver.ts** from soma (already exists, copy + adapt)
2. **Port API routes** (11 routes, adapt column names for shared DB)
3. **MealComposer component** (the big one: expand card, tabs, solver, preview)
4. **IngredientPicker** with My Ingredients + USDA search + auto-categorize
5. **PresetPicker** with multiplier and customize
6. **Rebalancing** integration (call after log, show toast)
7. **ActivitySelector** + workout-calories integration
8. **DrinkLogger** component + log-drink API
9. **DateNavigator** + close/reopen/copy-day
10. **TrendTable** (7-day display)
11. **Repurpose /log -> /foods** page
12. **Onboarding wizard** (5-step, Garmin + Hevy bootstrap)

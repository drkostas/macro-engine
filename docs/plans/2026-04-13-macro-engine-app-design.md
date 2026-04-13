# MacroEngine App -- Full Product Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** A nutrition tracking + meal planning web app that uses real Garmin data to auto-adjust targets, generates remaining-day meal plans, and replaces MyFitnessPal for intermediate fitness users.

**Architecture:** Next.js 16 on Vercel with PWA. TypeScript macro-engine shared library (extracted from soma's existing 523-line plan/route.ts). Neon Postgres for data + USDA food search. Vercel AI SDK + Claude for chat-based food logging. garmin-auth for Garmin SSO.

**Tech Stack:** Next.js 16, React 19, TypeScript, Neon Postgres, Serwist (PWA), Vercel AI SDK, garmin-auth, Cloudflare Worker (Garmin token exchange)

**Repo:** `drkostas/macro-engine` (private)

---

## Table of Contents

1. [Decisions](#decisions)
2. [Architecture](#architecture)
3. [Authentication](#authentication)
4. [Database Schema](#database-schema)
5. [Screen Designs](#screen-designs)
6. [Edge Cases & States](#edge-cases--states)
7. [Build Phases](#build-phases)

---

## Decisions

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| Platform | Web app (Next.js/Vercel) + PWA | Already have the stack from soma/hevy2garmin. PWA for install-to-home-screen + offline. |
| Target user | Intermediate fitness (know macros, used MFP) | Power the app with intelligence, not tutorials. |
| Food logging | Hybrid: search + AI chat, equal first-class | Search for precision, chat for speed. User picks preferred method. |
| Meal slots | Configurable with defaults (Breakfast/Lunch/Dinner/Pre-Sleep) | Matches daily_plan.py slot distribution. Supports IF, OMAD, 6-meal plans. |
| Food database | USDA FoodData Central + Open Food Facts (barcode API) + user custom foods | Open data, no API costs, no vendor lock-in. OFF for barcodes only. |
| Remaining macros | Full meal planning engine (generates complete remaining-day plan) | THE differentiator. Not just "X calories left" but "eat this specific meal." |
| Activity targets | Auto-calculated from Garmin data + pre-workout planning layer | Cascade: training plan -> morning prompt -> manual widget. Real data replaces estimate after Garmin sync. |
| Onboarding | Connect Garmin first, then fill gaps | Pull what Garmin knows (weight, height, age, sex, HR, VO2max), ask for the rest. |
| Auth | garmin-auth + shared secret cookie (hevy2garmin pattern) | Simple, proven, single-user. No OAuth complexity. |
| Backend | TypeScript only. Python repo = spec + tests. | plan/route.ts already reimplements the Python logic with more features. No Python deployment. |
| Food search | Neon Postgres with pg_trgm + tsvector | 300K USDA items, 60MB, <50ms search. Already in our stack. |
| AI chat | Vercel AI SDK + Claude (Haiku simple / Sonnet complex) | Context-inject current targets + remaining macros. Confirmation step before logging. |
| Offline | Online-first with offline caching. Meal logging queued to IndexedDB, synced on reconnect. Food search + AI chat online-only. | Serwist already configured. |
| Pricing (future) | Generous free tier (logging, barcode, custom goals) + Premium ~$60-72/yr | Undercut MFP. Free what they paywall. |

---

## Architecture

```
CLIENT (PWA)
  React 19 Components
  lib/macro-engine.ts (shared: TDEE, macros, slots, alcohol, sleep)
  lib/portion-solver.ts (constraint solver, client-side)
  IndexedDB (offline cache + mutation queue)
  Serwist SW (precache + push + background sync)
    |
    | HTTPS
    v
VERCEL (Next.js 16 App Router)
  API Route Handlers:
    /api/nutrition/plan         (Edge)  GET   dynamic macro calc
    /api/nutrition/log-meal     (Edge)  POST  write meal_log
    /api/nutrition/log-drink    (Edge)  POST  write drink_log
    /api/nutrition/close-day    (Edge)  POST  finalize day
    /api/nutrition/rebalance    (Edge)  POST  redistribute macros
    /api/nutrition/onboard      (Edge)  POST  profile setup
    /api/food/search            (Edge)  GET   Postgres FTS
    /api/food/barcode           (Edge)  GET   OFF API proxy
    /api/chat                   (Node)  POST  Vercel AI SDK + Claude
    /api/sync/quick             (Node)  POST  Garmin quick-sync
    /api/connections/garmin/ticket (Edge) POST store DI tokens
    /api/webhooks/sync-done     (Edge)  POST  revalidate cache
  Shared TypeScript Libs:
    lib/macro-engine.ts
    lib/portion-solver.ts
    lib/db.ts (Neon serverless driver)
    |
    | SQL over HTTPS
    v
NEON POSTGRES (Serverless)
  Nutrition Engine tables (existing from soma)
  usda_foods (300K items, pg_trgm + tsvector)
  user_foods (custom foods)
  chat_messages
  Garmin health tables (existing from soma)
    ^
    | SQL writes
    |
SYNC PIPELINE (GitHub Actions, cron every 6h)
  garmin-auth -> Garmin API -> health/activities/sleep/weight
  Training engine (Banister, readiness)
  POST /api/webhooks/sync-done -> revalidate cache

EXTERNAL APIs (on-demand):
  Claude API (via Vercel AI SDK) -- chat food parsing
  Open Food Facts API -- barcode lookup only
  Garmin SSO (via CF Worker) -- token exchange
```

### Caching Strategy

| Endpoint | Cache | Reason |
|----------|-------|--------|
| GET /api/nutrition/plan | s-maxage=30, SWR=60 | Garmin data updates throughout day |
| GET /api/food/search | s-maxage=3600, SWR=86400 | Food data rarely changes |
| Ingredients/presets | IndexedDB, invalidate on mutation | Offline access |
| Recent 200 foods | IndexedDB LRU cache | Fast re-logging |
| Current day plan | IndexedDB, 30s revalidation | Offline viewing |

### Real-Time Garmin Flow

1. Morning: plan route computes targets using expected steps + planned activity
2. During day: Garmin syncs actual steps -> daily_health_summary updates (every 6h via pipeline)
3. Next plan fetch: uses actual data, targets update automatically
4. After workout: actual EPOC/calories replace estimate
5. Dashboard: SWR polling at 60s during active hours. Manual "Refresh" button for immediate re-fetch.
6. Quick-sync endpoint: `/api/sync/quick` fetches just today's health summary directly from Garmin (bypassing full pipeline, <30s latency)

---

## Authentication

### Pattern: hevy2garmin shared-secret + garmin-auth SSO

**App Authentication:**
- Environment variable: `MACROENGINE_SECRET`
- On first visit: setup page collects secret, sets HTTP-only cookie `me_auth` (SameSite=strict, max-age=365 days)
- Middleware: all POST `/api/*` requests check cookie or `X-Api-Key` header against secret
- No secret configured (local dev): no auth enforced
- Cloud (Vercel): protected by secret, cookie set during setup

**Garmin Connection (browser-based SSO):**
1. Settings page embeds Garmin's SSO widget (same HTML as hevy2garmin setup.html)
2. User signs in via Garmin in their browser (residential IP, handles MFA natively)
3. Browser captures ticket URL (`ticket=ST-...`)
4. Frontend sends ticket to Cloudflare Worker (`macroengine-exchange-di.gkos.workers.dev`)
5. Worker exchanges ticket for DI OAuth tokens (di_token, di_refresh_token, di_client_id)
6. Tokens POSTed to `/api/connections/garmin/ticket`
7. Endpoint stores tokens in `platform_credentials` table via garmin-auth DBTokenStore format
8. garmin-auth handles automatic token refresh on subsequent API calls

**Why this pattern:**
- Proven in hevy2garmin (production, multiple users)
- No OAuth provider dependency (no GitHub/Google)
- garmin-auth handles token lifecycle (refresh, MFA, storage)
- CF Worker solves Garmin's cloud IP blocking for token exchange
- Single-user or small-group app, shared secret is sufficient

---

## Database Schema

### Existing Tables (from soma, no changes needed)

```
nutrition_profile    -- user settings, TDEE, deficit, body comp goals
nutrition_day        -- daily plans with all computed fields
meal_log             -- per-meal entries with macro totals
drink_log            -- alcohol tracking
ingredients          -- curated ingredient database (~50 items)
preset_meals         -- saved meal templates (~12 meals)
tdee_history         -- TDEE tracking over time
daily_health_summary -- Garmin health data (steps, HR, stress)
weight_log           -- weight entries from Garmin
sleep_detail         -- sleep data from Garmin
training_plan_day    -- training context for day type
workout_enrichment   -- gym calorie averages
platform_credentials -- Garmin/Hevy/etc tokens
```

### New Tables

```sql
-- USDA Food Database (Foundation + SR Legacy + Branded, ~300K items)
CREATE TABLE usda_foods (
    fdc_id              INTEGER PRIMARY KEY,
    description         TEXT NOT NULL,
    brand_owner         TEXT,
    data_type           VARCHAR(20),  -- 'foundation', 'sr_legacy', 'branded'
    calories            REAL,
    protein             REAL,
    carbs               REAL,
    fat                 REAL,
    fiber               REAL,
    sugar               REAL,
    sodium              REAL,
    serving_size_g      REAL,
    serving_description TEXT,
    barcode             VARCHAR(20),
    search_vector       TSVECTOR GENERATED ALWAYS AS (
        to_tsvector('english', description)
    ) STORED
);

CREATE INDEX idx_usda_search ON usda_foods USING GIN(search_vector);
CREATE INDEX idx_usda_trgm ON usda_foods USING GIN(description gin_trgm_ops);
CREATE INDEX idx_usda_barcode ON usda_foods(barcode) WHERE barcode IS NOT NULL;

-- User Custom Foods
CREATE TABLE user_foods (
    id                  SERIAL PRIMARY KEY,
    name                TEXT NOT NULL,
    brand               TEXT,
    calories            REAL NOT NULL,
    protein             REAL NOT NULL,
    carbs               REAL NOT NULL,
    fat                 REAL NOT NULL,
    fiber               REAL DEFAULT 0,
    serving_size_g      REAL DEFAULT 100,
    serving_description TEXT,
    barcode             VARCHAR(20),
    source              VARCHAR(20) DEFAULT 'manual',  -- 'manual', 'off', 'ai_parsed'
    source_id           VARCHAR(60),
    use_count           INTEGER DEFAULT 0,
    is_favorite         BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- AI Chat Messages
CREATE TABLE chat_messages (
    id              SERIAL PRIMARY KEY,
    date            DATE NOT NULL,
    role            VARCHAR(10) NOT NULL,  -- 'user', 'assistant'
    content         TEXT NOT NULL,
    parsed_items    JSONB,      -- structured food items if assistant parsed food
    meal_log_ids    INTEGER[],  -- linked meal_log entries after confirmation
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_chat_date ON chat_messages(date);

-- Weekly Meal Plans
CREATE TABLE weekly_plan (
    id              SERIAL PRIMARY KEY,
    week_start      DATE NOT NULL UNIQUE,  -- Monday
    day_plans       JSONB NOT NULL,        -- {mon: {breakfast: [...], ...}, ...}
    grocery_list    JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Meal Slot Configuration
CREATE TABLE meal_slot_config (
    id              SERIAL PRIMARY KEY,
    slot_name       VARCHAR(40) NOT NULL,
    sort_order      INTEGER NOT NULL,
    time_start      TIME,       -- e.g., '07:00'
    time_end        TIME,       -- e.g., '10:00'
    macro_pct       REAL,       -- fraction of daily target (0.28 = 28%)
    is_active       BOOLEAN DEFAULT TRUE
);

-- Insert defaults
INSERT INTO meal_slot_config (slot_name, sort_order, time_start, time_end, macro_pct) VALUES
('Breakfast',  1, '06:00', '10:00', 0.28),
('Lunch',      2, '11:00', '14:00', 0.25),
('Dinner',     3, '17:00', '21:00', 0.37),
('Pre-Sleep',  4, '21:00', '23:30', 0.10);
```

---

## Screen Designs

### Navigation

**Desktop:** Top nav bar -- MacroEngine logo | Home | Log | Plan | History | Profile | notification bell | avatar

**Mobile (390px):** Bottom nav bar -- Home | Log | Plan | History | Profile (icons + labels)

### Screen 1: Home (Dashboard)

The most information-dense screen. Shows today's nutrition state and the engine's recommendations.

**Sections (top to bottom):**

1. **Activity Banner** (conditional)
   - No workout yet: "Today: 5K Hard Run (from training plan)" + edit icon
   - After Garmin sync: "Completed: 5.2K Run, 342 kcal burned" in green
   - Rest day: "Rest Day" muted
   - No plan: "What's your workout today?" with quick presets

2. **Macro Rings Row**
   - 4 rings: Calories, Protein, Carbs, Fat
   - Each shows: current / target, colored progress arc
   - Targets are LIVE (update as Garmin data arrives)
   - Over-target: ring turns amber at 100%, red at 110%+
   - Below rings: "Remaining: 580 kcal | 62g P | 58g C | 18g F"

3. **Smart Suggestion Banner** (THE HERO FEATURE)
   - Prominent card, not a small banner
   - "Dinner suggestion: Salmon 180g + Sweet Potato 200g + Asparagus"
   - "Hits your targets within 3% | Tap to see full plan"
   - Only appears when unfilled meal slots remain
   - Tap opens Remaining Day Plan modal
   - Shows reasoning: "Salmon chosen because you need 42g protein and 65g carbs"

4. **Meal Slots**
   - Configurable cards (default 4, user can add/remove/rename in settings)
   - Logged slots: food items with per-item macros, slot total
   - Planned slots: dimmed, dashed border, engine's suggestion, "Tap to confirm"
   - Empty slots: "+" button + suggestion
   - Skipped slots: dimmed "Skipped" with "Log late?" link

5. **Two-Column Row**
   - Left: Weight Trend (14d default, 30/90/365d selector, goal trajectory line, projected BF% date)
   - Right: TDEE Live Breakdown (interactive, shows planned -> actual transition, explains training-day adjustments)

6. **Two-Column Row**
   - Left: Quick Restaurant (adapts to remaining macros, "Optimize for me")
   - Right: Chat Preview (last exchange, tap to expand)

7. **Alcohol Impact** (conditional, shown after logging drinks)
   - "2 beers logged: fat oxidation paused ~4h, fat budget reduced 15g, carb budget reduced 8g"
   - Shows adjusted remaining-day plan

8. **Status Bar**
   - Sync status, Garmin connection, date/time

**Mobile:** Stacks vertically. Activity banner -> rings (2x2) -> remaining line -> suggestion banner -> meal slots (vertical scroll) -> "Show more" for trend/TDEE/restaurant/chat.

### Screen 2: Log (Search + Chat Hybrid)

**Desktop layout:** Split view -- search (top/left) + chat (bottom/right), draggable divider.

**Mobile:** Tabbed -- "Search" | "Chat" tabs, swipeable.

**Active Meal Slot Selector** (sticky top bar): "Adding to: Lunch" dropdown. Auto-selects based on current time and slot config.

**Search Section:**
- Search bar + barcode scanner icon (camera)
- Horizontal pill filters: Recent | Favorites | Custom | All Foods
- Default view (before typing): last 10 logged foods, one-tap to re-log with same portion
- Results grouped: "Your Foods" | "USDA" | "Branded"
- Each result: food name, portion, calories, protein
- Tap -> Food Detail modal
- No results: "Can't find it? Create custom food" button
- Quick-add shortcut: "+ Quick Add" button -> just calories + protein + carbs + fat entry

**Chat Section:**
- Conversation thread with AI assistant
- Input: text field + mic (Web Speech API -> text -> same parser) + camera (Claude Vision) + barcode
- Parsing: "200g chicken breast and a cup of rice" -> shows card with parsed items
- Confirmation: "Confirm | Edit | Cancel" buttons before logging
- Multi-item: "had eggs, toast with butter, and OJ" parses all three
- Context-aware: system prompt includes current targets, remaining macros, ingredient DB, slot config

**After confirming:** Success toast with remaining macros update.

### Screen 3: Food Detail Modal

Opens from search result tap or existing logged item tap.

- Food name (large), source badge (USDA / OFF / Custom), star (favorite toggle)
- **Portion picker:** amount field + unit dropdown (g/oz/cup/tbsp/serving/piece) + slider (50-500g)
- "Last time: 200g" hint if previously logged
- **Live macro breakdown:** Calories (large), P/C/F colored bars, expandable "More" (fiber, sugar, sodium)
- **How this fits today:** "This puts you at 1,620 / 2,000 kcal" mini progress bar
- **Actions:** "Add to [Lunch]" (primary), "Edit" (if existing), "Delete" (red, confirm), "Swap" (suggest alternatives with similar macros)
- **Source attribution:** "Nutrition data from USDA FoodData Central" or "Open Food Facts, verified [date]"

### Screen 4: Meal Detail Modal

Opens from tapping a meal slot header on dashboard.

- Slot name + total macros + meal time
- List of food items with individual macros, edit/delete per item
- "Add more" button -> opens Log screen with this slot pre-selected
- "Copy meal" -> save as preset for re-use
- "Clear slot" -> removes all items, redistributes macros to remaining slots

### Screen 5: Plan (Weekly Meal Planner)

**Top section:**
- Week selector: arrows + "This Week"
- Weekly summary bar: "Avg: 1,980 kcal | 172g P | 195g C | 54g F -- 96% on target"
- Toggle: Plan View | Grocery List

**Plan View (desktop: 7-column grid, mobile: horizontal scroll):**
- Each column: day name, planned activity (from training plan), calorie target
- Rows per meal slot with planned meals + macros
- "Auto-fill" per slot, "Auto-fill day", "Auto-fill week" buttons
- Drag meals between days/slots
- Carb cycling visualization: target carbs vary by day type (color-coded)

**Grocery List view:**
- Auto-generated from week's plan
- Grouped: Protein | Produce | Grains | Dairy | Other
- Item: ingredient, total quantity (summed), checkbox
- Copy to clipboard / Share buttons

**Warnings:**
- "Thursday looks light on protein (140g vs 180g target)"
- "Repeat last week" button for consistent routines

### Screen 6: History (Calendar + Reports)

**Toggle:** Calendar | Reports

**Calendar View:**
- Monthly grid with colored dots per day:
  - Green: within 5% of all targets
  - Yellow: within 15%
  - Red: >15% off
  - Gray: no data
  - Half-filled: partially logged
- Tap day -> full dashboard for that day (read-only)
- Streak counter: "12-day logging streak"

**Reports View:**
- Range: This Week | 7d | 30d | 90d | Custom
- Macro adherence chart (line graph, daily vs target, toggle P/C/F)
- Weight vs calorie deficit correlation overlay
- Meal timing heatmap (when you eat, protein distribution grade)
- Top foods (most logged, frequency ranked)
- Weekly average card: "7-day avg: 1,960 kcal | 168g P" vs targets
- Export: "Download CSV" for selected range

### Screen 7: Profile (Settings + Account)

**Top:** Avatar, name, current stats ("82kg | Goal: 79kg | 2,000 kcal target")

**Sections:**

**Body & Goals:**
- Weight (Garmin sync + manual override), goal weight + target date
- Goal type (lose/maintain/gain), rate (0.25/0.5/0.75 kg/wk)
- Projected trajectory: "At current rate, hit 79kg by Aug 15. Safety: green."
- BF% estimate (NHANES model from onboarding data)

**Macro Targets:**
- Auto-calculated with formula visible: "TDEE 2,400 - deficit 400 = 2,000 kcal"
- P/C/F shown as grams + percentages
- Override toggle: auto -> manual
- Diet preset: Standard / High-protein / Keto / Low-fat / Custom
- Carb cycling toggle: rest-day vs training-day targets side by side

**Meal Slots:**
- Current slots: name, time window, macro % allocation
- Add/remove/rename/reorder
- Presets: Standard (4) | IF 16:8 (2) | OMAD (1) | 6 meals | Custom

**Connections:**
- Garmin: status, last sync, reconnect (browser SSO flow), disconnect
- Training plan: linked/unlinked, source
- Food databases: USDA status, last import date

**Preferences:**
- Units: metric / imperial
- Dietary restrictions: allergies/intolerances checklist
- Notifications: meal reminders per slot, weigh-in reminder, weekly report

**Data:**
- Export all (CSV)
- Import from MFP (future)
- Delete account

### Screen 8: Onboarding Wizard (5 steps, full-screen)

1. **Connect Garmin** -- big button, skip option. On connect: pull profile data via garmin-auth SSO flow
2. **Confirm Your Info** -- pre-filled from Garmin (age, sex, height, weight). Edit any. If no Garmin, all empty.
3. **What's Your Goal?** -- three cards: Lose Fat / Maintain / Build Muscle. Rate slider. Shows calculated deficit/surplus. BF% estimate via NHANES model.
4. **Diet Preference** -- Standard / High-Protein / Keto / Vegan / Custom. Brief description. Allergy checkboxes.
5. **Your Meal Schedule** -- default 4 slots, rename/add/remove. "Looks good!" -> dashboard.

### Screen 9: Activity Planner (bottom sheet mobile / popover desktop)

- Triggered from activity banner edit or morning prompt
- Quick presets: Rest Day / Light Cardio / Hard Cardio / Strength / Long Run
- Custom: activity type + duration + intensity
- Shows: "This adds ~350 kcal to your target"
- If training plan exists, pre-populated with today's planned workout
- After save: targets update, suggestion banner recalculates

### Screen 10: Remaining Day Plan (full-screen modal)

- Triggered from smart suggestion banner
- Each unfilled slot: recommended meal with ingredients, macros, prep time estimate
- Reasoning per meal: "Salmon chosen because you need 42g P and 65g C"
- Summary: "Following this plan: 1,985 / 2,000 kcal | 176/180g P | 198/200g C | 55/56g F"
- Per meal: Accept | Swap (get alternative) | Edit | Skip slot
- "Accept All" -> adds to today's plan
- Adapts after alcohol: "Adjusted for 2 beers: reduced fat, increased protein in dinner"

### Screen 11: Restaurant Browser (full-screen modal)

- Search bar + "Near me" toggle (geolocation on mobile)
- Restaurant cards: logo, name, cuisine
- Tap -> menu grouped by category
- Items that fit remaining macros highlighted green
- "Build your order" -> add items, running total
- "Optimize for me" -> engine picks best order for remaining macros
- "Log this order" -> adds to active slot

### Screen 12: Barcode Scanner (camera overlay)

- Camera viewfinder with scan region
- On scan: Open Food Facts API lookup
- Found: food name + nutrition -> Food Detail modal
- Not found: "Not in database. Add manually?" -> custom food form

### Screen 13: Chat Expanded (full-screen)

- Full conversation history (scrollable)
- Same input bar: text + mic + camera + barcode
- Contextual suggestions: "Try: 'I had my usual breakfast' or 'What should I eat for dinner?'"
- AI can answer nutrition questions too: "How much protein is in an egg?" without logging

### Screen 14: Weekly Report (modal / push notification, Sundays)

- Adherence score (%)
- Avg daily macros vs targets
- Weight change
- Best day / worst day
- Protein distribution grade (even across meals = A, all at dinner = D)
- Top logged foods
- Streak count
- "Adjust targets?" prompt if adherence low or weight stalled

### Screen 15: Weight Entry (bottom sheet)

- Manual weight input (fallback if no Garmin scale)
- Shows last 5 entries with dates
- "Usually synced from Garmin" note

### Screen 16: Recipe Builder (modal)

- Name the recipe
- Add ingredients from food search (USDA/custom)
- Set number of servings
- Auto-calculates per-serving macros
- Save as preset for one-tap re-logging

---

## Edge Cases & States

### Empty States
- **No meals logged:** Rings at 0%, suggestion banner prominent: "Start your day -- log breakfast or let me suggest one"
- **No plan:** "Auto-fill this week?" with sample day preview
- **<7 days data:** "Keep logging! Reports unlock after 7 days" with progress (3/7)
- **<3 weight points:** "Log a few more weigh-ins to see trends"
- **No Garmin:** All features work, just no auto-populated profile data or activity TDEE. Manual step count entry option.

### Over-Target States
- 100%: ring border amber
- 110%+: ring border red, value in red
- Suggestion changes: "You're 180 kcal over. Keep dinner light -- grilled chicken salad (320 kcal, 40g P) would minimize overshoot"
- Weekly report: "Over on Saturday (+300). Weekly average still within 3%."

### Skipped Meals
- Time window passes empty: slot dims, shows "Skipped" + "Log late?" link
- Remaining macros redistribute to unfilled slots automatically
- All slots empty: "Looks like you haven't logged today. Forgot, or fasting day?" with "Log now" | "Mark as fast day"

### Alcohol
- After logging drinks: show displacement card
- "2 beers: fat oxidation paused ~4h, fat budget -15g, carb budget -8g"
- Remaining day plan adjusts automatically
- This is a unique feature -- surface it prominently

### Connectivity
- Garmin disconnect: yellow banner "Garmin disconnected -- activity data may be stale. Reconnect"
- Offline (PWA): logging works (IndexedDB queue), "1 item pending sync" indicator. Food search unavailable. Chat unavailable.
- AI chat offline: "Assistant unavailable offline. Use search." (search falls back to cached recent/favorites)

### Errors
- Search no results: "No results. Try different name or create custom food"
- Barcode not found: "Not in database. Add manually?"
- AI misparse: confirmation step catches it. "Edit" button to correct.
- Garmin sync fails: "Sync failed. Using last known data. Retry?"

---

## Build Phases

### Phase 0: Foundation
- Fix carb periodization dead code in tdee.py (wire CARB_TARGETS_G_PER_KG into compute_macro_targets)
- Extract `lib/macro-engine.ts` from plan/route.ts (shared TDEE, macros, slots, alcohol, sleep)
- Refactor plan/route.ts sequential DB queries to parallel
- Set up standalone repo structure (Next.js app, separate from soma)
- Set up garmin-auth SSO flow + shared secret middleware (copy from hevy2garmin)
- Set up CF Worker for Garmin token exchange (macroengine-exchange-di)

### Phase 1: Food Database
- Download USDA FoodData Central (Foundation + SR Legacy + Branded)
- Import script: parse CSV -> insert into usda_foods table with tsvector
- Build `/api/food/search` with pg_trgm fuzzy + tsvector full-text
- Build `/api/food/barcode` proxy to Open Food Facts API
- Build user_foods table + CRUD endpoints
- Build food search UI component with debounced typeahead

### Phase 2: Core Loop
- Dashboard redesign (activity banner, hero suggestion, meal slots, macro rings)
- Log screen (search + quick-add from presets + manual entry)
- Food Detail modal (portion picker, live macro calc, "how this fits today")
- Meal Detail modal (edit/delete items, copy meal, clear slot)
- Active meal slot selector (auto-detect from time)
- Onboarding wizard (5 steps, Garmin SSO, BF% estimate)

### Phase 3: Intelligence
- Extend portion-solver to multi-slot remaining-day plan
- Wire carb periodization into slot targets (rest day vs training day)
- Activity planner (training plan cascade + morning prompt + manual)
- Smart suggestion banner on dashboard
- Remaining Day Plan modal (accept/swap/edit/skip)
- Alcohol displacement visualization

### Phase 4: Chat
- Vercel AI SDK + Claude integration
- System prompt with nutrition context injection
- Natural language food parsing with structured output
- Confirmation flow (confirm/edit/cancel)
- Photo logging (Claude Vision)
- Voice input (Web Speech API -> text -> same parser)
- Chat expanded full-screen view

### Phase 5: History + Profile
- Calendar view with adherence dots
- Day detail view (historical dashboard)
- Reports (adherence chart, weight correlation, timing heatmap, top foods)
- Weekly average card
- CSV export
- Profile / Settings (all sections)
- Weekly report generation (auto, Sundays)

### Phase 6: Plan Screen
- Weekly planner grid (7-day view)
- Auto-fill (per slot, per day, per week)
- Carb cycling visualization
- Grocery list generation + grouped view
- Drag/reorder meals
- "Repeat last week" + "Copy day"

### Phase 7: Restaurant
- Restaurant database (manual curation + user submissions)
- Menu browser with macro display
- "Optimize for me" algorithm (fit remaining macros from menu items)
- Order builder + logging flow
- Geolocation for "near me" (mobile)

### Phase 8: Polish
- Offline PWA mutation queue + background sync
- Recipe builder modal
- Empty states (all screens)
- Error states (all screens)
- Over-target animations
- Streak counting + milestones
- Barcode scanner (camera overlay)
- Weight entry fallback
- Notification settings (meal reminders, weigh-in, weekly report)

---

## Competitive Advantages (in priority order)

1. **Remaining-day meal generation** -- "You logged 2 meals, here's exactly what to eat next." No competitor does this well.
2. **Auto-adjusting TDEE from Garmin sensor data** -- MacroFactor adapts from weight trends only. We use actual HR, steps, EPOC.
3. **Training-aware carb cycling** -- targets shift based on actual training plan. Rest day vs tempo run vs heavy legs.
4. **Alcohol displacement math** -- unique. "2 beers = fat budget -15g, here's your adjusted dinner."
5. **Free barcode scanning + free custom macros** -- exploit MFP's paywall backlash.
6. **Restaurant optimization** -- "Optimize for me" adapts to remaining macros. Standalone apps exist but none integrated in a tracker.
7. **BF% trajectory with safety ratings** -- "Hit 12% BF by Aug 15, safety: green." More than just weight.
8. **Sleep-adjusted deficits** -- 4-tier system already built. Bad sleep = smaller deficit = less muscle loss risk.

---

## Marketing Hooks (for when we go public)

- "Your watch knows how many calories you burn. Your food app should too."
- "Stop counting. Start planning."
- "MFP tells you what you ate. MacroEngine tells you what to eat next."
- "Free barcode scanning. Free custom macros. No ads. Ever."

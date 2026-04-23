# Architecture

How the M1–M10 nutrition engine is wired end-to-end, from pure-logic Python through the Next.js UI. This document is the map that tells you which file to touch when you want to change something.

## Principle: Python canonical, TS mirror, thin API

Every piece of non-trivial logic exists twice:

- `src/macro_engine/<module>.py` — the canonical implementation. Pure Python, stdlib only where possible, fully unit-tested via `pytest`. No I/O, no database, no web framework concerns.
- `web/lib/<module>.ts` — a line-by-line TypeScript mirror. Same function signatures, same constants, same test cases in `web/tests/unit/lib/`. Vitest enforces parity.
- `web/app/api/nutrition/<route>/route.ts` — Next.js API route that reads DB, calls the TS mirror, and serializes JSON. The route should own DB shape translation; it should not own any math.
- `web/components/<card>.tsx` — a dashboard card that `fetch`es the route and renders. Forms submit back to the same route.

When adding a feature: write the Python first with a pytest, mirror it in TS with a matching vitest, then wire the route and card. Never let the two implementations drift — the tests are the contract.

## Module → Mirror → Route → Card table

| Milestone | Python (`src/macro_engine/`) | TS mirror (`web/lib/`) | API route (`web/app/api/nutrition/`) | UI surface (`web/components/`) |
|---|---|---|---|---|
| M1 safety rails | `tier.py`, `floor.py`, `fat_floor.py`, `protein_floor.py`, `rate_cap.py`, `deficit_duration.py` | `safety-rails.ts` | (folded into `plan/route.ts`) | tier/band pills in `band-pill.tsx`, `tier-pill.tsx` |
| M2 mode engine | `mode.py`, `mode_availability.py`, `mode_transitions.py` | `mode-engine.ts` | `mode/route.ts` | `deficit-mode-selector.tsx` |
| M3 body comp | `forbes.py`, `navy_tape.py`, `method_sigma.py`, `bmr.py`, `tdee.py` | `body-comp.ts` | `ffm-anchor/route.ts`, `weight-trend/route.ts` | `body-comp-entry.tsx`, `weight-chart.tsx` |
| M4 macro engine | `macro_targets.py`, `calculator.py`, `daily_plan.py`, `alcohol.py`, `creatine_water.py` | `macro-engine.ts`, `macro-targets.ts` | `plan/route.ts`, `log-meal`, `log-drink`, `presets` | `macro-ring.tsx`, `meal-slot-card.tsx`, `meal-composer.tsx` |
| M5 adaptive | `adaptive.py`, `weight_prediction.py` | `adaptive.ts` | (folded into `plan/route.ts`) | `adaptive-banner.tsx` |
| M6 refeed | `refeed.py` | `refeed.ts` | (folded into `plan/route.ts`) | `refeed-card.tsx` |
| M7 subjective | `subjective.py` | `subjective.ts` | `subjective/route.ts` | `wellness-card.tsx`, `wellness-banner.tsx` |
| M8 hydration | `hydration.py` | `hydration.ts` | `hydration/route.ts` | `hydration-card.tsx`, `hyponatremia-banner.tsx` |
| M9 injured | `injured.py` | `injured.ts` | `injury/route.ts` | `injury-card.tsx`, `phase-progress-bar.tsx`, `injury-module-checklist.tsx` |
| M9 taper | `taper.py` | `taper.ts` | `taper/route.ts` | `taper-card.tsx` |
| M9 climate | `climate.py` | `climate.ts` | `climate/route.ts` | `climate-card.tsx` |
| M10 weekly wrap-up | `weekly_wrapup.py` | `weekly-wrapup.ts` | `wrapup/route.ts` | `weekly-wrapup-card.tsx` |
| M10 progression | `progression.py` | `progression.ts` | `progression/route.ts` | `progression-card.tsx` |
| M10 year review | `year_review.py` | `year-review.ts` | `year-review/route.ts` | `year-review-card.tsx` |

## The plan endpoint as aggregator

`/api/nutrition/plan` is the single endpoint the dashboard hero depends on. It returns a snapshot of the user's daily state and bundles every cross-cutting context read under `context`:

```jsonc
{
  "date": "2026-04-23",
  "weightKg": 74.2,
  "tdee": { "bmr": ..., "stepCalories": ..., "runCalories": ..., "gymCalories": ..., "total": ..., "targetCalories": ... },
  "targets": { "calories": ..., "protein": ..., "carbs": ..., "fat": ..., "fiber": ... },
  "context": {
    "band": "rest",
    "tier": "T3",
    "mode": "standard",
    "adaptive": { "tdee": ..., "refeedPressureScore": ..., "dietBreakLevel": ..., "plateau": ... },
    "refeed": { "detected": ..., "suggestedTargets": ... },
    "hydration": { "water": ..., "sodium": ..., "hyponatremiaRisk": ... },
    "injury": { "active": true, "phase": "acute", "proteinGPerKg": ..., "eaFloorKcal": ..., "module": ... } | null,
    "taper": { "phase": "intensity_taper", "daysUntil": 5, "carbGPerKg": 7, "proteinGPerKg": 2.2 } | null,
    "climate": { "env": "altitude", "adjustment": { ... } } | null
  },
  "eaten": { ... },
  "remaining": { ... },
  "slotBudgets": [ ... ],
  "mealsBySlot": { ... },
  "trend": [ ... ]
}
```

Every `context.*` child is optional and can be `null`; UI surfaces check for presence before rendering. Adding a new context key: extend the interface in `dashboard-client.tsx`, add the computation in `plan/route.ts` (no separate route required for read-only state), and ship the card.

Feature-specific routes (`/injury`, `/taper`, `/climate`, etc.) exist because they accept `POST`/`PATCH` writes. Reads go through `/plan`.

## Dashboard hero composition

The hero lives in `web/app/dashboard/dashboard-client.tsx`. Order (top to bottom):

1. **Banners** — `WellnessBanner`, `HyponatremiaBanner` (conditional), `AdaptiveBanner` (conditional).
2. **Always-on cards** — `WellnessCard`, `RefeedCard` (conditional), `HydrationCard`.
3. **StatusRow** — compact pill bar for active Injury / Taper / Climate plus a ⚙ setup menu for inactive ones. Renders nothing when all three are inactive.
4. **Expanded detail** — when a StatusRow pill is tapped, the corresponding full card (`InjuryCard`, `TaperCard`, `ClimateCard`) renders here.
5. **TrackingTabs** — single container hosting `WeeklyWrapupCard` / `ProgressionCard` / `YearReviewCard` as tabs. Default Week.
6. **Hero metric** — big kcal number + remaining + percent complete + 5 `MacroRing`s.
7. **TDEE breakdown**, activity selector, drinks, meal slots, trend table, weekly summary.

This composition is deliberate: banners first (urgent), always-on cards second (daily checkpoints), StatusRow third (compact context), tracking fourth (retrospective), then the primary metric within the initial viewport on both desktop (1440×900) and mobile (390×844).

## Database shape

Primary tables (`web/db/schema.sql`):

- `nutrition_profile` (singleton, id=1) — baseline: weight, height, BF%, FFM, deficit mode, protein g/kg, step goal, creatine dose, plus mode/phase timestamps and M9/M10 columns: `race_date`, `climate_env`, `climate_sweat_l_per_hour`, `climate_hours`.
- `nutrition_day` (one row per date) — per-day state: target/actual kcal, target macros, TDEE used, deficit used, training day type, status (`active`/`closed`), expected steps, run/gym flags, skipped slots.
- `meal_log` (append-only per-meal) — JSONB `items` + totals per meal, `planned` flag distinguishes logged vs upcoming.
- `drink_log`, `hydration_log` — beverage / water tracking with alcohol + caffeine flags.
- `weight_log`, `daily_health_summary`, `garmin_activity_raw`, `workout_enrichment` — Garmin-sourced telemetry.
- `injury_log` — active injury history, one row per injury with `recovered_date IS NULL` marking the currently-active one.
- `subjective_log` — daily Hooper-style morning check-in (fatigue / sleep / stress / soreness).

## Testing contract

- **Python**: `pytest -q` at the repo root. Covers every `src/macro_engine/<module>.py`. ~680 tests.
- **TypeScript**: `npx vitest run` in `web/`. Covers `web/lib/*.test.ts` (mirror parity), `web/tests/unit/api/*.test.ts` (route shape), `web/tests/unit/components/*.test.tsx` (RTL). ~700 tests.
- **E2E**: `npx playwright test` in `web/`. One spec per API + integration specs in `web/tests/e2e/`.
- **Typecheck**: `npx tsc --noEmit` in `web/`. Must be clean on every PR.

The full loop for a new feature slice: red Python test → implement Python → red TS test → implement TS mirror → red API route test → implement route → red RTL test → implement card → e2e smoke → Playwright visual validation desktop + mobile → PR.

## Extraction candidates

Parts of this engine are candidates for standalone packages when their coupling to Soma's DB is unwound:

- `run-dj` (extracted to [drkostas/run-dj](https://github.com/drkostas/run-dj)) — HR → BPM + session shuffle. Pure-logic core extracted; the daemon stays in soma until decoupled.
- `banister` (soma#5) — fitness-fatigue trajectory model. Currently lives in `sync/src/banister.py`.
- Further macro-engine extraction (soma#6) — this repo itself will eventually ship as `pip install macro-engine` once the route layer is parameterized away from Neon-specific SQL.

## Glossary

- **Band** — 5-band classification of the day's training load (rest / light / moderate / hard / very-hard) derived from run+gym kcal normalized by weight.
- **Tier** — 5-tier body-composition classification (T1 lean, T5 high BF).
- **Mode** — the user's chosen energy-balance posture (`standard`, `aggressive`, `reverse`, `maintenance`, `bulk`, `injured`). Determines deficit size and macro distribution shape.
- **Adaptive TDEE** — rolling estimate of the user's real energy expenditure, drifting against tracked intake + weight over 14+ days.
- **EA (energy availability)** — calories available for non-training metabolism after subtracting exercise kcal. Hard floor guards against RED-S.
- **FFM** — fat-free mass in kg. Anchor for Cunningham BMR and injured-mode EA floor.
- **Forbes partitioning** — how a fixed energy deficit splits between fat and FFM at a given BF%.
- **Karvonen %HRR** — (HR – rest) / (max – rest). Used by run-dj for HR → BPM mapping.

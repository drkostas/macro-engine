# Changelog

## 0.5.2

- A README for the npm page, and an MIT LICENSE file in the package.
- Every module added in 0.4.0 and 0.5.0 is also exported on its own path (for example `macro-engine-core/meal-slots`), like the older ones.

## 0.5.1

- `Ingredient.unit` accepts `null`, which is what a database or an API sends for an ingredient measured in grams. The functions already treated it as grams.

## 0.5.0

- `meal-protein`: per-meal protein judged against body weight (0.4 g/kg is the synthesis floor, 0.55 g/kg is more than a meal needs), with fixed grams when no weight is known. `checkPerMealProtein` takes an optional weight and follows the same rule when it has one.
- `meal-slots`: `slotBudgetByShare` and `SLOT_KCAL_SHARES`, so a meal's budget uses the same shares as the plan (breakfast 28%, lunch 25%, dinner 37%, pre-sleep 10%) over the slots still ahead.

## 0.4.0

New modules, moved from the soma app where they were first written (macro-engine#274):

- `weigh-in`: a weigh-in more than 3 kg from the median of its neighbours within 14 days is discarded as a typo.
- `portion-bands`: small, usual and large portions per ingredient, with a per-category fallback (`bandFor` takes your own table).
- `meal-quantity`: turns stated grams, counts, portion words, shares and bites into grams, and fits only the amounts nobody stated.
- `meal-fast-path`: reads a simple meal sentence without a model.
- `meal-plausibility`: scales guessed amounts back to the person's own slot and day ceilings. Stated amounts are never changed.
- `energy-reconcile` and `observed-day`: intake on days that were not logged, solved from the weight change between weigh-ins.
- `coverage`, `deficit-window`, `adherence`, `trend-ate`: logging coverage, deficit windows, weekly adherence and the intake a day shows.
- `engagement`: whether a week of nutrition data is complete enough to trust.
- `adaptive-input`: the deficit phase length and the day points for `computeAdaptiveTdee`.
- `meal-slots`: the clock slot, empty slots, the next meal slot, remaining slots and the slot budget.

## 0.3.1

Vegetable kcal-mismatch fix in ingredient research.

## 0.3.0

Quick-add and ranking helpers for ingredients.

## 0.2.0

Ingredient research.

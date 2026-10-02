# Changelog

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

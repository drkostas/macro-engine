# macro-engine-core

The nutrition logic behind [soma](https://github.com/drkostas/soma) and the macro-engine app, as plain functions. It has no runtime dependencies, reads no database and makes no network calls, so any app can use it with its own data.

```sh
npm install macro-engine-core
```

## What is in it

| Area | Modules | What they do |
|---|---|---|
| Energy and targets | `macro-engine`, `macro-targets`, `day-close`, `exercise-calories` | TDEE from BMR, steps, runs and gym work, macro targets per day, and the split of a day's calories across meals |
| Adaptive TDEE | `adaptive`, `adaptive-input`, `energy-reconcile`, `observed-day` | The TDEE your weight change implies, diet-break advice, and intake on days you did not log, solved from the weight change between weigh-ins |
| Safety | `safety-rails`, `deficit`, `meal-protein` | Protein and fat floors, rate caps, BMR, a deficit from a body-fat goal, and per-meal protein judged by body weight |
| Body composition | `body-comp`, `weigh-in` | Forbes energy density, water and glycogen overlays, and discarding a weigh-in that is a typo |
| Meals | `portion-solver`, `portion-bands`, `meal-quantity`, `meal-fast-path`, `meal-plausibility`, `meal-slots` | Grams for a meal from stated amounts, portion words and counts, a check that guessed amounts stay within what a person eats, and which meal a piece of food belongs to |
| Logging quality | `coverage`, `engagement`, `deficit-window`, `adherence`, `trend-ate` | Whether enough days are logged to trust an inference, deficit windows and weekly adherence |
| Ingredients and drinks | `ingredient-research`, `drink-db`, `alcohol` | Ranking and estimating ingredients, a drink table, and the fat-oxidation pause after alcohol |
| Phases | `mode-engine`, `refeed`, `taper`, `injured`, `progression`, `milestones` | Diet modes, refeeds, race tapers, injury nutrition and progress windows |

Everything is exported from the package root. Each module is also available on its own path, for example `macro-engine-core/meal-slots`.

## Examples

Per-meal protein, judged against body weight (0.4 g/kg is the synthesis floor, 0.55 g/kg is more than a meal needs).

```ts
import { mealProteinLevel } from "macro-engine-core";

mealProteinLevel(30, 80); // "yellow", under the 32 g floor at 80 kg
mealProteinLevel(40, 80); // "green"
```

A meal's calorie budget, split by the plan's shares over the meals still ahead of it.

```ts
import { slotBudgetByShare } from "macro-engine-core";

slotBudgetByShare({ dayTarget: 2000, consumed: 1000, slot: "dinner" }); // 787
```

Discard a weigh-in that sits more than 3 kg from the median of its neighbours within 14 days.

```ts
import { flagOutliers } from "macro-engine-core";

const { kept, discarded } = flagOutliers([
  { date: "2026-04-28", weightKg: 74.4 },
  { date: "2026-04-30", weightKg: 73.3 },
  { date: "2026-05-01", weightKg: 74.1 },
  { date: "2026-05-02", weightKg: 37.2 }, // 73.2 typed as 37.2
  { date: "2026-05-04", weightKg: 74.1 },
  { date: "2026-05-05", weightKg: 73.7 },
]);
// discarded: the 37.2, with the median it was compared against
```

## Development

```sh
npm ci
npm test
npm run build
```

Changes are listed in [CHANGELOG.md](./CHANGELOG.md). MIT licensed.

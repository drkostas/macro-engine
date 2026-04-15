# Testing

Unit tests run via Vitest; end-to-end tests via Playwright.

## Commands

From `web/`:

| Command | What it does |
|---|---|
| `npm test` | Run all unit tests once |
| `npm run test:watch` | Vitest watch mode |
| `npm run test:ui` | Vitest browser UI |
| `npm run test:coverage` | Unit tests with coverage report (`coverage/`) |
| `npm run e2e` | Playwright e2e (desktop + mobile) |
| `npm run e2e:desktop` | Desktop project only |
| `npm run e2e:mobile` | Mobile (iPhone 14 profile) only |
| `npm run e2e:ui` | Playwright UI mode for debugging |
| `npx playwright test --update-snapshots` | Refresh visual-regression baselines |

## Layout

```
tests/
├── unit/          # Vitest — lib, components, API route handlers (mocked DB)
│   ├── lib/
│   ├── api/
│   └── components/
├── e2e/           # Playwright — full browser flows against live dev server
├── db/            # Test-DB helpers (setup, reset, seed)
└── README.md
```

## Test database

End-to-end or integration tests that exercise real Postgres need a separate DB.
Create a Neon branch and add the connection string to `.env.local`:

```
DATABASE_URL_TEST=postgresql://.../neondb?sslmode=require
```

Helpers in `tests/db/`:

- `getTestDb()` — accesses the test branch; throws if `DATABASE_URL_TEST` is unset
- `ensureSchema()` — asserts the branch has the expected tables
- `resetTestDb()` — truncates transactional data (meal_log, drink_log, nutrition_day, weight_log, analytics_weight_trend)
- `seedProfile(overrides?)` — upserts the baseline `nutrition_profile` row

## Writing tests

### Unit (`tests/unit/**/*.test.ts`)

```typescript
import { describe, it, expect } from "vitest";
import { computeMacroTargets } from "@/lib/macro-engine";

describe("computeMacroTargets", () => {
  it("produces protein = 2.2 * kg", () => {
    expect(computeMacroTargets({ targetCalories: 2000, weightKg: 80 }).protein).toBe(176);
  });
});
```

### API route (`tests/unit/api/*.test.ts`)

Mock `@/lib/db` with a tagged-template handler that returns canned rows per query pattern.
Import the route's `GET`/`POST` directly and invoke with a `NextRequest`.

### E2E (`tests/e2e/*.spec.ts`)

```typescript
import { test, expect } from "@playwright/test";
test("logs a meal", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByText("Breakfast")).toBeVisible();
});
```

### Visual regression

Tests tagged with `@visual` compare screenshots against baselines in
`tests/e2e/<spec>-snapshots/`. Update baselines after intentional UI changes:

```bash
npx playwright test --update-snapshots visual
```

## CI

`.github/workflows/test.yml` runs `unit` and `e2e` jobs on push to `main` and on
every pull request. Failed Playwright runs upload their HTML report as an
artifact for debugging.

## Pre-commit hook

`.husky/pre-commit` runs Vitest (not e2e) when any `web/` file is staged. To
skip in an emergency: `git commit --no-verify` — but don't make a habit of it.

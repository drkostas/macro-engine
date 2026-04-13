# Phase 0: Foundation — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the carb periodization dead code, set up the Next.js web app skeleton with auth (garmin-auth + shared secret cookie pattern from hevy2garmin), database connection, and extract the TypeScript macro-engine shared library.

**Architecture:** Next.js 16 app in the existing `macro-engine` repo alongside the Python library. Auth via `MACROENGINE_SECRET` env var + HTTP-only cookie (same pattern as hevy2garmin). Garmin SSO via CF Worker token exchange. Pure TypeScript `lib/macro-engine.ts` for all nutrition math (extracted from soma's plan/route.ts).

**Tech Stack:** Next.js 16, React 19, TypeScript, Neon Postgres (@neondatabase/serverless), Tailwind 4, garmin-auth (Python, for sync pipeline), Cloudflare Workers (Garmin token exchange)

---

## Task 1: Fix Carb Periodization Dead Code (Python)

`CARB_TARGETS_G_PER_KG` is defined at `src/macro_engine/tdee.py:39-46` but never used. `compute_macro_targets()` at line 366 computes carbs as a strict remainder. The `training_day_type` parameter is accepted but ignored.

**Files:**
- Modify: `src/macro_engine/tdee.py:319-378`
- Test: `tests/test_tdee.py`

**Step 1: Write failing tests for carb periodization**

Add to `tests/test_tdee.py`:

```python
class TestCarbPeriodization:
    """Carb periodization: training_day_type should drive carb targets."""

    def test_rest_day_lower_carbs(self):
        """Rest day (3.0 g/kg) should have fewer carbs than hard_run (4.25 g/kg)."""
        rest = compute_macro_targets(
            tdee=2400, deficit=400, weight_kg=80,
            training_day_type="rest", carb_periodization=True,
        )
        hard = compute_macro_targets(
            tdee=2400, deficit=400, weight_kg=80,
            training_day_type="hard_run", carb_periodization=True,
        )
        assert rest["carbs"] < hard["carbs"]

    def test_rest_day_carbs_match_target(self):
        """Rest day carbs should be close to 3.0 * 80 = 240g."""
        result = compute_macro_targets(
            tdee=2400, deficit=400, weight_kg=80,
            training_day_type="rest", carb_periodization=True,
        )
        # 3.0 g/kg * 80 kg = 240g target
        assert abs(result["carbs"] - 240) <= 5

    def test_hard_run_carbs_match_target(self):
        """Hard run carbs should be close to 4.25 * 80 = 340g."""
        result = compute_macro_targets(
            tdee=2800, deficit=200, weight_kg=80,
            training_day_type="hard_run", carb_periodization=True,
        )
        # 4.25 g/kg * 80 kg = 340g target
        assert abs(result["carbs"] - 340) <= 5

    def test_fat_floor_prevents_negative(self):
        """If carb target is so high fat would go negative, apply fat floor."""
        result = compute_macro_targets(
            tdee=1800, deficit=400, weight_kg=80,
            training_day_type="long_run", carb_periodization=True,
        )
        # Fat should never go below 0.6 g/kg = 48g
        assert result["fat"] >= 48

    def test_periodization_off_by_default(self):
        """Without carb_periodization=True, carbs are still the remainder."""
        with_flag = compute_macro_targets(
            tdee=2400, deficit=400, weight_kg=80,
            training_day_type="rest", carb_periodization=True,
        )
        without_flag = compute_macro_targets(
            tdee=2400, deficit=400, weight_kg=80,
            training_day_type="rest", carb_periodization=False,
        )
        # Without flag, carbs are a remainder (different from 240g target)
        assert with_flag["carbs"] != without_flag["carbs"]

    def test_unknown_day_type_falls_back(self):
        """Unknown training_day_type falls back to remainder calculation."""
        result = compute_macro_targets(
            tdee=2400, deficit=400, weight_kg=80,
            training_day_type="unknown_type", carb_periodization=True,
        )
        fallback = compute_macro_targets(
            tdee=2400, deficit=400, weight_kg=80,
            training_day_type="rest", carb_periodization=False,
        )
        assert result["carbs"] == fallback["carbs"]

    def test_calories_still_balance(self):
        """Total calories from P+C+F should match target within 10 kcal."""
        result = compute_macro_targets(
            tdee=2400, deficit=400, weight_kg=80,
            training_day_type="hard_run", carb_periodization=True,
        )
        total = result["protein"] * 4 + result["carbs"] * 4 + result["fat"] * 9
        assert abs(total - 2000) <= 10
```

**Step 2: Run tests to verify they fail**

Run: `cd /Users/gkos/Projects/macro-engine && python -m pytest tests/test_tdee.py::TestCarbPeriodization -v`
Expected: FAIL (TypeError: unexpected keyword argument 'carb_periodization')

**Step 3: Implement carb periodization**

Modify `src/macro_engine/tdee.py`, function `compute_macro_targets` (lines 319-378).

Add `carb_periodization: bool = False` parameter. Logic:

```python
def compute_macro_targets(
    tdee: float,
    deficit: float,
    weight_kg: float,
    exercise_calories: float = 0,
    training_day_type: str = "rest",
    protein_g_per_kg: float = 2.2,
    fat_g_per_kg: float = 0.8,
    estimated_bf_pct: float | None = None,
    ffm_kg: float | None = None,
    carb_periodization: bool = False,
) -> dict[str, int]:
```

Replace the carb/fat calculation block (around lines 355-367) with:

```python
    # 5. Fat and carbs
    FAT_FLOOR_G_PER_KG = 0.6  # Minimum fat for hormonal health

    if carb_periodization and training_day_type in CARB_TARGETS_G_PER_KG:
        # Carb periodization: carbs set by training day type, fat is remainder
        carb_target = CARB_TARGETS_G_PER_KG[training_day_type] * weight_kg
        fat_remainder = (target_calories - (protein * 4) - (carb_target * 4)) / 9

        if fat_remainder >= FAT_FLOOR_G_PER_KG * weight_kg:
            # Fat is adequate, use periodized carbs
            fat = round(fat_remainder)
            carbs = round(carb_target)
        else:
            # Fat too low: apply floor, recalculate carbs as remainder
            fat = round(FAT_FLOOR_G_PER_KG * weight_kg)
            carb_remainder = max((target_calories - (protein * 4) - (fat * 9)) / 4, 0)
            carbs = round(carb_remainder)
    else:
        # Default: fat from g/kg, carbs as strict remainder
        fat = round(fat_g_per_kg * weight_kg)
        carb_remainder = max((target_calories - (protein * 4) - (fat * 9)) / 4, 0)
        carbs = round(carb_remainder)
```

**Step 4: Run tests to verify they pass**

Run: `cd /Users/gkos/Projects/macro-engine && python -m pytest tests/test_tdee.py -v`
Expected: ALL PASS (existing 16 + new 7 = 23 tests)

**Step 5: Export CARB_TARGETS_G_PER_KG in __init__.py**

Add to `src/macro_engine/__init__.py`:

```python
from macro_engine.tdee import (
    CARB_TARGETS_G_PER_KG,
    # ... existing imports ...
)
```

**Step 6: Commit**

```bash
cd /Users/gkos/Projects/macro-engine
git add src/macro_engine/tdee.py src/macro_engine/__init__.py tests/test_tdee.py
git commit -m "feat: wire carb periodization into compute_macro_targets

CARB_TARGETS_G_PER_KG was defined but never used. Now when
carb_periodization=True, carbs are set by training_day_type
(rest=3.0, easy_run=3.5, hard_run=4.25, long_run=4.75 g/kg).
Fat becomes the remainder with a 0.6g/kg floor for hormonal health.
Default behavior (carb_periodization=False) unchanged."
```

---

## Task 2: Initialize Next.js App in macro-engine Repo

The macro-engine repo currently has only the Python library at `src/macro_engine/`. We add a `web/` directory for the Next.js app.

**Files:**
- Create: `web/package.json`
- Create: `web/next.config.ts`
- Create: `web/tsconfig.json`
- Create: `web/tailwind.config.ts`
- Create: `web/app/layout.tsx`
- Create: `web/app/page.tsx`
- Create: `web/app/globals.css`

**Step 1: Create package.json**

```bash
mkdir -p /Users/gkos/Projects/macro-engine/web
```

Create `web/package.json`:

```json
{
  "name": "macro-engine-web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3457",
    "build": "next build",
    "start": "next start --port 3457",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^16.1.0",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "@neondatabase/serverless": "^0.10.0"
  },
  "devDependencies": {
    "typescript": "^5.8.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/postcss": "^4.0.0"
  }
}
```

**Step 2: Create next.config.ts**

Create `web/next.config.ts`:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow Neon serverless driver in Edge runtime
  serverExternalPackages: [],
};

export default nextConfig;
```

**Step 3: Create tsconfig.json**

Create `web/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

**Step 4: Create app skeleton**

Create `web/app/globals.css`:

```css
@import "tailwindcss";
```

Create `web/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MacroEngine",
  description: "Smart nutrition tracking with real Garmin data",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}
```

Create `web/app/page.tsx`:

```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/dashboard");
}
```

Create `web/app/dashboard/page.tsx`:

```tsx
export default function Dashboard() {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold">MacroEngine</h1>
      <p className="text-slate-400 mt-2">Dashboard coming soon.</p>
    </main>
  );
}
```

**Step 5: Install dependencies and verify**

```bash
cd /Users/gkos/Projects/macro-engine/web && npm install
```

Run: `cd /Users/gkos/Projects/macro-engine/web && npm run build`
Expected: Build succeeds

**Step 6: Commit**

```bash
cd /Users/gkos/Projects/macro-engine
git add web/
git commit -m "feat: initialize Next.js 16 web app skeleton

Adds web/ directory with Next.js 16, React 19, TypeScript,
Tailwind 4. Port 3457 to avoid conflicts with soma (3456)
and hevy2garmin (8123). Dark theme base layout."
```

---

## Task 3: Database Connection

**Files:**
- Create: `web/lib/db.ts`
- Create: `web/.env.local` (gitignored)

**Step 1: Create db.ts**

Create `web/lib/db.ts`:

```typescript
import { neon } from "@neondatabase/serverless";

export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL not set");
  }
  return neon(url);
}
```

**Step 2: Create .env.local with DATABASE_URL**

Create `web/.env.local` (this file is gitignored by Next.js automatically):

```
DATABASE_URL=postgresql://...your-neon-connection-string...
MACROENGINE_SECRET=dev-secret-change-me
```

**Step 3: Create .env.example**

Create `web/.env.example`:

```
DATABASE_URL=postgresql://user:pass@host/dbname?sslmode=require
MACROENGINE_SECRET=
```

**Step 4: Verify .gitignore**

Create `web/.gitignore`:

```
node_modules/
.next/
.env.local
.env*.local
```

**Step 5: Commit**

```bash
cd /Users/gkos/Projects/macro-engine
git add web/lib/db.ts web/.env.example web/.gitignore
git commit -m "feat: add Neon Postgres connection helper"
```

---

## Task 4: Auth Middleware (Shared Secret Cookie)

Replicates hevy2garmin's pattern: `MACROENGINE_SECRET` env var, `me_auth` HTTP-only cookie, middleware checks POST `/api/*`.

**Files:**
- Create: `web/middleware.ts`

**Step 1: Create middleware**

Create `web/middleware.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const secret = process.env.MACROENGINE_SECRET;
  const path = request.nextUrl.pathname;

  // No secret configured (local dev): allow everything
  if (!secret) {
    return NextResponse.next();
  }

  // POST /api/* (except webhooks and cron): require auth
  if (
    request.method === "POST" &&
    path.startsWith("/api/") &&
    !path.startsWith("/api/webhooks/") &&
    !path.startsWith("/api/cron/")
  ) {
    const token =
      request.cookies.get("me_auth")?.value ||
      request.headers.get("x-api-key");
    if (token !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Auto-set auth cookie on GET if not present
  if (request.method === "GET" && !request.cookies.get("me_auth")) {
    const response = NextResponse.next();
    response.cookies.set("me_auth", secret, {
      httpOnly: true,
      sameSite: "strict",
      maxAge: 365 * 86400,
      path: "/",
    });
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except static files and _next
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
```

**Step 2: Verify build**

Run: `cd /Users/gkos/Projects/macro-engine/web && npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
cd /Users/gkos/Projects/macro-engine
git add web/middleware.ts
git commit -m "feat: add auth middleware (shared secret cookie)

Same pattern as hevy2garmin: MACROENGINE_SECRET env var,
me_auth HTTP-only cookie (SameSite=strict, 1yr max-age).
POST /api/* requires valid cookie or X-Api-Key header.
No secret = no auth (local dev mode)."
```

---

## Task 5: Garmin SSO Ticket Storage Endpoint

Replicates hevy2garmin's `/api/garmin-ticket` endpoint for Next.js.

**Files:**
- Create: `web/app/api/connections/garmin/ticket/route.ts`

**Step 1: Create the endpoint**

Create `web/app/api/connections/garmin/ticket/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const tokens = body?.tokens;

  if (
    !tokens ||
    typeof tokens !== "object" ||
    !tokens.di_token ||
    !tokens.di_refresh_token ||
    !tokens.di_client_id
  ) {
    return NextResponse.json(
      { error: "Invalid tokens: expected di_token, di_refresh_token, di_client_id" },
      { status: 400 }
    );
  }

  const payload = {
    di_token: tokens.di_token,
    di_refresh_token: tokens.di_refresh_token,
    di_client_id: tokens.di_client_id,
  };

  try {
    const sql = getDb();

    // Store in platform_credentials (garmin-auth >= 0.3.0 format)
    await sql`
      INSERT INTO platform_credentials (platform, auth_type, credentials, status, connected_at)
      VALUES (
        'garmin',
        'oauth_di',
        jsonb_build_object('garmin_tokens', ${JSON.stringify(payload)}::jsonb),
        'active',
        NOW()
      )
      ON CONFLICT (platform)
      DO UPDATE SET
        credentials = jsonb_build_object('garmin_tokens', ${JSON.stringify(payload)}::jsonb),
        status = 'active',
        connected_at = NOW()
    `;

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg.slice(0, 200) }, { status: 500 });
  }
}
```

**Step 2: Verify build**

Run: `cd /Users/gkos/Projects/macro-engine/web && npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
cd /Users/gkos/Projects/macro-engine
git add web/app/api/connections/garmin/ticket/route.ts
git commit -m "feat: add Garmin DI token storage endpoint

POST /api/connections/garmin/ticket accepts DI OAuth tokens
from CF Worker exchange, stores in platform_credentials table
using garmin-auth >= 0.3.0 format."
```

---

## Task 6: Setup Page with Garmin SSO

Replicates hevy2garmin's setup.html Garmin SSO widget flow for Next.js.

**Files:**
- Create: `web/app/setup/page.tsx`

**Step 1: Create setup page**

Create `web/app/setup/page.tsx`:

```tsx
"use client";

import { useState } from "react";

const GARMIN_SSO_URL =
  "https://sso.garmin.com/sso/signin?id=gauth-widget&embedWidget=true&gauthHost=https%3A%2F%2Fsso.garmin.com%2Fsso&service=https%3A%2F%2Fsso.garmin.com%2Fsso%2Fembed&source=https%3A%2F%2Fsso.garmin.com%2Fsso%2Fembed&redirectAfterAccountLoginUrl=https%3A%2F%2Fsso.garmin.com%2Fsso%2Fembed&redirectAfterAccountCreationUrl=https%3A%2F%2Fsso.garmin.com%2Fsso%2Fembed";

// TODO: Deploy macroengine-exchange-di CF Worker, update this URL
const GARMIN_WORKER_BASE = "https://hevy2garmin-exchange-di.gkos.workers.dev";

export default function SetupPage() {
  const [ticketUrl, setTicketUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function exchangeTicket() {
    const raw = ticketUrl.trim();
    if (!raw) {
      setStatus("error");
      setMessage("Paste the URL first.");
      return;
    }

    // Extract ticket from URL or raw string
    let ticket = "";
    const match = raw.match(/ticket=([^&\s]+)/);
    if (match) {
      ticket = match[1];
    } else if (raw.startsWith("ST-")) {
      ticket = raw;
    } else {
      setStatus("error");
      setMessage("No ticket found. Make sure you copied the full URL after signing in.");
      return;
    }

    setStatus("loading");
    setMessage("Connecting to Garmin...");

    try {
      // Step 1: Exchange ticket via CF Worker
      const exchResp = await fetch(`${GARMIN_WORKER_BASE}/exchange`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket }),
      });
      const exchData = await exchResp.json();

      if (exchData.error) {
        setStatus("error");
        setMessage(exchData.error);
        return;
      }
      if (!exchData.di_token || !exchData.di_refresh_token || !exchData.di_client_id) {
        setStatus("error");
        setMessage("Worker returned unexpected response.");
        return;
      }

      // Step 2: Store tokens on our server
      const storeResp = await fetch("/api/connections/garmin/ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokens: {
            di_token: exchData.di_token,
            di_refresh_token: exchData.di_refresh_token,
            di_client_id: exchData.di_client_id,
          },
        }),
      });
      const storeData = await storeResp.json();

      if (storeData.ok) {
        setStatus("success");
        setMessage("Connected to Garmin!");
        setTimeout(() => (window.location.href = "/dashboard"), 3000);
      } else {
        setStatus("error");
        setMessage(storeData.error || "Failed to save tokens.");
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Try again.");
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-lg w-full space-y-8">
        <div>
          <h1 className="text-3xl font-bold">MacroEngine Setup</h1>
          <p className="text-slate-400 mt-2">Connect your Garmin account to get started.</p>
        </div>

        <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 space-y-4">
          <h2 className="text-lg font-semibold">Step 1: Sign into Garmin</h2>
          <p className="text-sm text-slate-400">
            Click the button below, sign in, then copy the URL from the page you land on.
          </p>
          <a
            href={GARMIN_SSO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-500"
          >
            Sign into Garmin
          </a>
        </div>

        <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 space-y-4">
          <h2 className="text-lg font-semibold">Step 2: Paste the URL</h2>
          <p className="text-sm text-slate-400">
            After signing in, copy the URL from your browser (it contains a ticket=ST-... parameter).
          </p>
          <input
            type="text"
            value={ticketUrl}
            onChange={(e) => setTicketUrl(e.target.value)}
            placeholder="https://sso.garmin.com/sso/embed?ticket=ST-..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm"
          />
          <button
            onClick={exchangeTicket}
            disabled={status === "loading"}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-500 disabled:opacity-50"
          >
            {status === "loading" ? "Connecting..." : "Connect Garmin"}
          </button>

          {message && (
            <p
              className={`text-sm ${
                status === "success"
                  ? "text-green-400"
                  : status === "error"
                  ? "text-red-400"
                  : "text-slate-400"
              }`}
            >
              {message}
            </p>
          )}
        </div>

        <div className="text-center">
          <a href="/dashboard" className="text-sm text-slate-500 hover:text-slate-300">
            Skip for now (no Garmin data)
          </a>
        </div>
      </div>
    </main>
  );
}
```

**Step 2: Verify build**

Run: `cd /Users/gkos/Projects/macro-engine/web && npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
cd /Users/gkos/Projects/macro-engine
git add web/app/setup/
git commit -m "feat: add setup page with Garmin SSO flow

Browser-based Garmin sign-in, ticket capture, CF Worker
exchange, token storage. Same flow as hevy2garmin."
```

---

## Task 7: Extract lib/macro-engine.ts

Extract pure computation functions from soma's `plan/route.ts` (523 lines) into a shared library. No DB calls, no Next.js dependencies. Pure functions only.

**Files:**
- Create: `web/lib/macro-engine.ts`

**Step 1: Create the shared library**

Create `web/lib/macro-engine.ts`:

```typescript
/**
 * MacroEngine - Pure computation functions for nutrition math.
 *
 * Extracted from soma web/app/api/nutrition/plan/route.ts.
 * No DB calls, no framework dependencies. Pure TypeScript.
 * Canonical spec: Python macro_engine library (../src/macro_engine/).
 */

// ── Constants ──────────────────────────────────────────────

export const SLOT_DISTRIBUTION: Record<string, number> = {
  breakfast: 0.28,
  lunch: 0.25,
  dinner: 0.37,
  pre_sleep: 0.10,
};

export const DEFAULT_SLOTS = ["breakfast", "lunch", "dinner", "pre_sleep"];

/** Carb targets per kg by training day type (g/kg). */
export const CARB_TARGETS_G_PER_KG: Record<string, number> = {
  rest: 3.0,
  easy_run: 3.5,
  hard_run: 4.25,
  long_run: 4.75,
  gym: 3.5,
  gym_and_run: 4.0,
};

const MIN_NEAT_STEPS = 3000;

// ── Types ──────────────────────────────────────────────────

export interface MacroTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface SlotBudget extends MacroTargets {
  slot: string;
}

export interface TdeeComponents {
  bmr: number;
  stepCalories: number;
  runCalories: number;
  gymCalories: number;
  deficit: number;
  total: number;
  targetCalories: number;
}

// ── TDEE ───────────────────────────────────────────────────

/** Compute step calories from step count and body weight. */
export function computeStepCalories(
  steps: number,
  weightKg: number,
  runSteps: number = 0,
): number {
  // Deduct running steps to avoid double-counting
  const neatSteps = Math.max(steps - runSteps, MIN_NEAT_STEPS);
  return Math.round(neatSteps * 0.000423 * weightKg * 100) / 100;
}

/** Compute run calories from distance and weight. */
export function computeRunCalories(distanceKm: number, weightKg: number): number {
  return Math.round(distanceKm * 1.0 * weightKg);
}

/** Assemble TDEE from components. */
export function computeTdee(
  bmr: number,
  stepCalories: number,
  runCalories: number,
  gymCalories: number,
  deficit: number,
): TdeeComponents {
  const total = bmr + stepCalories + runCalories + gymCalories;
  return {
    bmr,
    stepCalories,
    runCalories,
    gymCalories,
    deficit,
    total,
    targetCalories: Math.round(total - deficit),
  };
}

// ── Macro Targets ──────────────────────────────────────────

export interface MacroTargetOptions {
  targetCalories: number;
  weightKg: number;
  proteinGPerKg?: number;
  fatGPerKg?: number;
  trainingDayType?: string;
  carbPeriodization?: boolean;
}

/** Compute macro targets (protein, carbs, fat) from calorie budget. */
export function computeMacroTargets(opts: MacroTargetOptions): MacroTargets {
  const {
    targetCalories,
    weightKg,
    proteinGPerKg = 2.2,
    fatGPerKg = 0.8,
    trainingDayType = "rest",
    carbPeriodization = false,
  } = opts;

  const protein = Math.round(proteinGPerKg * weightKg);
  const FAT_FLOOR_G_PER_KG = 0.6;

  let fat: number;
  let carbs: number;

  if (carbPeriodization && trainingDayType in CARB_TARGETS_G_PER_KG) {
    const carbTarget = CARB_TARGETS_G_PER_KG[trainingDayType] * weightKg;
    const fatRemainder = (targetCalories - protein * 4 - carbTarget * 4) / 9;

    if (fatRemainder >= FAT_FLOOR_G_PER_KG * weightKg) {
      fat = Math.round(fatRemainder);
      carbs = Math.round(carbTarget);
    } else {
      fat = Math.round(FAT_FLOOR_G_PER_KG * weightKg);
      carbs = Math.round(Math.max((targetCalories - protein * 4 - fat * 9) / 4, 0));
    }
  } else {
    fat = Math.round(fatGPerKg * weightKg);
    carbs = Math.round(Math.max((targetCalories - protein * 4 - fat * 9) / 4, 0));
  }

  return { calories: targetCalories, protein, carbs, fat };
}

// ── Alcohol Offset ─────────────────────────────────────────

/** Apply alcohol calorie displacement to macro targets. */
export function applyAlcoholOffset(targets: MacroTargets, drinkCalories: number): MacroTargets {
  if (drinkCalories <= 0) return { ...targets };

  let remaining = drinkCalories;
  // Reduce carbs first
  const carbCut = Math.min(Math.floor(remaining / 4), targets.carbs);
  remaining -= carbCut * 4;
  // Then fat
  const fatCut = Math.min(Math.floor(remaining / 9), targets.fat);

  return {
    ...targets,
    carbs: targets.carbs - carbCut,
    fat: targets.fat - fatCut,
  };
}

/** Estimate fat oxidation pause from ethanol grams. */
export function fatOxidationPauseHours(ethanolGrams: number): number {
  if (ethanolGrams <= 0) return 0;
  // ~7g ethanol/hour metabolism rate
  return Math.round((ethanolGrams / 7) * 10) / 10;
}

// ── Slot Distribution ──────────────────────────────────────

/** Compute per-slot macro budgets from daily targets. */
export function computeSlotTargets(
  targets: MacroTargets,
  slots: string[] = DEFAULT_SLOTS,
  distribution: Record<string, number> = SLOT_DISTRIBUTION,
): SlotBudget[] {
  return slots.map((slot) => {
    const pct = distribution[slot] ?? 0.25;
    return {
      slot,
      calories: Math.round(targets.calories * pct),
      protein: Math.round(targets.protein * pct),
      carbs: Math.round(targets.carbs * pct),
      fat: Math.round(targets.fat * pct),
    };
  });
}

/** Redistribute remaining macros across unfilled slots. */
export function redistributeRemaining(
  targets: MacroTargets,
  eatenBySlot: Record<string, MacroTargets>,
  skippedSlots: string[] = [],
  slots: string[] = DEFAULT_SLOTS,
  distribution: Record<string, number> = SLOT_DISTRIBUTION,
): SlotBudget[] {
  // Sum what's been eaten
  const eaten: MacroTargets = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  for (const slotMacros of Object.values(eatenBySlot)) {
    eaten.calories += slotMacros.calories;
    eaten.protein += slotMacros.protein;
    eaten.carbs += slotMacros.carbs;
    eaten.fat += slotMacros.fat;
  }

  const remaining: MacroTargets = {
    calories: Math.max(targets.calories - eaten.calories, 0),
    protein: Math.max(targets.protein - eaten.protein, 0),
    carbs: Math.max(targets.carbs - eaten.carbs, 0),
    fat: Math.max(targets.fat - eaten.fat, 0),
  };

  // Find unfilled, unskipped slots
  const openSlots = slots.filter(
    (s) => !eatenBySlot[s] && !skippedSlots.includes(s)
  );

  if (openSlots.length === 0) {
    return slots.map((slot) => ({
      slot,
      ...(eatenBySlot[slot] ?? { calories: 0, protein: 0, carbs: 0, fat: 0 }),
    }));
  }

  // Distribute remaining proportionally to open slots
  const totalPct = openSlots.reduce((sum, s) => sum + (distribution[s] ?? 0.25), 0);

  return slots.map((slot) => {
    if (eatenBySlot[slot]) {
      return { slot, ...eatenBySlot[slot] };
    }
    if (skippedSlots.includes(slot)) {
      return { slot, calories: 0, protein: 0, carbs: 0, fat: 0 };
    }
    const pct = (distribution[slot] ?? 0.25) / totalPct;
    return {
      slot,
      calories: Math.round(remaining.calories * pct),
      protein: Math.round(remaining.protein * pct),
      carbs: Math.round(remaining.carbs * pct),
      fat: Math.round(remaining.fat * pct),
    };
  });
}
```

**Step 2: Verify build**

Run: `cd /Users/gkos/Projects/macro-engine/web && npm run build`
Expected: Build succeeds (library is pure TS, no external deps)

**Step 3: Commit**

```bash
cd /Users/gkos/Projects/macro-engine
git add web/lib/macro-engine.ts
git commit -m "feat: extract lib/macro-engine.ts shared computation library

Pure TypeScript functions for TDEE, macro targets, carb
periodization, alcohol offset, slot distribution, and
remaining-macro redistribution. No DB or framework deps.
Mirrors Python macro_engine library as canonical spec."
```

---

## Task 8: Deploy CF Worker for Garmin Token Exchange

Replicates hevy2garmin's `hevy2garmin-exchange-di` worker for MacroEngine.

**Files:**
- Create: `worker/wrangler.toml`
- Create: `worker/src/index.ts`
- Create: `worker/package.json`

**Step 1: Create worker directory**

```bash
mkdir -p /Users/gkos/Projects/macro-engine/worker/src
```

Create `worker/package.json`:

```json
{
  "name": "macroengine-exchange-di",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy"
  },
  "devDependencies": {
    "wrangler": "^4.0.0"
  }
}
```

Create `worker/wrangler.toml`:

```toml
name = "macroengine-exchange-di"
main = "src/index.ts"
compatibility_date = "2024-12-01"
```

**Step 2: Create worker code**

Create `worker/src/index.ts`:

```typescript
/**
 * Cloudflare Worker: Exchange Garmin SSO ticket for DI OAuth tokens.
 *
 * Garmin blocks cloud IPs from the SSO endpoint. The user signs in via
 * their browser (residential IP), captures the ticket, and this Worker
 * (on Cloudflare's residential-adjacent network) exchanges it.
 *
 * Same logic as hevy2garmin-exchange-di.
 */

export default {
  async fetch(request: Request): Promise<Response> {
    // CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return Response.json({ error: "POST only" }, { status: 405, headers: corsHeaders });
    }

    const url = new URL(request.url);
    if (url.pathname !== "/exchange") {
      return Response.json({ error: "Not found" }, { status: 404, headers: corsHeaders });
    }

    try {
      const body = await request.json() as { ticket?: string };
      const ticket = body?.ticket;

      if (!ticket || !ticket.startsWith("ST-")) {
        return Response.json(
          { error: "Invalid ticket. Must start with ST-" },
          { status: 400, headers: corsHeaders }
        );
      }

      // Exchange ticket for DI OAuth tokens
      const tokenResp = await fetch(
        "https://di-cert.garmin.com/di/oauth/preauthorized?" +
          new URLSearchParams({
            ticket,
            login_url: "https://sso.garmin.com/sso/embed",
            accepts: "com.garmin.connect",
          }),
        {
          method: "GET",
          headers: { "User-Agent": "com.garmin.android.apps.connectmobile" },
        }
      );

      if (!tokenResp.ok) {
        const text = await tokenResp.text();
        return Response.json(
          { error: `Garmin DI returned ${tokenResp.status}: ${text.slice(0, 200)}` },
          { status: 502, headers: corsHeaders }
        );
      }

      const tokens = await tokenResp.json() as Record<string, unknown>;

      // Extract the fields garmin-auth needs
      const result = {
        di_token: tokens.access_token ?? tokens.serviceTicketId,
        di_refresh_token: tokens.refresh_token ?? tokens.refreshTokenValue,
        di_client_id: tokens.consumer_key ?? tokens.consumerId ?? "macro-engine",
      };

      if (!result.di_token) {
        return Response.json(
          { error: "No access token in Garmin response" },
          { status: 502, headers: corsHeaders }
        );
      }

      return Response.json(result, { headers: corsHeaders });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      return Response.json(
        { error: msg.slice(0, 200) },
        { status: 500, headers: corsHeaders }
      );
    }
  },
};
```

**Step 3: Install worker deps**

```bash
cd /Users/gkos/Projects/macro-engine/worker && npm install
```

**Step 4: Deploy worker (requires wrangler login)**

```bash
cd /Users/gkos/Projects/macro-engine/worker && npx wrangler deploy
```

Expected output: `Published macroengine-exchange-di to https://macroengine-exchange-di.gkos.workers.dev`

**Step 5: Update setup page with real Worker URL**

In `web/app/setup/page.tsx`, update the `GARMIN_WORKER_BASE`:

```typescript
const GARMIN_WORKER_BASE = "https://macroengine-exchange-di.gkos.workers.dev";
```

**Step 6: Commit**

```bash
cd /Users/gkos/Projects/macro-engine
git add worker/ web/app/setup/page.tsx
git commit -m "feat: add CF Worker for Garmin DI token exchange

Cloudflare Worker at macroengine-exchange-di.gkos.workers.dev
exchanges Garmin SSO tickets for DI OAuth tokens. Bypasses
Garmin's cloud IP blocking. Same pattern as hevy2garmin."
```

---

## Verification

After all 8 tasks, verify the complete foundation:

```bash
# Python: all tests pass (44 original + 7 new = 51)
cd /Users/gkos/Projects/macro-engine && python -m pytest tests/ -v

# Web: builds cleanly
cd /Users/gkos/Projects/macro-engine/web && npm run build

# Web: dev server starts
cd /Users/gkos/Projects/macro-engine/web && npm run dev
# Visit http://localhost:3457/setup -- should show Garmin SSO page
# Visit http://localhost:3457/dashboard -- should show placeholder

# Worker: deployed and reachable
curl https://macroengine-exchange-di.gkos.workers.dev/exchange \
  -X POST -H "Content-Type: application/json" \
  -d '{"ticket":"ST-fake"}' 2>/dev/null | head -1
# Should return {"error":"Garmin DI returned 4xx..."} (expected, fake ticket)
```

**Repo structure after Phase 0:**

```
macro-engine/
  src/macro_engine/           # Python library (spec + tests)
    __init__.py
    tdee.py                   # Fixed: carb periodization now wired in
    calculator.py
    daily_plan.py
    alcohol.py
    data/drinks.py
  tests/                      # 51 Python tests
  web/                        # Next.js 16 app
    app/
      layout.tsx
      page.tsx
      dashboard/page.tsx
      setup/page.tsx          # Garmin SSO flow
      api/connections/garmin/ticket/route.ts
    lib/
      db.ts                   # Neon Postgres
      macro-engine.ts         # Pure TS computation (TDEE, macros, slots)
    middleware.ts              # Auth (shared secret cookie)
    package.json
    next.config.ts
    tsconfig.json
  worker/                     # CF Worker for Garmin token exchange
    src/index.ts
    wrangler.toml
    package.json
  docs/plans/                 # Design + implementation plans
  pyproject.toml
```

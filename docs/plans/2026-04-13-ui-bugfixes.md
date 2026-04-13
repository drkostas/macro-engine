# UI Bug Fixes & Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the 3 critical bugs (log API schema mismatch, no response.ok check, dead "See meal plan" button), add global navigation, and polish visual issues found during Playwright inspection.

**Architecture:** All changes are in the `web/` directory of the macro-engine repo. No Python changes. Fixes are in API routes, React components, and a new layout nav bar.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind 4, Neon Postgres

---

## Task 1: Fix log-meal API to match soma's meal_log schema

The current INSERT writes to columns `day`, `food_name`, `grams` which don't exist. Soma's meal_log uses `date`, `items` (JSONB array), `source`, `portion_multiplier`.

**Files:**
- Modify: `web/app/api/nutrition/log-meal/route.ts` (entire file)

**Step 1: Rewrite the POST handler**

Replace the entire file content:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * POST /api/nutrition/log-meal
 * Body: { date, meal_slot, items: [{ name, grams, calories, protein, carbs, fat, fiber? }] }
 *
 * Writes to soma's meal_log schema: date, meal_slot, source, items (JSONB),
 * calories, protein, carbs, fat, fiber, portion_multiplier, logged_at.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { date, meal_slot, items } = body;

  if (!date || !meal_slot || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { error: "Required: date, meal_slot, items[]" },
      { status: 400 },
    );
  }

  // Build JSONB items array matching soma format
  const jsonbItems = items.map((item: Record<string, unknown>) => ({
    ingredient_id: String(item.name ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "_"),
    name: item.name,
    grams: item.grams ?? null,
    calories: item.calories ?? 0,
    protein: item.protein ?? 0,
    carbs: item.carbs ?? 0,
    fat: item.fat ?? 0,
    fiber: item.fiber ?? 0,
  }));

  // Sum macros across all items
  const totalCal = jsonbItems.reduce((s: number, i: Record<string, number>) => s + (i.calories ?? 0), 0);
  const totalP = jsonbItems.reduce((s: number, i: Record<string, number>) => s + (i.protein ?? 0), 0);
  const totalC = jsonbItems.reduce((s: number, i: Record<string, number>) => s + (i.carbs ?? 0), 0);
  const totalF = jsonbItems.reduce((s: number, i: Record<string, number>) => s + (i.fat ?? 0), 0);
  const totalFiber = jsonbItems.reduce((s: number, i: Record<string, number>) => s + (i.fiber ?? 0), 0);

  const sql = getDb();

  try {
    const [row] = await sql`
      INSERT INTO meal_log (date, meal_slot, source, items, calories, protein, carbs, fat, fiber, portion_multiplier, logged_at)
      VALUES (
        ${date}, ${meal_slot}, 'macro_engine',
        ${JSON.stringify(jsonbItems)}::jsonb,
        ${totalCal}, ${totalP}, ${totalC}, ${totalF}, ${totalFiber},
        1.0, NOW()
      )
      RETURNING *
    `;
    return NextResponse.json({ logged: row, count: 1 }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to log meal";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const sql = getDb();
  try {
    await sql`DELETE FROM meal_log WHERE id = ${parseInt(id)}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to delete";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
```

**Step 2: Test with curl**

```bash
curl -s -X POST http://localhost:3457/api/nutrition/log-meal \
  -H "Content-Type: application/json" \
  -d '{"date":"2026-04-13","meal_slot":"lunch","items":[{"name":"Test Chicken","grams":200,"calories":330,"protein":62,"carbs":0,"fat":7}]}' | python3 -m json.tool
```

Expected: `{"logged": {...}, "count": 1}` with status 201 (not 500).

**Step 3: Verify in DB**

```bash
cd web && npx tsx -e "..." # query meal_log WHERE date='2026-04-13' AND meal_slot='lunch'
```

**Step 4: Delete the test entry**

```bash
curl -s -X DELETE "http://localhost:3457/api/nutrition/log-meal?id=<ID_FROM_STEP_2>"
```

**Step 5: Commit**

```bash
git add web/app/api/nutrition/log-meal/route.ts
git commit -m "fix: rewrite log-meal to match soma's meal_log schema

Was writing to nonexistent columns (day, food_name, grams).
Now writes: date, items (JSONB), source='macro_engine',
portion_multiplier=1.0. Sums macros across items for totals."
```

---

## Task 2: Fix response.ok check in logFood and logQuickAdd

Both functions in `web/app/log/page.tsx` don't check HTTP status. A 500 response shows the success toast.

**Files:**
- Modify: `web/app/log/page.tsx:100-130` (logFood) and `web/app/log/page.tsx:136-160` (logQuickAdd)

**Step 1: Fix logFood**

In `web/app/log/page.tsx`, replace the try block in `logFood()` (around line 107-124):

```typescript
    try {
      const resp = await fetch("/api/nutrition/log-meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: today,
          meal_slot: activeSlot,
          items: [{
            name: selectedFood.name,
            grams,
            calories: s.calories,
            protein: s.protein,
            carbs: s.carbs,
            fat: s.fat,
          }],
        }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Server error ${resp.status}`);
      }
      setToast(`Logged: ${selectedFood.name} ${grams}g (${s.calories} kcal)`);
      setSelectedFood(null);
      setQuery("");
      setGrams(100);
      setTimeout(() => setToast(null), 3000);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Failed to log. Try again.");
      setTimeout(() => setToast(null), 5000);
    } finally {
      setLogging(false);
    }
```

**Step 2: Fix logQuickAdd**

Same pattern -- add `if (!resp.ok)` check after fetch in `logQuickAdd()`:

```typescript
    try {
      const resp = await fetch("/api/nutrition/log-meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: today,
          meal_slot: activeSlot,
          items: [{
            name: quickName,
            grams: null,
            calories: parseInt(quickCal),
            protein: parseFloat(quickP) || 0,
            carbs: parseFloat(quickC) || 0,
            fat: parseFloat(quickF) || 0,
          }],
        }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Server error ${resp.status}`);
      }
      setToast(`Logged: ${quickName} (${quickCal} kcal)`);
      setQuickName(""); setQuickCal(""); setQuickP(""); setQuickC(""); setQuickF("");
      setTimeout(() => setToast(null), 3000);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Failed to log.");
      setTimeout(() => setToast(null), 5000);
    } finally {
      setLogging(false);
    }
```

**Step 3: Verify build**

```bash
cd web && npm run build
```

**Step 4: Commit**

```bash
git add web/app/log/page.tsx
git commit -m "fix: check response.ok before showing success toast

logFood and logQuickAdd now throw on non-2xx responses.
Error toast shows server error message and persists 5s
(vs 3s for success)."
```

---

## Task 3: Wire "See meal plan" button to navigate to log page

**Files:**
- Modify: `web/components/suggestion-banner.tsx:38`

**Step 1: Add onClick navigation**

Replace the dead button (line 38) with:

```tsx
<button
  onClick={() => window.location.href = `/log?slot=${nextSlot}`}
  className="shrink-0 ml-4 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium px-4 py-2.5 rounded-lg transition-colors"
>
  Log {SLOT_LABELS[nextSlot] ?? nextSlot}
</button>
```

Also change the button text from "See meal plan" to "Log {slot}" since the remaining-day plan modal isn't built yet. Honest about current capability.

**Step 2: Verify with Playwright**

Take screenshot of dashboard, click the button, verify it navigates to `/log?slot=lunch` (or whichever slot is next).

**Step 3: Commit**

```bash
git add web/components/suggestion-banner.tsx
git commit -m "fix: wire suggestion banner button to navigate to log page

Button now navigates to /log?slot=X for the next unfilled slot.
Text changed to 'Log [Slot]' until remaining-day plan modal is built."
```

---

## Task 4: Add global navigation bar

**Files:**
- Create: `web/components/nav-bar.tsx`
- Modify: `web/app/layout.tsx` (add NavBar to layout)

**Step 1: Create NavBar component**

Create `web/components/nav-bar.tsx`:

```tsx
"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Home", icon: "◉" },
  { href: "/log", label: "Log", icon: "+" },
  { href: "/setup", label: "Settings", icon: "⚙" },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop: top bar */}
      <nav className="hidden md:flex items-center justify-between px-6 py-3 bg-slate-900 border-b border-slate-800">
        <Link href="/dashboard" className="text-lg font-bold text-slate-100">
          MacroEngine
        </Link>
        <div className="flex items-center gap-1">
          {NAV_ITEMS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                pathname === href || pathname.startsWith(href + "/")
                  ? "bg-blue-600 text-white font-medium"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      </nav>

      {/* Mobile: bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around bg-slate-900 border-t border-slate-800 py-2 pb-[env(safe-area-inset-bottom)]">
        {NAV_ITEMS.map(({ href, label, icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center gap-0.5 px-4 py-1 min-w-[64px] ${
              pathname === href || pathname.startsWith(href + "/")
                ? "text-blue-400"
                : "text-slate-500"
            }`}
          >
            <span className="text-lg">{icon}</span>
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
```

**Step 2: Add NavBar to layout**

Modify `web/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { NavBar } from "@/components/nav-bar";
import "./globals.css";

export const metadata: Metadata = {
  title: "MacroEngine",
  description: "Smart nutrition tracking with real Garmin data",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 min-h-screen">
        <NavBar />
        <div className="pb-16 md:pb-0">
          {children}
        </div>
      </body>
    </html>
  );
}
```

The `pb-16 md:pb-0` adds bottom padding on mobile for the fixed bottom nav bar.

**Step 3: Remove redundant "Dashboard" back link from log page**

In `web/app/log/page.tsx`, remove the header with the back arrow (since nav bar handles navigation now). Replace:

```tsx
      {/* Header */}
      <div className="flex items-center justify-between">
        <a href="/dashboard" className="text-slate-400 hover:text-slate-200 text-sm">
          &larr; Dashboard
        </a>
        <h1 className="text-lg font-bold">Log Food</h1>
        <div />
      </div>
```

With:

```tsx
      <h1 className="text-lg font-bold">Log Food</h1>
```

**Step 4: Remove "MacroEngine" branding from dashboard page**

In `web/app/dashboard/page.tsx`, the header shows "MacroEngine" which now duplicates the nav bar. Replace:

```tsx
        <div>
          <h1 className="text-xl font-bold">MacroEngine</h1>
          <p className="text-sm text-slate-400">{today}</p>
        </div>
```

With:

```tsx
        <div>
          <p className="text-sm text-slate-400">{today}</p>
        </div>
```

**Step 5: Verify with Playwright**

Take desktop + mobile screenshots. Verify:
- Desktop: top nav bar with Home/Log/Settings links, active state highlighted
- Mobile: bottom tab bar with icons, safe area padding
- Navigation works between all pages

**Step 6: Commit**

```bash
git add web/components/nav-bar.tsx web/app/layout.tsx web/app/log/page.tsx web/app/dashboard/page.tsx
git commit -m "feat: add global navigation bar

Desktop: top bar with Home/Log/Settings links.
Mobile: fixed bottom tab bar with safe-area padding.
Removed redundant back links and duplicate branding."
```

---

## Task 5: Fix custom 404 page (dark theme)

**Files:**
- Create: `web/app/not-found.tsx`

**Step 1: Create dark-themed 404**

```tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <h1 className="text-6xl font-bold text-slate-700">404</h1>
      <p className="text-slate-400 mt-4">Page not found.</p>
      <Link
        href="/dashboard"
        className="mt-6 bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-500"
      >
        Back to Dashboard
      </Link>
    </main>
  );
}
```

**Step 2: Verify**

Visit http://localhost:3457/nonexistent -- should show dark-themed 404 with link back.

**Step 3: Commit**

```bash
git add web/app/not-found.tsx
git commit -m "feat: add dark-themed 404 page with dashboard link"
```

---

## Task 6: Visual polish fixes

**Files:**
- Modify: `web/components/macro-ring.tsx` (font sizes, hover)
- Modify: `web/app/dashboard/page.tsx` (deficit sign, zero-value bars, footer contrast, touch targets)

**Step 1: Fix macro-ring font sizes and hover**

In `web/components/macro-ring.tsx`:

- Line 46: change `text-[10px]` to `text-xs` (target value)
- Line 52: change `text-[10px]` to `text-xs` (percentage)
- Add hover effect: wrap outer div with `group cursor-default hover:scale-105 transition-transform`

```tsx
export function MacroRing({ label, current, target, unit, color, size = 120 }: MacroRingProps) {
  // ... existing logic ...

  return (
    <div className="flex flex-col items-center gap-1 group cursor-default hover:scale-105 transition-transform">
      <div className="relative" style={{ width: size, height: size }}>
        {/* ... SVG ... */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold" style={{ color: ringColor }}>
            {current.toLocaleString()}
          </span>
          <span className="text-xs text-slate-500">
            / {target.toLocaleString()}{unit}
          </span>
        </div>
      </div>
      <span className="text-xs font-medium text-slate-400">{label}</span>
      <span className="text-xs" style={{ color: ringColor }}>
        {Math.round(pct * 100)}%
      </span>
    </div>
  );
}
```

**Step 2: Fix deficit sign and zero-value bars in dashboard**

In `web/app/dashboard/page.tsx`, in the TDEE breakdown section:

Change the data array to show deficit as negative and skip zero-value items:

```tsx
        {[
          { label: "BMR", value: plan.tdee.bmr, color: "#94A3B8" },
          { label: "Steps", value: plan.tdee.stepCalories, color: "#10B981" },
          { label: "Exercise", value: plan.tdee.runCalories + plan.tdee.gymCalories, color: "#F59E0B" },
          { label: "Deficit", value: -plan.tdee.deficit, color: "#EF4444" },
        ]
          .filter(({ label, value }) => label === "BMR" || label === "Deficit" || value > 0)
          .map(({ label, value, color }) => (
```

And in the value display, remove the `+` prefix logic:

```tsx
              <span className="text-xs font-medium ml-auto" style={{ color }}>
                {Math.round(value)} kcal
              </span>
```

**Step 3: Fix footer contrast**

In `web/app/dashboard/page.tsx`, change `text-slate-600` to `text-slate-500` in the footer:

```tsx
      <div className="flex justify-between text-[11px] text-slate-500 px-1">
```

**Step 4: Increase touch targets**

In `web/components/suggestion-banner.tsx`, the button already got `py-2.5` in Task 3.

In `web/components/meal-slot-card.tsx`, change the "+ Add food" button padding:

```tsx
        <button
          onClick={() => onAddClick(slot)}
          className="w-full py-3 text-xs font-medium rounded-lg border border-dashed border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors"
        >
```

(`py-2` -> `py-3` = 44px total height with text)

**Step 5: Verify with Playwright**

Take before/after screenshots. Check:
- Ring font sizes increased (10px -> 12px)
- Ring hover scale effect works
- Deficit shows "-800 kcal" in red
- Exercise bar hidden when 0
- Footer text visible
- "+ Add food" buttons taller on mobile

**Step 6: Commit**

```bash
git add web/components/macro-ring.tsx web/components/meal-slot-card.tsx web/components/suggestion-banner.tsx web/app/dashboard/page.tsx
git commit -m "fix: visual polish from Playwright inspection

- Macro ring: font sizes 10px->12px, hover scale effect
- TDEE: deficit shows as negative, zero-value bars hidden
- Footer: text contrast improved (slate-600->slate-500)
- Touch targets: meal slot add buttons now 44px min height"
```

---

## Task 7: Verify all fixes with Playwright

**Files:**
- Create: `/tmp/verify-all-fixes.js`

**Step 1: Write comprehensive verification script**

Test all critical flows:
1. Dashboard loads with correct data
2. Search works and returns results
3. Select food -> portion picker -> click "Add to Lunch" -> success toast (not error)
4. Refresh dashboard -> new meal appears in Lunch slot
5. Nav bar present on all pages
6. 404 page is dark themed
7. Suggestion banner button navigates to /log
8. Mobile layout correct

**Step 2: Run and read all screenshots**

Verify every fix visually.

**Step 3: Final commit**

```bash
git push
```

---

## Verification Checklist

After all 7 tasks, confirm:

- [ ] `POST /api/nutrition/log-meal` writes to correct columns (date, items JSONB, source)
- [ ] logFood() shows error toast on 500 response
- [ ] logQuickAdd() shows error toast on 500 response
- [ ] Suggestion banner button navigates to `/log?slot=X`
- [ ] Desktop nav bar shows Home/Log/Settings with active state
- [ ] Mobile bottom tab bar with safe-area padding
- [ ] 404 page is dark themed with dashboard link
- [ ] Macro ring font sizes are 12px minimum
- [ ] Macro rings have hover scale effect
- [ ] Deficit shows "-800 kcal" (negative)
- [ ] Exercise bar hidden when 0 kcal
- [ ] Footer text visible (slate-500)
- [ ] "+ Add food" buttons are 44px tall
- [ ] `npm run build` passes
- [ ] No console errors on any page

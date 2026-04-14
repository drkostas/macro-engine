# Bug Fixes Round 2 -- Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Use Playwright to verify EVERY fix visually before committing.

**Goal:** Fix the top 8 issues found in the Playwright audit: rebalancing integration, date URL sync, onboarding wizard stub, /log -> /foods repurpose, activity selector overflow, copy-yesterday confirmation, skip toast, and trend table mobile layout.

**Architecture:** All changes in `web/`. Playwright verification after each task (take screenshot, read it, confirm fix).

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind 4, Playwright (headless via npx)

---

## Task 1: Wire rebalancing after meal log + toast

The rebalance API exists but is never called. After logging a meal, call `/api/nutrition/rebalance` and show a toast with the changes.

**Files:**
- Modify: `web/components/meal-composer.tsx` (handleLog function)
- Modify: `web/app/dashboard/page.tsx` (add toast state)

**Step 1: Add rebalance call after logging**

In `web/components/meal-composer.tsx`, in `handleLog`, after the successful log-meal fetch, call rebalance:

```typescript
// After the log-meal succeeds, trigger rebalance
const rebalResp = await fetch("/api/nutrition/rebalance", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    date,
    changedSlot: slot,
    lockedSlots: [], // TODO: read from localStorage
  }),
});
const rebalData = await rebalResp.json();
```

Pass the rebalance changes back to the parent via a new `onRebalanced` callback prop so the dashboard can show a toast.

**Step 2: Add toast to dashboard for rebalance changes**

In `web/app/dashboard/page.tsx`, add a `rebalanceToast` state. When rebalance returns changes, show: "Adjusted dinner: Rice 150g -> 120g, Chicken stays at 200g"

**Step 3: Playwright verify**

Write `/tmp/verify-rebalance.js`: log a meal that exceeds a slot budget, check if toast appears with adjustment text.

**Step 4: Commit**

```bash
git commit -m "feat: wire rebalancing after meal log with toast notification"
```

---

## Task 2: Sync date to URL param

Date navigation changes data but URL stays `/dashboard`. Should use `?date=YYYY-MM-DD`.

**Files:**
- Modify: `web/app/dashboard/page.tsx` (read/write URL param)

**Step 1: Read date from URL on mount**

```typescript
const searchParams = useSearchParams();
const urlDate = searchParams.get("date");
const [currentDate, setCurrentDate] = useState(urlDate || new Date().toISOString().split("T")[0]);
```

**Step 2: Update URL when date changes**

```typescript
const router = useRouter();
// In date change handler:
router.push(`/dashboard?date=${newDate}`, { scroll: false });
```

**Step 3: Playwright verify**

Navigate to prev day, check URL contains `?date=`. Refresh, verify same day loads.

**Step 4: Commit**

```bash
git commit -m "fix: sync date to URL param (?date=YYYY-MM-DD)"
```

---

## Task 3: Activity selector overflow fix

14 gym chips overflow horizontally. Wrap them or add scrollable container.

**Files:**
- Modify: `web/components/activity-selector.tsx`

**Step 1: Make chips scrollable with overflow**

Change the flex container to:
```tsx
<div className="flex flex-wrap gap-2 max-h-[80px] overflow-y-auto">
```

This wraps chips to multiple rows with a scroll if too many. On mobile, limit to 2 rows visible.

**Step 2: Playwright verify**

Screenshot activity selector. Verify chips wrap neatly, no horizontal overflow.

**Step 3: Commit**

```bash
git commit -m "fix: activity selector chips wrap instead of overflow"
```

---

## Task 4: Skip slot toast feedback

Clicking "Skip" works but no visual feedback.

**Files:**
- Modify: `web/app/dashboard/page.tsx` (add toast after skip)

**Step 1: Add toast state and show after skip**

```typescript
const [toast, setToast] = useState<string | null>(null);

// In skip handler:
setToast(`${SLOT_LABELS[slot]} skipped -- budget moved to other meals`);
setTimeout(() => setToast(null), 3000);
```

Add toast element at bottom of dashboard (same emerald style as log page).

**Step 2: Playwright verify**

Click Skip on a slot, verify toast appears.

**Step 3: Commit**

```bash
git commit -m "fix: show toast after skipping a meal slot"
```

---

## Task 5: Copy yesterday confirmation

"Copy yesterday" replaces all meals without confirmation.

**Files:**
- Modify: `web/components/date-navigator.tsx`

**Step 1: Add confirmation before copy**

```typescript
onCopyYesterday={() => {
  if (!confirm("Copy all meals from yesterday? This will replace any meals logged today.")) return;
  // ... existing copy logic
}}
```

Simple `window.confirm` is fine for now.

**Step 2: Playwright verify**

Verify button exists and clicking it shows browser confirm dialog.

**Step 3: Commit**

```bash
git commit -m "fix: add confirmation dialog before copy yesterday"
```

---

## Task 6: Trend table mobile layout

5 columns at 390px is too cramped.

**Files:**
- Modify: `web/components/trend-table.tsx`

**Step 1: Hide burn column on mobile, show deficit only**

```tsx
<div className="grid grid-cols-4 md:grid-cols-5 gap-2">
  <span>Date</span>
  <span className="text-right">Ate</span>
  <span className="text-right hidden md:block">Burn</span>
  <span className="text-right">Deficit</span>
  <span className="text-right">Goal</span>
</div>
```

Same pattern for data rows: hide burn on mobile.

**Step 2: Playwright verify**

Screenshot at 390px. Verify 4 columns fit, no overflow.

**Step 3: Commit**

```bash
git commit -m "fix: trend table hides burn column on mobile for readability"
```

---

## Task 7: Repurpose /log to /foods

The old log page is obsolete now that composition happens inline. Rename and repurpose as Food Library.

**Files:**
- Rename: `web/app/log/page.tsx` -> `web/app/foods/page.tsx`
- Modify: `web/components/nav-bar.tsx` (update nav link)

**Step 1: Move and rewrite the page**

Move the file:
```bash
mv web/app/log/page.tsx web/app/foods/page.tsx
```

Rewrite as a Food Library: browse My Ingredients (from /api/nutrition/presets), search USDA, create custom food, manage favorites. Remove the meal logging functionality (no slot selector, no "Add to Lunch" button).

**Step 2: Update nav bar**

Change `/log` to `/foods` with label "Foods" in `nav-bar.tsx`.

**Step 3: Update all references**

Search for `/log` in the codebase and update to `/foods`.

**Step 4: Playwright verify**

Navigate to /foods. Verify it shows ingredient library, USDA search works, no meal logging UI.

**Step 5: Commit**

```bash
git commit -m "feat: repurpose /log as /foods (Food Library management)"
```

---

## Task 8: Onboarding wizard stub

New users with no `nutrition_profile` get a generic "Complete onboarding" error. Need at minimum a profile setup form.

**Files:**
- Create: `web/app/onboard/page.tsx`
- Modify: `web/app/dashboard/page.tsx` (redirect to /onboard instead of /setup)

**Step 1: Create basic onboarding page**

5 sections in one page (not a wizard yet):
1. Weight (kg), Height (cm), Age, Sex
2. Goal: Lose fat / Maintain / Build muscle
3. Deficit level: 300 / 500 / 800 kcal
4. Target BF% (optional)
5. Save button

POST to `/api/nutrition/onboard` (port from soma) or a simplified version that just upserts `nutrition_profile`.

**Step 2: Create /api/nutrition/onboard route**

Simplified version: accept profile fields, upsert `nutrition_profile`, compute initial TDEE from BMR estimate.

**Step 3: Update dashboard redirect**

Change the onboarding error state to redirect to `/onboard` instead of `/setup`.

**Step 4: Playwright verify**

Go to /onboard. Fill form. Submit. Verify redirect to dashboard with computed targets.

**Step 5: Commit**

```bash
git commit -m "feat: add onboarding page with profile setup form"
```

---

## Verification

After all 8 tasks, run full audit:

```bash
node /tmp/full-audit.js
```

Verify:
- [ ] Zero console errors
- [ ] Rebalance toast appears after logging a meal that exceeds budget
- [ ] Date in URL syncs with navigation
- [ ] Activity chips wrap, no overflow
- [ ] Skip shows toast
- [ ] Copy yesterday shows confirmation
- [ ] Trend table readable on mobile (4 cols)
- [ ] /foods page works as Food Library
- [ ] /onboard page creates profile
- [ ] All 15 API routes respond correctly

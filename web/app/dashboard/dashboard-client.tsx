"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { MacroRing } from "@/components/macro-ring";
import { MealSlotCard } from "@/components/meal-slot-card";
import { SuggestionBanner } from "@/components/suggestion-banner";
import { DateNavigator } from "@/components/date-navigator";
import { ActivitySelector } from "@/components/activity-selector";
import { DrinkLogger } from "@/components/drink-logger";
import { TrendTable } from "@/components/trend-table";
import { WeightChart } from "@/components/weight-chart";
import { QuickEstimate } from "@/components/quick-estimate";
import { WeeklySummary } from "@/components/weekly-summary";
import { OnboardingTour } from "@/components/onboarding-tour";
import { WeighInWidget } from "@/components/weigh-in-widget";
import { StreakBadge } from "@/components/streak-badge";
import { MilestoneToast } from "@/components/milestone-toast";
import { DayCompleteModal, type DayCompleteData } from "@/components/day-complete-modal";
import { useReminders } from "@/lib/use-reminders";
import { useUndoToast } from "@/lib/use-undo-toast";
import { DEFAULT_SLOTS, type MacroTargets } from "@/lib/macro-engine";
import { MACRO_COLORS, progressColor } from "@/lib/macro-colors";
import { InfoTip } from "@/components/info-tip";
import type { Ingredient } from "@/lib/portion-solver";
import type { PresetMeal } from "@/components/ingredient-picker";

interface SlotBudget extends MacroTargets {
  slot: string;
}

interface PlanData {
  date: string;
  weightKg: number;
  tdee: {
    bmr: number;
    stepCalories: number;
    runCalories: number;
    gymCalories: number;
    deficit: number;
    total: number;
    targetCalories: number;
  };
  targets: MacroTargets;
  eaten: MacroTargets;
  remaining: MacroTargets;
  slotBudgets: SlotBudget[];
  mealsBySlot: Record<string, Array<Record<string, unknown>>>;
  plannedBySlot?: Record<string, Array<Record<string, unknown>>>;
  drinkCalories: number;
  drinks: Array<{
    id: number; name: string; quantity_ml: number; calories: number;
    alcohol_grams: number; fat_oxidation_pause_hours: number;
  }>;
  trainingDayType: string;
  skippedSlots: string[];
  dayStatus: string;
  runEnabled: boolean;
  selectedWorkouts: string[];
  expectedSteps: number | null;
  trend: Array<{
    date: string; target_calories: number; actual_calories: number | null;
    tdee_used: number | null; deficit_used: number | null; status: string;
    training_day_type?: string;
  }>;
  pctComplete: number;
  autoDetected?: { run: boolean; gym: string[] };
  error?: string;
  needsOnboarding?: boolean;
}

export function DashboardClient() {
  return (
    <Suspense fallback={<div className="p-6 text-text-muted">Loading...</div>}>
      <DashboardInner />
    </Suspense>
  );
}

function DashboardInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [presets, setPresets] = useState<PresetMeal[]>([]);
  const [currentDate, setCurrentDate] = useState(
    searchParams.get("date") || new Date().toISOString().split("T")[0]
  );
  const [previewTotals, setPreviewTotals] = useState<Record<string, MacroTargets>>({});
  const [tdeeExpanded, setTdeeExpanded] = useState(false);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [recentMeals, setRecentMeals] = useState<Record<string, Array<Record<string, unknown>>>>({});
  const [dayComplete, setDayComplete] = useState<DayCompleteData | null>(null);

  // Fire scheduled reminders when browser tab is open
  useReminders();
  const undoToast = useUndoToast();
  const [ringSize, setRingSize] = useState(110);
  const [isCompact, setIsCompact] = useState(false);

  // Responsive ring size
  useEffect(() => {
    const update = () => setRingSize(window.innerWidth < 640 ? 62 : 100);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Shrink hero when scrolled past threshold
  useEffect(() => {
    const onScroll = () => setIsCompact(window.scrollY > 160);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Fetch ingredients, presets, and recent data once
  useEffect(() => {
    fetch("/api/nutrition/presets")
      .then((r) => r.json())
      .then((data) => {
        setIngredients(data.ingredients ?? []);
        setPresets(data.presets ?? []);
      })
      .catch(() => {});
    fetch("/api/food/recent")
      .then((r) => r.json())
      .then((data) => setRecentIds(data.recentIds ?? []))
      .catch(() => {});
    // Fetch recent meals for each slot
    for (const slot of DEFAULT_SLOTS) {
      fetch(`/api/nutrition/recent-meals?slot=${slot}`)
        .then((r) => r.json())
        .then((data) => {
          setRecentMeals((prev) => ({ ...prev, [slot]: data.meals ?? [] }));
        })
        .catch(() => {});
    }
  }, []);

  const fetchPlan = useCallback(async (dateOverride?: string) => {
    const d = dateOverride ?? currentDate;
    try {
      const resp = await fetch(`/api/nutrition/plan?date=${d}`, { cache: "no-store" });
      const data = await resp.json();
      if (data.error) {
        if (data.needsOnboarding) {
          setError("onboarding");
        } else {
          setError(data.error);
        }
      } else {
        setPlan(data);
        setError(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate]);

  useEffect(() => {
    setLoading(true);
    fetchPlan();
    const interval = setInterval(() => fetchPlan(), 60000);
    return () => clearInterval(interval);
  }, [fetchPlan]);

  if (loading) {
    return (
      <main className="p-6 max-w-6xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-surface-elevated rounded w-48" />
          <div className="h-32 bg-surface-elevated rounded-xl" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-48 bg-surface-elevated rounded-xl" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (error === "onboarding") {
    return (
      <main className="p-6 max-w-lg mx-auto text-center mt-20">
        <h1 className="text-2xl font-bold mb-4">Welcome to MacroEngine</h1>
        <p className="text-text-secondary mb-6">Let's set up your profile to calculate your targets.</p>
        <a
          href="/onboard"
          className="inline-block bg-teal-dim text-white px-6 py-3 rounded-lg font-medium hover:bg-teal"
        >
          Get Started
        </a>
      </main>
    );
  }

  if (error || !plan) {
    return (
      <main className="p-6 max-w-6xl mx-auto">
        <div className="bg-danger/10 border border-danger/30 rounded-2xl p-6">
          <h2 className="text-danger font-semibold">Error loading plan</h2>
          <p className="text-sm text-danger/70 mt-1">{error}</p>
          <button
            onClick={() => fetchPlan()}
            className="mt-3 text-sm text-danger hover:text-danger underline"
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  const nextSlot = DEFAULT_SLOTS.find(
    (s) => !plan.mealsBySlot[s]?.length && !plan.skippedSlots.includes(s),
  );

  const isClosed = plan.dayStatus === "closed";
  const hasMeals = Object.values(plan.mealsBySlot).some((m) => (m as unknown[]).length > 0);
  const exerciseCals = plan.tdee.runCalories + plan.tdee.gymCalories;
  const today = new Date().toISOString().split("T")[0];
  const isPastDay = plan.date < today;
  const isFutureDay = plan.date > today;
  const showQuickEstimate = isPastDay && !hasMeals;

  return (
    <main className="p-4 md:p-8 max-w-6xl mx-auto space-y-6 md:space-y-8">
      {/* Date Navigator + Training Day Type */}
      <DateNavigator
        date={plan.date}
        status={plan.dayStatus}
        trainingDayType={plan.trainingDayType}
        onDateChange={(d) => { setCurrentDate(d); setLoading(true); router.push(`/dashboard?date=${d}`, { scroll: false }); }}
        onCloseDay={async () => {
          const closeDate = plan.date;
          await fetch("/api/nutrition/close-day", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ date: closeDate }),
          });
          let streak = 0;
          try {
            const sr = await fetch("/api/nutrition/streak");
            if (sr.ok) {
              const sd = await sr.json();
              streak = Number(sd.streak) || 0;
            }
          } catch { /* pre-Phase-9 */ }

          setDayComplete({
            actualCalories: plan.eaten.calories,
            targetCalories: plan.targets.calories,
            tdee: plan.tdee.total,
            goalDeficit: plan.tdee.deficit,
            actualProtein: plan.eaten.protein,
            proteinTarget: plan.targets.protein,
            streak,
          });
          fetchPlan();
          undoToast.show({
            label: "Day closed",
            onUndo: async () => {
              await fetch("/api/nutrition/reopen-day", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ date: closeDate }),
              });
              fetchPlan();
            },
          });
        }}
        onReopenDay={async () => {
          await fetch("/api/nutrition/reopen-day", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ date: plan.date }),
          });
          fetchPlan();
        }}
        onCopyYesterday={async () => {
          if (!confirm("Copy all meals from yesterday? This will replace any meals already logged today.")) return;
          const yesterday = new Date(plan.date + "T12:00:00");
          yesterday.setDate(yesterday.getDate() - 1);
          await fetch("/api/nutrition/copy-day", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ from_date: yesterday.toISOString().split("T")[0], to_date: plan.date }),
          });
          setToast("Meals copied from yesterday");
          setTimeout(() => setToast(null), 3000);
          fetchPlan();
        }}
        hasMeals={hasMeals}
      />

      {(() => {
        const preview = Object.values(previewTotals).reduce((acc, t) => ({
          calories: acc.calories + (t.calories ?? 0),
          protein: acc.protein + (t.protein ?? 0),
          carbs: acc.carbs + (t.carbs ?? 0),
          fat: acc.fat + (t.fat ?? 0),
          fiber: acc.fiber + (t.fiber ?? 0),
        }), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
        const hasPreview = preview.calories > 0;
        const projected = {
          calories: plan.eaten.calories + preview.calories,
          protein: plan.eaten.protein + preview.protein,
          carbs: plan.eaten.carbs + preview.carbs,
          fat: plan.eaten.fat + preview.fat,
          fiber: (plan.eaten.fiber ?? 0) + preview.fiber,
        };
        const projectedPct = plan.targets.calories > 0
          ? Math.round((projected.calories / plan.targets.calories) * 100)
          : 0;
        const projectedRem = plan.targets.calories - projected.calories;

        const macroBars = [
          { label: "P", val: projected.protein, target: plan.targets.protein, color: "bg-warm" },
          { label: "C", val: projected.carbs, target: plan.targets.carbs, color: "bg-indigo" },
          { label: "F", val: projected.fat, target: plan.targets.fat, color: "bg-lime" },
          { label: "Fi", val: projected.fiber, target: plan.targets.fiber ?? 0, color: "bg-teal-light" },
        ];

        return (
          <>
            {/* Floating compact bar — fixed, slides in from top when scrolled */}
            <div
              className={`fixed left-0 right-0 top-[56px] z-30 transition-transform duration-200 ${
                isCompact ? "translate-y-0" : "-translate-y-full pointer-events-none"
              }`}
            >
              <div className="max-w-6xl mx-auto px-4 md:px-8">
                <div className="bg-surface-elevated border border-border-glow shadow-xl rounded-b-2xl px-4 py-3">
                  <div className="flex items-center gap-3 md:gap-4 mb-2">
                    <div className="flex items-baseline gap-1.5 shrink-0">
                      <span className="t-title tnum text-text">{Math.round(projected.calories).toLocaleString()}</span>
                      <span className="t-caption text-text-muted tnum">/ {plan.targets.calories.toLocaleString()}</span>
                      {hasPreview && <span className="t-caption text-warm tnum">+{Math.round(preview.calories)}</span>}
                    </div>
                    <div className="flex-1 h-1.5 bg-surface rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          projectedPct > 110 ? "bg-warning" : projectedPct > 90 ? "bg-success" : "bg-teal"
                        }`}
                        style={{ width: `${Math.min(projectedPct, 100)}%` }}
                      />
                    </div>
                    <span className="t-caption text-text-muted tnum shrink-0">{projectedPct}%</span>
                  </div>
                  {/* Macro bars row */}
                  <div className="grid grid-cols-4 gap-2">
                    {macroBars.map((m) => {
                      const pct = m.target > 0 ? Math.min(100, (m.val / m.target) * 100) : 0;
                      return (
                        <div key={m.label} className="flex items-center gap-1.5">
                          <span className="t-micro tnum text-text-muted w-4 shrink-0">{m.label}</span>
                          <div className="flex-1 h-1 bg-surface rounded-full overflow-hidden">
                            <div className={`h-full ${m.color} rounded-full transition-all duration-300`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="t-micro tnum text-text-muted shrink-0 w-7 text-right">{Math.round(m.val)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Full hero card — stays in normal flow, no sticky, no jank */}
            <div data-tour="hero" className="bg-surface-elevated rounded-3xl border border-border-glow p-5 md:p-7">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="t-eyebrow">Today</span>
                  <WeighInWidget currentWeight={plan.weightKg} onSaved={() => fetchPlan()} />
                  <StreakBadge />
                </div>
                <InfoTip text="Your daily macro targets adapt based on weight, training day type, and activity selection. Carbs adjust by training intensity." />
              </div>

              {/* Hero metric */}
              <div className="flex items-baseline gap-2 md:gap-3 mb-1">
                <span className="t-display tnum text-text">{plan.eaten.calories.toLocaleString()}</span>
                {hasPreview && (
                  <span className="t-headline text-warm tnum">+{Math.round(preview.calories).toLocaleString()}</span>
                )}
                <span className="t-title text-text-muted tnum">/ {plan.targets.calories.toLocaleString()}</span>
                <span className="t-caption text-text-faint uppercase tracking-wider">kcal</span>
              </div>

              {/* Status line */}
              <div className="flex items-center gap-3 mb-6 flex-wrap">
                <span className="t-body text-text-secondary">
                  {(hasPreview ? projectedRem : plan.remaining.calories) > 0
                    ? <><span className="text-text tnum">{Math.round(hasPreview ? projectedRem : plan.remaining.calories).toLocaleString()}</span> remaining</>
                    : <span className="text-warning tnum">+{Math.abs(Math.round(hasPreview ? projectedRem : plan.remaining.calories)).toLocaleString()} over target</span>}
                </span>
                <span className="text-text-faint">·</span>
                <span className={`t-body tnum ${progressColor(hasPreview ? projectedPct : plan.pctComplete)}`}>
                  {hasPreview ? projectedPct : plan.pctComplete}% {hasPreview ? "projected" : "complete"}
                </span>
                {hasPreview && (
                  <span className="t-caption text-warm">(composing)</span>
                )}
              </div>

              {/* Supporting macro rings */}
              <div className="grid grid-cols-5 gap-1 md:gap-4 justify-items-center">
                <MacroRing label="Calories" current={projected.calories} target={plan.targets.calories} unit="" color={MACRO_COLORS.calories.hex} size={ringSize} />
                <MacroRing label="Protein" current={projected.protein} target={plan.targets.protein} unit="g" color={MACRO_COLORS.protein.hex} size={ringSize} />
                <MacroRing label="Carbs" current={projected.carbs} target={plan.targets.carbs} unit="g" color={MACRO_COLORS.carbs.hex} size={ringSize} />
                <MacroRing label="Fat" current={projected.fat} target={plan.targets.fat} unit="g" color={MACRO_COLORS.fat.hex} size={ringSize} />
                <MacroRing label="Fiber" current={projected.fiber} target={plan.targets.fiber ?? 0} unit="g" color={MACRO_COLORS.fiber.hex} size={ringSize} />
              </div>
            </div>
          </>
        );
      })()}

      {/* TDEE breakdown - separate collapsible card */}
      <div className="bg-surface rounded-2xl border border-border p-4">
        <button
          onClick={() => setTdeeExpanded(!tdeeExpanded)}
          className="w-full flex items-center justify-between t-caption text-text-muted hover:text-text-secondary transition-colors"
        >
          <span className="tnum">
            BMR {Math.round(plan.tdee.bmr)}
            {plan.tdee.stepCalories > 0 && <> + Steps {Math.round(plan.tdee.stepCalories)}</>}
            {exerciseCals > 0 && <> + Exercise {Math.round(exerciseCals)}</>}
            {" "}− Deficit {Math.round(plan.tdee.deficit)}
          </span>
          <span className="text-text-faint ml-2">{tdeeExpanded ? "−" : "+"}</span>
        </button>

        {tdeeExpanded && (
          <div className="mt-3 space-y-2">
            {[
              { label: "BMR", value: plan.tdee.bmr, op: "", tip: "Basal Metabolic Rate — calories your body burns at rest." },
              ...(plan.tdee.stepCalories > 0
                ? [{ label: "Steps", value: plan.tdee.stepCalories, op: "+", tip: "NEAT. Calories burned from daily walking and movement." }]
                : []),
              ...(plan.tdee.runCalories > 0
                ? [{ label: "Run", value: plan.tdee.runCalories, op: "+", tip: "Running calories from your training plan or Garmin data." }]
                : []),
              ...(plan.tdee.gymCalories > 0
                ? [{ label: "Gym", value: plan.tdee.gymCalories, op: "+", tip: "Average calories for your selected gym workouts." }]
                : []),
              { label: "Deficit", value: plan.tdee.deficit, op: "−", tip: "How much below maintenance you eat. Adapts to your weight trend." },
            ].map(({ label, value, op, tip }) => (
              <div key={label} className="flex items-center t-body">
                <span className="w-5 text-text-faint text-center">{op}</span>
                <span className="text-text-secondary flex-1 flex items-center">
                  {label}
                  <InfoTip text={tip} />
                </span>
                <span className="text-text font-semibold tnum">
                  {Math.round(value).toLocaleString()}
                </span>
                <span className="text-text-faint ml-1 t-caption">kcal</span>
              </div>
            ))}
            <div className="flex items-center pt-2 border-t border-border t-body">
              <span className="w-5 text-text-faint text-center">=</span>
              <span className="text-text flex-1 font-semibold">Daily target</span>
              <span className="text-text font-bold tnum">
                {plan.tdee.targetCalories.toLocaleString()}
              </span>
              <span className="text-text-faint ml-1 t-caption">kcal</span>
            </div>
            {plan.drinkCalories > 0 && (
              <div className="flex items-center pt-2 border-t border-border t-body">
                <span className="w-5" />
                <span className="text-warning flex-1">Alcohol offset</span>
                <span className="text-warning font-semibold tnum">
                  −{plan.drinkCalories}
                </span>
                <span className="text-text-faint ml-1 t-caption">kcal</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Activity Selector */}
      <div data-tour="activity">
      <ActivitySelector
        date={plan.date}
        trainingDayType={plan.trainingDayType}
        runEnabled={plan.runEnabled}
        selectedWorkouts={plan.selectedWorkouts}
        expectedSteps={plan.expectedSteps ?? undefined}
        disabled={isClosed}
        onChanged={fetchPlan}
        autoDetected={plan.autoDetected}
      />
      </div>

      {/* Suggestion Banner (only when not closed) */}
      {!isClosed && (
        <SuggestionBanner remaining={plan.remaining} nextSlot={nextSlot ?? null} />
      )}

      {/* Meal Slots */}
      <div data-tour="meal-cards" className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {DEFAULT_SLOTS.map((slot) => {
          const budget = plan.slotBudgets.find((b) => b.slot === slot) ?? {
            slot,
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0,
            fiber: 0,
          };
          const meals = (plan.mealsBySlot[slot] ?? []) as Array<{
            id: number;
            food_name: string;
            grams: number | null;
            calories: number;
            protein: number;
            carbs: number;
            fat: number;
            items?: Array<{
              name?: string;
              ingredient_id?: string;
              grams?: number;
              calories?: number;
              protein?: number;
              carbs?: number;
              fat?: number;
              fiber?: number;
            }>;
          }>;

          const plannedMeals = ((plan.plannedBySlot ?? {})[slot] ?? []) as typeof meals;

          return (
            <MealSlotCard
              key={slot}
              slot={slot}
              budget={budget}
              items={meals}
              plannedItems={plannedMeals}
              isFuture={isFutureDay}
              isSkipped={plan.skippedSlots.includes(slot)}
              date={plan.date}
              ingredients={ingredients}
              presets={presets}
              recentIds={recentIds}
              recentMeals={recentMeals[slot] ?? []}
              onMealLogged={() => {
                setPreviewTotals((prev) => { const n = { ...prev }; delete n[slot]; return n; });
                fetchPlan();
              }}
              onRebalanced={(changes) => {
                const msg = changes.map((c) => `${c.ingredient} ${c.from}g -> ${c.to}g`).join(", ");
                setToast(`Rebalanced: ${msg}`);
                setTimeout(() => setToast(null), 5000);
              }}
              onSkipSlot={async () => {
                const skipSlot = slot;
                const skipDate = plan.date;
                const wasSkipped = plan.skippedSlots.includes(skipSlot);
                await fetch("/api/nutrition/skip-slot", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ date: skipDate, slot: skipSlot }),
                });
                const slotName = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", pre_sleep: "Pre-Sleep" }[skipSlot] ?? skipSlot;
                fetchPlan();
                undoToast.show({
                  label: wasSkipped ? `${slotName} reopened` : `${slotName} skipped`,
                  onUndo: async () => {
                    // Toggle back
                    await fetch("/api/nutrition/skip-slot", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ date: skipDate, slot: skipSlot }),
                    });
                    fetchPlan();
                  },
                });
              }}
              onTotalsPreview={(totals) => {
                setPreviewTotals((prev) => ({ ...prev, [slot]: { ...totals, fiber: totals.fiber ?? 0 } }));
              }}
              onDeleteItem={async (id) => {
                const deletedDate = plan.date;
                const deletedSlot = slot;
                // Snapshot the meal before deleting so we can restore it
                const mealToDelete = (plan.mealsBySlot[deletedSlot] ?? []).find(
                  (m) => (m as { id: number }).id === id,
                ) as { items?: Array<Record<string, unknown>>; notes?: string | null; weigh_method?: string | null } | undefined;
                await fetch(`/api/nutrition/log-meal?id=${id}`, { method: "DELETE" });
                fetchPlan();
                if (mealToDelete?.items?.length) {
                  undoToast.show({
                    label: "Meal removed",
                    onUndo: async () => {
                      await fetch("/api/nutrition/log-meal", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          date: deletedDate,
                          meal_slot: deletedSlot,
                          source: "undo_delete",
                          items: mealToDelete.items,
                          notes: mealToDelete.notes,
                          weigh_method: mealToDelete.weigh_method,
                        }),
                      });
                      fetchPlan();
                    },
                  });
                }
              }}
            />
          );
        })}
      </div>

      {/* Quick Estimate for past empty days */}
      {showQuickEstimate && (
        <QuickEstimate
          date={plan.date}
          currentEstimate={plan.eaten.calories > 0 ? plan.eaten.calories : undefined}
          targetCalories={plan.tdee.targetCalories}
          onSaved={fetchPlan}
        />
      )}

      {/* Drink Logger */}
      <DrinkLogger
        date={plan.date}
        drinks={plan.drinks ?? []}
        totalDrinkCalories={plan.drinkCalories}
        disabled={isClosed}
        onChanged={fetchPlan}
      />

      {/* Weight Trend Chart */}
      <div data-tour="weight-chart">
        <WeightChart />
      </div>

      {/* Weekly summary */}
      <WeeklySummary />

      {/* 7-Day Trend */}
      <TrendTable days={plan.trend ?? []} currentDate={plan.date} />

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 glass-elevated text-success px-4 py-2.5 rounded-xl text-sm shadow-lg z-50 border-glow">
          {toast}
        </div>
      )}

      {/* Milestone achievement toast */}
      <MilestoneToast />

      {/* First-visit onboarding tour */}
      <OnboardingTour />

      {/* Day-close celebration modal */}
      <DayCompleteModal
        open={dayComplete !== null}
        data={dayComplete}
        onDismiss={() => setDayComplete(null)}
      />
    </main>
  );
}

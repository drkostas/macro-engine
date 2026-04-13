"use client";

import { useEffect, useState, useCallback } from "react";
import { MacroRing } from "@/components/macro-ring";
import { MealSlotCard } from "@/components/meal-slot-card";
import { SuggestionBanner } from "@/components/suggestion-banner";
import { DEFAULT_SLOTS, type MacroTargets } from "@/lib/macro-engine";

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
  drinkCalories: number;
  trainingDayType: string;
  skippedSlots: string[];
  pctComplete: number;
  error?: string;
  needsOnboarding?: boolean;
}

export default function Dashboard() {
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlan = useCallback(async () => {
    try {
      const resp = await fetch("/api/nutrition/plan");
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
  }, []);

  useEffect(() => {
    fetchPlan();
    // SWR-style polling every 60s
    const interval = setInterval(fetchPlan, 60000);
    return () => clearInterval(interval);
  }, [fetchPlan]);

  if (loading) {
    return (
      <main className="p-6 max-w-6xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-800 rounded w-48" />
          <div className="h-32 bg-slate-800 rounded-xl" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-48 bg-slate-800 rounded-xl" />
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
        <p className="text-slate-400 mb-6">Let's set up your profile to calculate your targets.</p>
        <a
          href="/setup"
          className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-500"
        >
          Get Started
        </a>
      </main>
    );
  }

  if (error || !plan) {
    return (
      <main className="p-6 max-w-6xl mx-auto">
        <div className="bg-red-950/30 border border-red-800/40 rounded-xl p-6">
          <h2 className="text-red-400 font-semibold">Error loading plan</h2>
          <p className="text-sm text-red-300/70 mt-1">{error}</p>
          <button
            onClick={fetchPlan}
            className="mt-3 text-sm text-red-400 hover:text-red-300 underline"
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  // Find next unfilled slot for suggestion banner
  const nextSlot = DEFAULT_SLOTS.find(
    (s) => !plan.mealsBySlot[s]?.length && !plan.skippedSlots.includes(s),
  );

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const DAY_TYPE_LABELS: Record<string, string> = {
    rest: "Rest Day",
    easy_run: "Easy Run",
    hard_run: "Hard Run",
    long_run: "Long Run",
    gym: "Gym Day",
    gym_and_run: "Gym + Run",
  };

  return (
    <main className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">{today}</p>
        <div className="flex items-center gap-3">
          <span className="text-xs px-2.5 py-1.5 rounded-full bg-slate-800 text-slate-300">
            {DAY_TYPE_LABELS[plan.trainingDayType] ?? plan.trainingDayType}
          </span>
          <span className="text-xs text-slate-400">{plan.weightKg.toFixed(1)} kg</span>
        </div>
      </div>

      {/* Macro Rings */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-300">Today's Macros</h2>
          <span className="text-xs text-emerald-400 font-medium">
            {plan.pctComplete}% of daily goal
          </span>
        </div>

        <div className="flex justify-center gap-6 md:gap-12 flex-wrap">
          <MacroRing
            label="Calories"
            current={plan.eaten.calories}
            target={plan.targets.calories}
            unit=" kcal"
            color="#3B82F6"
            size={110}
          />
          <MacroRing
            label="Protein"
            current={plan.eaten.protein}
            target={plan.targets.protein}
            unit="g"
            color="#EF4444"
            size={110}
          />
          <MacroRing
            label="Carbs"
            current={plan.eaten.carbs}
            target={plan.targets.carbs}
            unit="g"
            color="#F59E0B"
            size={110}
          />
          <MacroRing
            label="Fat"
            current={plan.eaten.fat}
            target={plan.targets.fat}
            unit="g"
            color="#10B981"
            size={110}
          />
        </div>

        <p className="text-center text-xs text-slate-500 mt-4">
          Remaining: {plan.remaining.calories} kcal | {plan.remaining.protein}g P | {plan.remaining.carbs}g C | {plan.remaining.fat}g F
        </p>
      </div>

      {/* Suggestion Banner */}
      <SuggestionBanner remaining={plan.remaining} nextSlot={nextSlot ?? null} />

      {/* Meal Slots */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {DEFAULT_SLOTS.map((slot) => {
          const budget = plan.slotBudgets.find((b) => b.slot === slot) ?? {
            slot,
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0,
          };
          const items = (plan.mealsBySlot[slot] ?? []) as Array<{
            id: number;
            food_name: string;
            grams: number | null;
            calories: number;
            protein: number;
            carbs: number;
            fat: number;
          }>;

          return (
            <MealSlotCard
              key={slot}
              slot={slot}
              budget={budget}
              items={items}
              isSkipped={plan.skippedSlots.includes(slot)}
              onAddClick={(s) => {
                window.location.href = `/log?slot=${s}`;
              }}
            />
          );
        })}
      </div>

      {/* TDEE Breakdown */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
        <h2 className="text-sm font-semibold text-slate-300 mb-3">TDEE Breakdown</h2>
        <div className="space-y-2">
          {[
            { label: "BMR", value: plan.tdee.bmr, color: "#94A3B8", always: true },
            { label: "Steps", value: plan.tdee.stepCalories, color: "#10B981", always: false },
            { label: "Exercise", value: plan.tdee.runCalories + plan.tdee.gymCalories, color: "#F59E0B", always: false },
            { label: "Deficit", value: -plan.tdee.deficit, color: "#EF4444", always: true },
          ]
            .filter(({ value, always }) => always || value > 0)
            .map(({ label, value, color }) => (
            <div key={label} className="flex items-center gap-3">
              <div
                className="h-4 rounded"
                style={{
                  width: `${Math.max((Math.abs(value) / plan.tdee.total) * 100, 5)}%`,
                  backgroundColor: color,
                  maxWidth: "60%",
                }}
              />
              <span className="text-xs text-slate-400">{label}</span>
              <span className="text-xs font-medium ml-auto" style={{ color }}>
                {Math.round(value)} kcal
              </span>
            </div>
          ))}
          <div className="border-t border-slate-800 pt-2 mt-2 flex justify-between">
            <span className="text-xs text-slate-400">Target</span>
            <span className="text-xs font-semibold text-blue-400">
              {plan.tdee.targetCalories} kcal/day
            </span>
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex justify-between text-[11px] text-slate-500 px-1">
        <span>TDEE: {Math.round(plan.tdee.total)} kcal</span>
        {plan.drinkCalories > 0 && (
          <span className="text-amber-600">Alcohol offset: -{plan.drinkCalories} kcal</span>
        )}
        <span>{plan.date}</span>
      </div>
    </main>
  );
}

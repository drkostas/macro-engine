"use client";

import { useState } from "react";
import type { MacroTargets } from "@/lib/macro-engine";
import type { Ingredient } from "@/lib/portion-solver";
import { MealComposer } from "./meal-composer";
import type { PresetMeal } from "./ingredient-picker";

interface MealItem {
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
  }>;
}

interface MealSlotCardProps {
  slot: string;
  budget: MacroTargets;
  items: MealItem[];
  isSkipped: boolean;
  date: string;
  ingredients: Ingredient[];
  presets: PresetMeal[];
  onMealLogged: () => void;
  onDeleteItem?: (id: number) => void;
  onSkipSlot?: () => void;
  onTotalsPreview?: (totals: { calories: number; protein: number; carbs: number; fat: number }) => void;
  onRebalanced?: (changes: Array<{ slot: string; ingredient: string; from: number; to: number }>) => void;
}

const SLOT_COLORS: Record<string, string> = {
  breakfast: "#F59E0B",
  lunch: "#3B82F6",
  dinner: "#8B5CF6",
  pre_sleep: "#6366F1",
};

const SLOT_LABELS: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  pre_sleep: "Pre-Sleep",
};

function humanize(id: string) {
  return id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function MealSlotCard({
  slot, budget, items, isSkipped, date, ingredients, presets,
  onMealLogged, onDeleteItem, onSkipSlot, onTotalsPreview, onRebalanced,
}: MealSlotCardProps) {
  const [expanded, setExpanded] = useState(false);
  const color = SLOT_COLORS[slot] ?? "#64748B";
  const label = SLOT_LABELS[slot] ?? slot;
  const hasItems = items.length > 0;

  const totalCal = items.reduce((s, i) => s + (i.calories ?? 0), 0);
  const totalP = items.reduce((s, i) => s + (i.protein ?? 0), 0);

  if (isSkipped) {
    return (
      <div className="bg-slate-900/50 rounded-xl border border-slate-800/50 p-4 opacity-50">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-slate-500">{label}</span>
          <div className="flex gap-2 items-center">
            <span className="text-xs text-slate-600">Skipped</span>
            {onSkipSlot && (
              <button onClick={onSkipSlot} className="text-[10px] text-slate-500 hover:text-slate-300 underline">
                Undo
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
      {/* Header - clickable to expand */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2.5 flex justify-between items-center"
        style={{ backgroundColor: `${color}20` }}
      >
        <span className="text-sm font-semibold" style={{ color }}>{label}</span>
        <div className="flex items-center gap-2">
          {hasItems ? (
            <span className="text-xs text-slate-300 font-medium">
              {Math.round(totalCal)} kcal | {Math.round(totalP)}g P
            </span>
          ) : (
            <span className="text-xs text-slate-500">
              {budget.calories} kcal budget
            </span>
          )}
          <span className="text-xs text-slate-500">{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {/* Content area */}
      <div className="p-3 space-y-2">
        {/* Logged items */}
        {items.map((meal) => {
          const mealIngredients = meal.items ?? [];
          return (
            <div key={meal.id} className="space-y-0.5">
              {mealIngredients.length > 0 ? (
                mealIngredients.map((ing, idx) => {
                  const name = ing.name || humanize(ing.ingredient_id || "");
                  return (
                    <div key={idx} className="flex items-center justify-between bg-slate-950/40 rounded-md px-3 py-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm text-slate-200 truncate">{name}</span>
                        {ing.grams && <span className="text-xs text-slate-500 shrink-0">{ing.grams}g</span>}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-slate-400">{Math.round(ing.calories ?? 0)}</span>
                        <span className="text-xs text-slate-500 w-8 text-right">{Math.round(ing.protein ?? 0)}P</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex items-center justify-between bg-slate-950/40 rounded-md px-3 py-1.5">
                  <span className="text-sm text-slate-200 truncate">{meal.food_name}</span>
                  <span className="text-xs text-slate-400">{Math.round(meal.calories)} kcal</span>
                </div>
              )}
              {onDeleteItem && (
                <button
                  onClick={() => onDeleteItem(meal.id)}
                  className="text-[10px] text-slate-600 hover:text-red-400 transition-colors px-3"
                >
                  remove
                </button>
              )}
            </div>
          );
        })}

        {/* Empty state with budget */}
        {!hasItems && !expanded && budget.calories > 0 && (
          <p className="text-xs text-slate-500 text-center py-1">
            {budget.protein}g P | {budget.carbs}g C | {budget.fat}g F
          </p>
        )}

        {/* Inline composer when expanded */}
        {expanded ? (
          <MealComposer
            slot={slot}
            slotLabel={label}
            budget={budget}
            date={date}
            ingredients={ingredients}
            presets={presets}
            onMealLogged={() => {
              setExpanded(false);
              onMealLogged();
            }}
            onCancel={() => setExpanded(false)}
            onTotalsPreview={onTotalsPreview}
            onRebalanced={onRebalanced}
          />
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setExpanded(true)}
              className="flex-1 py-3 text-xs font-medium rounded-lg border border-dashed border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors"
            >
              + Compose meal
            </button>
            {!hasItems && onSkipSlot && (
              <button
                onClick={onSkipSlot}
                className="px-3 py-3 text-xs text-slate-600 hover:text-slate-400 transition-colors"
              >
                Skip
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

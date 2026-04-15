"use client";

import { useState } from "react";
import { computeItemMacros, type Ingredient as SolverIng } from "@/lib/portion-solver";
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
    carbs?: number;
    fat?: number;
    fiber?: number;
  }>;
}

interface MealSlotCardProps {
  slot: string;
  budget: MacroTargets;
  items: MealItem[];
  plannedItems?: MealItem[];
  isSkipped: boolean;
  date: string;
  isFuture?: boolean;
  ingredients: Ingredient[];
  presets: PresetMeal[];
  onMealLogged: () => void;
  onDeleteItem?: (id: number) => void;
  onSkipSlot?: () => void;
  onTotalsPreview?: (totals: { calories: number; protein: number; carbs: number; fat: number; fiber?: number }) => void;
  onRebalanced?: (changes: Array<{ slot: string; ingredient: string; from: number; to: number }>) => void;
  onRelogMeal?: (meal: MealItem) => void;
  recentIds?: string[];
  recentMeals?: Array<Record<string, unknown>>;
}

const SLOT_ICONS: Record<string, string> = {
  breakfast: "☀",
  lunch: "◔",
  dinner: "◑",
  pre_sleep: "☾",
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
  slot, budget, items, plannedItems = [], isSkipped, date, isFuture = false,
  ingredients, presets,
  onMealLogged, onDeleteItem, onSkipSlot, onTotalsPreview, onRebalanced, onRelogMeal,
  recentIds = [], recentMeals = [],
}: MealSlotCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editingMealId, setEditingMealId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<Record<string, number>>({});
  const icon = SLOT_ICONS[slot] ?? "";
  const label = SLOT_LABELS[slot] ?? slot;
  const hasItems = items.length > 0;

  const totalCal = items.reduce((s, i) => s + (i.calories ?? 0), 0);
  const totalP = items.reduce((s, i) => s + (i.protein ?? 0), 0);

  const startEdit = (meal: MealItem) => {
    setEditingMealId(meal.id);
    const draft: Record<string, number> = {};
    for (const it of (meal.items ?? [])) {
      const key = it.ingredient_id || it.name || "";
      draft[key] = Math.round(it.grams ?? 0);
    }
    setEditDraft(draft);
  };

  const cancelEdit = () => {
    setEditingMealId(null);
    setEditDraft({});
  };

  const saveEdit = async (meal: MealItem) => {
    const updatedItems = (meal.items ?? []).map((it) => {
      const key = it.ingredient_id || it.name || "";
      const newGrams = editDraft[key] ?? Math.round(it.grams ?? 0);
      const ing = ingredients.find((i) => i.id === it.ingredient_id) as SolverIng | undefined;
      if (ing && newGrams > 0) {
        const macros = computeItemMacros(ing, newGrams);
        return {
          ...it,
          grams: newGrams,
          calories: Math.round(macros.calories),
          protein: Math.round(macros.protein * 10) / 10,
          carbs: Math.round(macros.carbs * 10) / 10,
          fat: Math.round(macros.fat * 10) / 10,
          fiber: Math.round(macros.fiber * 10) / 10,
        };
      }
      // No matching ingredient in lib - scale linearly
      const ratio = newGrams / Math.max(1, it.grams ?? newGrams);
      return {
        ...it,
        grams: newGrams,
        calories: Math.round((it.calories ?? 0) * ratio),
        protein: Math.round(((it.protein ?? 0) * ratio) * 10) / 10,
        carbs: Math.round(((it.carbs ?? 0) * ratio) * 10) / 10,
        fat: Math.round(((it.fat ?? 0) * ratio) * 10) / 10,
        fiber: Math.round(((it.fiber ?? 0) * ratio) * 10) / 10,
      };
    }).filter((it) => (it.grams ?? 0) > 0);

    try {
      await fetch("/api/nutrition/log-meal", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: meal.id, items: updatedItems }),
      });
      setEditingMealId(null);
      setEditDraft({});
      onMealLogged();
    } catch { /* ignore */ }
  };

  const relogMeal = async (meal: MealItem) => {
    if (onRelogMeal) {
      onRelogMeal(meal);
      return;
    }
    // Direct re-log: POST the same items to log-meal
    const mealItems = meal.items ?? [];
    if (mealItems.length === 0) return;
    try {
      await fetch("/api/nutrition/log-meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date, meal_slot: slot, source: "relog",
          items: mealItems,
        }),
      });
      onMealLogged();
    } catch { /* ignore */ }
  };

  if (isSkipped) {
    return (
      <div className="bg-surface/50 rounded-2xl border border-border/50 p-4 opacity-50">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-text-muted">{label}</span>
          <div className="flex gap-2 items-center">
            <span className="text-xs text-text-faint">Skipped</span>
            {onSkipSlot && (
              <button onClick={onSkipSlot} className="text-xs text-text-muted hover:text-text underline py-1">
                Undo
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-2xl border border-border overflow-hidden">
      {/* Header - clickable to expand */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex justify-between items-center min-h-[52px] border-b border-border-subtle hover:bg-surface-elevated/30 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-lg text-text-muted">{icon}</span>
          <span className="t-title text-text">{label}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="t-caption text-text-muted tnum">
            {hasItems
              ? `${Math.round(totalCal)} kcal · ${Math.round(totalP)}P`
              : `${budget.calories} kcal`}
          </span>
          <span className="t-caption text-text-faint w-3 text-center">{expanded ? "−" : "+"}</span>
        </div>
      </button>

      {/* Content area */}
      <div className="p-3 space-y-2">
        {/* Logged items */}
        {items.map((meal) => {
          // Defensive: meal.items should be jsonb array, but guard against
          // legacy rows where it may have been stored as a stringified string.
          const mealIngredients = Array.isArray(meal.items) ? meal.items : [];
          return (
            <div key={meal.id} className="space-y-0.5">
              {mealIngredients.length > 0 ? (
                mealIngredients.map((ing, idx) => {
                  const name = ing.name || humanize(ing.ingredient_id || "");
                  const key = ing.ingredient_id || ing.name || String(idx);
                  const isEditing = editingMealId === meal.id;
                  const displayGrams = isEditing ? (editDraft[key] ?? Math.round(ing.grams ?? 0)) : Math.round(ing.grams ?? 0);
                  return (
                    <div key={idx} className="bg-base/40 rounded-lg px-3 py-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="t-body text-text flex-1 min-w-0 truncate">{name}</span>
                        {isEditing ? (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => setEditDraft({ ...editDraft, [key]: Math.max(0, displayGrams - 10) })}
                              className="w-7 h-7 rounded-md bg-surface-elevated text-text-secondary hover:bg-surface-hover text-sm"
                            >−</button>
                            <input
                              type="number"
                              value={displayGrams}
                              onChange={(e) => setEditDraft({ ...editDraft, [key]: Math.max(0, Number(e.target.value) || 0) })}
                              className="w-14 bg-surface-elevated border border-border-glow rounded-md px-1 py-1 text-body text-text text-center tnum"
                            />
                            <span className="t-caption text-text-muted">g</span>
                            <button
                              onClick={() => setEditDraft({ ...editDraft, [key]: displayGrams + 10 })}
                              className="w-7 h-7 rounded-md bg-surface-elevated text-text-secondary hover:bg-surface-hover text-sm"
                            >+</button>
                          </div>
                        ) : (
                          <span className="t-caption text-text-muted tnum shrink-0">{displayGrams}g</span>
                        )}
                      </div>
                      {!isEditing && (
                        <div className="flex items-center gap-3 mt-1 t-micro tnum">
                          <span className="text-text-secondary">{Math.round(ing.calories ?? 0)} kcal</span>
                          <span className="text-text-faint">·</span>
                          <span className="text-warm">{Math.round(ing.protein ?? 0)}P</span>
                          <span className="text-indigo">{Math.round(ing.carbs ?? 0)}C</span>
                          <span className="text-lime">{Math.round(ing.fat ?? 0)}F</span>
                          {(ing.fiber ?? 0) > 0 && <span className="text-teal-light">{Math.round(ing.fiber!)}Fi</span>}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="flex items-center justify-between bg-base/50 rounded-md px-3 py-2 min-h-[40px]">
                  <span className="text-sm text-text truncate">{meal.food_name}</span>
                  <span className="text-xs text-text-secondary">{Math.round(meal.calories)} kcal</span>
                </div>
              )}
              {/* Meal actions */}
              <div className="flex items-center gap-2 px-3 py-1">
                {editingMealId === meal.id ? (
                  <>
                    <button
                      onClick={() => saveEdit(meal)}
                      className="t-caption text-teal hover:text-teal-light py-1 px-2 rounded-md bg-teal-bg hover:bg-teal-bg/80 font-medium"
                    >
                      Save
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="t-caption text-text-muted hover:text-text py-1 px-2 rounded-md"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    {meal.items && meal.items.length > 0 && (
                      <button
                        onClick={() => startEdit(meal)}
                        className="t-caption text-text-secondary hover:text-warm transition-colors py-0.5 px-2 rounded-md hover:bg-warm-bg"
                      >
                        ✎ Edit
                      </button>
                    )}
                    {meal.items && meal.items.length > 0 && (
                      <button
                        onClick={() => relogMeal(meal)}
                        className="t-caption text-text-secondary hover:text-teal transition-colors py-0.5 px-2 rounded-md hover:bg-teal-bg"
                      >
                        ↻ Eat again
                      </button>
                    )}
                    {onDeleteItem && (
                      <button
                        onClick={() => onDeleteItem(meal.id)}
                        className="t-caption text-text-muted hover:text-danger transition-colors py-0.5 px-2 rounded-md"
                      >
                        Remove
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}

        {/* Planned meals (ghost style) */}
        {plannedItems.length > 0 && plannedItems.map((pm) => (
          <div key={`planned-${pm.id}`} className="opacity-60 border border-dashed border-warm-dim/60 rounded-xl p-2 bg-warm-bg/20">
            <div className="flex items-center justify-between mb-1.5">
              <span className="t-caption text-warm">📅 Planned</span>
              <span className="t-caption tnum text-text-muted">
                {Math.round(pm.calories)} kcal
              </span>
            </div>
            {(pm.items ?? []).map((ing, idx) => {
              const name = ing.name || humanize(ing.ingredient_id || "");
              return (
                <div key={idx} className="flex items-center justify-between bg-base/30 rounded-md px-2.5 py-1 mb-1 last:mb-0">
                  <span className="t-body text-text-secondary truncate">{name}</span>
                  <span className="t-caption tnum text-text-muted shrink-0">{Math.round(ing.grams ?? 0)}g</span>
                </div>
              );
            })}
            <div className="flex items-center gap-2 mt-1.5 px-1">
              <button
                onClick={async () => {
                  await fetch("/api/nutrition/log-meal", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: pm.id, planned: false }),
                  });
                  onMealLogged();
                }}
                className="t-caption text-warm hover:text-warm-light font-medium py-0.5 px-2 rounded-md bg-warm-bg hover:bg-warm-bg/80"
              >
                ✓ Mark as eaten
              </button>
              {onDeleteItem && (
                <button
                  onClick={() => onDeleteItem(pm.id)}
                  className="t-caption text-text-muted hover:text-danger py-0.5 px-2 rounded-md"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Empty state: budget summary + mini macro bar */}
        {!hasItems && !expanded && budget.calories > 0 && (
          <div className="space-y-2 py-1">
            <p className="t-caption text-text-muted text-center tnum">
              {budget.protein}P · {budget.carbs}C · {budget.fat}F
              {(budget.fiber ?? 0) > 0 && <> · {budget.fiber}Fi</>}
            </p>
            <div className="flex h-1 rounded-full overflow-hidden mx-4">
              <div className="bg-warm" style={{ width: `${budget.calories > 0 ? (budget.protein * 4 / budget.calories) * 100 : 33}%` }} />
              <div className="bg-indigo" style={{ width: `${budget.calories > 0 ? (budget.carbs * 4 / budget.calories) * 100 : 33}%` }} />
              <div className="bg-lime" style={{ width: `${budget.calories > 0 ? (budget.fat * 9 / budget.calories) * 100 : 34}%` }} />
            </div>
          </div>
        )}

        {/* Recent meals quick-log (when slot is empty) */}
        {!hasItems && !expanded && recentMeals.length > 0 && (
          <div className="space-y-1">
            <p className="t-eyebrow">Recent</p>
            {recentMeals.slice(0, 3).map((rm, i) => {
              const items = rm.items as Array<Record<string, unknown>> ?? [];
              const names = items.map((it) => {
                const raw = String(it.name || it.ingredient_id || "");
                return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
              }).filter(Boolean);
              const summary = names.slice(0, 2).join(", ") + (names.length > 2 ? ` +${names.length - 2}` : "");
              return (
                <button
                  key={i}
                  onClick={async () => {
                    try {
                      await fetch("/api/nutrition/log-meal", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ date, meal_slot: slot, source: "recent", items }),
                      });
                      onMealLogged();
                    } catch { /* ignore */ }
                  }}
                  className="w-full flex items-center justify-between bg-base/30 hover:bg-surface-elevated/50 rounded-lg px-3 py-2 text-left transition-colors min-h-[40px]"
                >
                  <span className="text-xs text-text truncate">{summary}</span>
                  <span className="text-[10px] text-text-muted shrink-0 ml-2">{Number(rm.calories)} kcal</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Inline composer when expanded */}
        {expanded ? (
          <MealComposer
            slot={slot}
            slotLabel={label}
            budget={budget}
            date={date}
            isFuture={isFuture}
            ingredients={ingredients}
            presets={presets}
            recentIds={recentIds}
            onMealLogged={() => {
              setExpanded(false);
              onMealLogged();
            }}
            onCancel={() => {
              setExpanded(false);
              onTotalsPreview?.({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
            }}
            onTotalsPreview={onTotalsPreview}
            onRebalanced={onRebalanced}
          />
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setExpanded(true)}
              className={`flex-1 py-3 t-body font-medium rounded-xl transition-colors min-h-[44px] ${
                hasItems
                  ? "border border-border-glow text-text-secondary hover:text-text hover:bg-surface-elevated/40"
                  : "bg-warm/15 border border-warm/30 text-warm hover:bg-warm/25"
              }`}
            >
              {hasItems ? "+ Add more" : `Log ${label}`}
            </button>
            {!hasItems && onSkipSlot && (
              <button
                onClick={onSkipSlot}
                className="px-4 py-3 t-caption text-text-faint hover:text-text-secondary transition-colors min-h-[44px]"
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

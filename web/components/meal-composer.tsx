"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { Ingredient } from "@/lib/portion-solver";
import { solvePortions, computeItemMacros } from "@/lib/portion-solver";
import { autoCategorizeFood } from "@/lib/auto-categorize";
import { IngredientPicker, type PresetMeal } from "./ingredient-picker";
import { CompositionView, type PortionEntry } from "./composition-view";

interface MealComposerProps {
  slot: string;
  slotLabel: string;
  budget: { calories: number; protein: number; carbs: number; fat: number };
  date: string;
  ingredients: Ingredient[];
  presets: PresetMeal[];
  onMealLogged: () => void;
  onCancel: () => void;
  /** Live preview callback -- fires as portions change so dashboard rings update */
  onTotalsPreview?: (totals: { calories: number; protein: number; carbs: number; fat: number }) => void;
}

export function MealComposer({
  slot, slotLabel, budget, date, ingredients, presets, onMealLogged, onCancel, onTotalsPreview,
}: MealComposerProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [portions, setPortions] = useState<PortionEntry[]>([]);
  const [logging, setLogging] = useState(false);
  const [phase, setPhase] = useState<"pick" | "compose">("pick");

  // Filter presets for this slot
  const slotPresets = presets.filter(
    (p) => !p.tags?.length || p.tags.includes(slot),
  );

  // When selection changes and we have items, run the solver
  const runSolver = useCallback(
    (selectedIngs: Ingredient[]) => {
      if (selectedIngs.length === 0) {
        setPortions([]);
        return;
      }
      const target = {
        calories: budget.calories,
        protein: budget.protein,
        carbs: budget.carbs,
        fat: budget.fat,
        fiber: 0,
      };
      const solved = solvePortions(selectedIngs, target);
      const entries: PortionEntry[] = solved.map((s) => ({
        ingredient: selectedIngs.find((i) => i.id === s.ingredient_id)!,
        grams: s.grams,
      })).filter((e) => e.ingredient);
      setPortions(entries);
      setPhase("compose");
    },
    [budget],
  );

  // Toggle ingredient (just toggle selection, don't run solver yet)
  const handleToggle = useCallback(
    (ing: Ingredient) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(ing.id)) {
          next.delete(ing.id);
        } else {
          next.add(ing.id);
        }
        return next;
      });
    },
    [],
  );

  // Track USDA foods added as temporary ingredients
  const [tempIngredients, setTempIngredients] = useState<Ingredient[]>([]);

  // Add USDA food as a one-time ingredient (just add to selection, solver runs on "Compose")
  const handleAddUsda = useCallback(
    (food: { id: number; name: string; calories: number; protein: number; carbs: number; fat: number; fiber: number | null }) => {
      const category = autoCategorizeFood({
        calories: food.calories, protein: food.protein,
        carbs: food.carbs, fat: food.fat, fiber: food.fiber ?? 0,
      });
      const ing: Ingredient = {
        id: `usda_${food.id}`,
        name: food.name,
        calories_per_100g: food.calories,
        protein_per_100g: food.protein,
        carbs_per_100g: food.carbs,
        fat_per_100g: food.fat,
        fiber_per_100g: food.fiber ?? 0,
        category,
      };
      setTempIngredients((prev) => [...prev.filter((t) => t.id !== ing.id), ing]);
      setSelected((prev) => new Set([...prev, ing.id]));
    },
    [],
  );

  // Load preset
  const handleLoadPreset = useCallback(
    (preset: PresetMeal) => {
      const presetItems = (preset.items as Record<string, unknown>)?.items as Array<{ ingredient_id: string; grams: number }> | undefined;
      if (!presetItems?.length) return;

      const entries: PortionEntry[] = [];
      const ids = new Set<string>();
      for (const item of presetItems) {
        const ing = ingredients.find((i) => i.id === item.ingredient_id);
        if (ing) {
          entries.push({ ingredient: ing, grams: item.grams });
          ids.add(ing.id);
        }
      }
      setSelected(ids);
      setPortions(entries);
      setPhase("compose");
    },
    [ingredients],
  );

  // Portion change
  const handlePortionChange = useCallback((id: string, grams: number) => {
    setPortions((prev) => prev.map((p) => (p.ingredient.id === id ? { ...p, grams } : p)));
  }, []);

  // Remove ingredient
  const handleRemove = useCallback((id: string) => {
    setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
    setPortions((prev) => prev.filter((p) => p.ingredient.id !== id));
  }, []);

  // Live preview: send totals to parent whenever portions change
  // Use a ref for the callback to avoid dependency cycle
  const previewRef = useRef(onTotalsPreview);
  previewRef.current = onTotalsPreview;

  useEffect(() => {
    if (!previewRef.current) return;
    const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    for (const p of portions) {
      const m = computeItemMacros(p.ingredient, p.grams);
      totals.calories += m.calories;
      totals.protein += m.protein;
      totals.carbs += m.carbs;
      totals.fat += m.fat;
    }
    previewRef.current(totals);
  }, [portions]);

  // Log meal
  const handleLog = async () => {
    if (portions.length === 0) return;
    setLogging(true);

    const items = portions.map((p) => {
      const m = computeItemMacros(p.ingredient, p.grams);
      return {
        ingredient_id: p.ingredient.id,
        name: p.ingredient.name,
        grams: Math.round(p.grams),
        calories: Math.round(m.calories),
        protein: Math.round(m.protein * 10) / 10,
        carbs: Math.round(m.carbs * 10) / 10,
        fat: Math.round(m.fat * 10) / 10,
        fiber: Math.round(m.fiber * 10) / 10,
      };
    });

    try {
      const resp = await fetch("/api/nutrition/log-meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, meal_slot: slot, items }),
      });
      if (!resp.ok) throw new Error("Failed to log");
      onMealLogged();
    } catch {
      // Error handling in parent
    } finally {
      setLogging(false);
    }
  };

  // Save as preset
  const handleSavePreset = async () => {
    const items = portions.map((p) => ({
      ingredient_id: p.ingredient.id,
      grams: Math.round(p.grams),
    }));
    const totals = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
    for (const p of portions) {
      const m = computeItemMacros(p.ingredient, p.grams);
      totals.calories += m.calories;
      totals.protein += m.protein;
      totals.carbs += m.carbs;
      totals.fat += m.fat;
      totals.fiber += m.fiber;
    }
    const name = portions
      .slice(0, 3)
      .map((p) => p.ingredient.name)
      .join(", ");

    await fetch("/api/nutrition/presets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, items, slot, totals }),
    });
  };

  return (
    <div className="space-y-3 pt-2">
      {phase === "pick" ? (
        <IngredientPicker
          ingredients={ingredients}
          selected={selected}
          onToggle={handleToggle}
          onAddUsda={handleAddUsda}
          presets={slotPresets}
          onLoadPreset={handleLoadPreset}
        />
      ) : (
        <>
          {/* Back to picker */}
          <button
            onClick={() => setPhase("pick")}
            className="text-xs text-slate-500 hover:text-slate-300"
          >
            + Add more ingredients
          </button>
          <CompositionView
            portions={portions}
            budget={budget}
            onPortionChange={handlePortionChange}
            onRemove={handleRemove}
            onLog={handleLog}
            onSavePreset={handleSavePreset}
            onCancel={onCancel}
            logging={logging}
            slotLabel={slotLabel}
          />
        </>
      )}

      {/* Show "Compose meal" button when in pick phase with selections */}
      {phase === "pick" && selected.size > 0 && (
        <button
          onClick={() => {
            const allIngs = [
              ...ingredients.filter((i) => selected.has(i.id)),
              ...tempIngredients.filter((i) => selected.has(i.id)),
            ];
            runSolver(allIngs);
          }}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Compose meal ({selected.size} ingredients)
        </button>
      )}
    </div>
  );
}

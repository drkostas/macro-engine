"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { Ingredient } from "@/lib/portion-solver";
import { solvePortions, computeItemMacros } from "@/lib/portion-solver";
import { autoCategorizeFood } from "@/lib/auto-categorize";
import { IngredientPicker, type PresetMeal } from "./ingredient-picker";
import { CompositionView, type PortionEntry } from "./composition-view";
import { NLInput, type ParsedItem } from "./nl-input";

interface MealComposerProps {
  slot: string;
  slotLabel: string;
  budget: { calories: number; protein: number; carbs: number; fat: number };
  date: string;
  isFuture?: boolean;
  ingredients: Ingredient[];
  presets: PresetMeal[];
  onMealLogged: () => void;
  onCancel: () => void;
  onTotalsPreview?: (totals: { calories: number; protein: number; carbs: number; fat: number; fiber?: number }) => void;
  onRebalanced?: (changes: Array<{ slot: string; ingredient: string; from: number; to: number }>) => void;
  recentIds?: string[];
}

export function MealComposer({
  slot, slotLabel, budget, date, isFuture = false,
  ingredients, presets, onMealLogged, onCancel, onTotalsPreview, onRebalanced, recentIds,
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

  // Parse a free-text meal description into ingredients + portions, then jump to compose
  const handleNLItems = useCallback((parsed: ParsedItem[]) => {
    const newIngs: Ingredient[] = [];
    const newEntries: PortionEntry[] = [];
    const ids = new Set<string>();
    for (const p of parsed) {
      // Normalize per-100g from the parsed macros
      const scale = 100 / Math.max(1, p.grams);
      const category = autoCategorizeFood({
        calories: p.calories * scale,
        protein: p.protein * scale,
        carbs: p.carbs * scale,
        fat: p.fat * scale,
        fiber: (p.fiber ?? 0) * scale,
      });
      const id = `nl_${p.name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${Date.now()}`;
      const ing: Ingredient = {
        id,
        name: p.name,
        calories_per_100g: p.calories * scale,
        protein_per_100g: p.protein * scale,
        carbs_per_100g: p.carbs * scale,
        fat_per_100g: p.fat * scale,
        fiber_per_100g: (p.fiber ?? 0) * scale,
        category,
      };
      newIngs.push(ing);
      newEntries.push({ ingredient: ing, grams: p.grams });
      ids.add(id);
    }
    setTempIngredients((prev) => [...prev, ...newIngs]);
    setSelected((prev) => new Set([...prev, ...ids]));
    setPortions((prev) => [...prev, ...newEntries]);
    setPhase("compose");
  }, []);

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

  // Bulk scale all portions by factor (Linked mode)
  const handleBulkScale = useCallback((factor: number) => {
    setPortions((prev) => prev.map((p) => ({
      ...p,
      grams: Math.max(5, Math.round(p.grams * factor)),
    })));
  }, []);

  // Log meal
  const handleLog = async (opts?: { notes?: string; weigh_method?: string; planned?: boolean }) => {
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
        body: JSON.stringify({
          date, meal_slot: slot, items,
          notes: opts?.notes, weigh_method: opts?.weigh_method,
          planned: opts?.planned ?? false,
        }),
      });
      if (!resp.ok) throw new Error("Failed to log");

      // Trigger rebalancing
      try {
        const rebalResp = await fetch("/api/nutrition/rebalance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date, changedSlot: slot, lockedSlots: [] }),
        });
        const rebalData = await rebalResp.json();
        if (rebalData.changes?.length > 0 && onRebalanced) {
          onRebalanced(rebalData.changes);
        }
      } catch { /* rebalance is best-effort */ }

      onMealLogged();
    } catch {
      // Error handling in parent
    } finally {
      setLogging(false);
    }
  };

  // Save as preset with user-chosen name
  const handleSavePreset = async (name: string) => {
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

    await fetch("/api/nutrition/presets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, items, slot, totals }),
    });
  };

  return (
    <div className="space-y-3 pt-2">
      {phase === "pick" ? (
        <>
          <NLInput onItems={handleNLItems} />
          <IngredientPicker
            ingredients={ingredients}
            selected={selected}
            onToggle={handleToggle}
            onAddUsda={handleAddUsda}
            presets={slotPresets}
            onLoadPreset={handleLoadPreset}
            recentIds={recentIds}
          />
        </>
      ) : (
        <>
          {/* Back to picker */}
          <button
            onClick={() => setPhase("pick")}
            className="text-xs text-text-muted hover:text-text"
          >
            + Add more ingredients
          </button>
          <CompositionView
            portions={portions}
            budget={budget}
            isFuture={isFuture}
            onPortionChange={handlePortionChange}
            onRemove={handleRemove}
            onLog={handleLog}
            onSavePreset={handleSavePreset}
            onBulkScale={handleBulkScale}
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
          className="w-full bg-teal-dim hover:bg-teal text-white py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Compose meal ({selected.size} ingredients)
        </button>
      )}
    </div>
  );
}

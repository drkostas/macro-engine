"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { Ingredient } from "@/lib/portion-solver";
import { solvePortions, computeItemMacros } from "@/lib/portion-solver";
import { autoCategorizeFood } from "@/lib/auto-categorize";
import { IngredientPicker, type PresetMeal } from "./ingredient-picker";
import { CompositionView, type PortionEntry } from "./composition-view";
import { NLInput, type ParsedItem } from "./nl-input";
import { VariationStrip } from "./variation-strip";
import {
  createVariation,
  computeVariationMacros,
  type Variation,
} from "@/lib/variation-state";

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
  const [variations, setVariations] = useState<Variation[]>(() => [createVariation()]);
  const [activeId, setActiveId] = useState<string>(() => variations[0].id);
  const [logging, setLogging] = useState(false);
  const [phase, setPhase] = useState<"pick" | "compose">("pick");

  const active = variations.find((v) => v.id === activeId) ?? variations[0];

  // Helper to update the currently active variation.
  const updateActive = useCallback(
    (updater: (v: Variation) => Variation) => {
      setVariations((prev) => prev.map((v) => (v.id === activeId ? updater(v) : v)));
    },
    [activeId],
  );

  // Filter presets for this slot
  const slotPresets = presets.filter(
    (p) => !p.tags?.length || p.tags.includes(slot),
  );

  // When selection changes and we have items, run the solver
  const runSolver = useCallback(
    (selectedIngs: Ingredient[]) => {
      if (selectedIngs.length === 0) {
        updateActive((v) => ({ ...v, portions: [] }));
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
      updateActive((v) => ({ ...v, portions: entries }));
      setPhase("compose");
    },
    [budget, updateActive],
  );

  // Toggle ingredient (just toggle selection, don't run solver yet)
  const handleToggle = useCallback(
    (ing: Ingredient) => {
      updateActive((v) => {
        const next = new Set(v.selected);
        if (next.has(ing.id)) {
          next.delete(ing.id);
        } else {
          next.add(ing.id);
        }
        return { ...v, selected: next };
      });
    },
    [updateActive],
  );

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
    updateActive((v) => ({
      ...v,
      tempIngredients: [...v.tempIngredients, ...newIngs],
      selected: new Set([...v.selected, ...ids]),
      portions: [...v.portions, ...newEntries],
    }));
    setPhase("compose");
  }, [updateActive]);

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
      updateActive((v) => ({
        ...v,
        tempIngredients: [...v.tempIngredients.filter((t) => t.id !== ing.id), ing],
        selected: new Set([...v.selected, ing.id]),
      }));
    },
    [updateActive],
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
      updateActive((v) => ({
        ...v,
        selected: ids,
        portions: entries,
      }));
      setPhase("compose");
    },
    [ingredients, updateActive],
  );

  // Portion change
  const handlePortionChange = useCallback((id: string, grams: number) => {
    updateActive((v) => ({
      ...v,
      portions: v.portions.map((p) => (p.ingredient.id === id ? { ...p, grams } : p)),
    }));
  }, [updateActive]);

  // Remove ingredient
  const handleRemove = useCallback((id: string) => {
    updateActive((v) => ({
      ...v,
      selected: new Set([...v.selected].filter((s) => s !== id)),
      portions: v.portions.filter((p) => p.ingredient.id !== id),
    }));
  }, [updateActive]);

  // Live preview: send totals to parent whenever portions change
  // Use a ref for the callback to avoid dependency cycle
  const previewRef = useRef(onTotalsPreview);
  previewRef.current = onTotalsPreview;

  useEffect(() => {
    if (!previewRef.current) return;
    previewRef.current(computeVariationMacros(active));
  }, [variations, activeId, active]);

  // Solve active variation's portions against the slot's macro budget
  const handleSolve = useCallback(() => {
    if (active.portions.length === 0) return;
    const ings = active.portions.map((p) => p.ingredient);
    const solved = solvePortions(ings, {
      calories: budget.calories,
      protein: budget.protein,
      carbs: budget.carbs,
      fat: budget.fat,
      fiber: 0,
    });
    const entries: PortionEntry[] = solved
      .map((s) => ({
        ingredient: ings.find((i) => i.id === s.ingredient_id)!,
        grams: s.grams,
      }))
      .filter((e) => e.ingredient);
    updateActive((v) => ({ ...v, portions: entries }));
  }, [active, budget, updateActive]);

  // Bulk scale all portions by factor (Linked mode)
  const handleBulkScale = useCallback((factor: number) => {
    updateActive((v) => ({
      ...v,
      portions: v.portions.map((p) => ({
        ...p,
        grams: Math.max(5, Math.round(p.grams * factor)),
      })),
    }));
  }, [updateActive]);

  // Add a new variation and switch to it
  const handleAddVariation = useCallback(() => {
    const v = createVariation();
    setVariations((prev) => [...prev, v]);
    setActiveId(v.id);
    setPhase("pick");
  }, []);

  // Core log routine — works against any variation id
  const logVariation = async (
    v: Variation,
    opts?: { notes?: string; weigh_method?: string; planned?: boolean },
  ) => {
    if (v.portions.length === 0) return;
    setLogging(true);

    const items = v.portions.map((p) => {
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

  // Log the active variation (from CompositionView's Log button)
  const handleLog = (opts?: { notes?: string; weigh_method?: string; planned?: boolean }) => {
    return logVariation(active, opts);
  };

  // Log a variation by id (from VariationStrip's per-row Log button)
  const handleLogVariation = (id: string) => {
    const v = variations.find((x) => x.id === id);
    if (!v) return;
    return logVariation(v);
  };

  // Save as preset with user-chosen name (active variation's composition)
  const handleSavePreset = async (name: string) => {
    const items = active.portions.map((p) => ({
      ingredient_id: p.ingredient.id,
      grams: Math.round(p.grams),
    }));
    const totals = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
    for (const p of active.portions) {
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

  const stripMacros = new Map(variations.map((v) => [v.id, computeVariationMacros(v)]));

  return (
    <div className="space-y-3 pt-2">
      <VariationStrip
        variations={variations}
        activeId={activeId}
        macros={stripMacros}
        budget={budget}
        onSwitch={(id) => { setActiveId(id); setPhase("pick"); }}
        onLog={handleLogVariation}
        onAdd={handleAddVariation}
      />

      {phase === "pick" ? (
        <>
          <NLInput onItems={handleNLItems} />
          <IngredientPicker
            ingredients={ingredients}
            selected={active.selected}
            onToggle={handleToggle}
            onAddUsda={handleAddUsda}
            presets={slotPresets}
            onLoadPreset={handleLoadPreset}
            recentIds={recentIds}
          />
        </>
      ) : (
        <>
          {/* Editor header: back-to-picker + Solve to targets */}
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => setPhase("pick")}
              className="text-xs text-text-muted hover:text-text"
            >
              + Add more ingredients
            </button>
            {active.portions.length > 0 && (
              <button
                onClick={handleSolve}
                className="text-[11px] text-teal border border-teal rounded-md px-2 py-1 hover:bg-teal-bg transition-colors"
              >
                ⚖ Solve to targets
              </button>
            )}
          </div>
          <CompositionView
            portions={active.portions}
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
      {phase === "pick" && active.selected.size > 0 && (
        <button
          onClick={() => {
            const allIngs = [
              ...ingredients.filter((i) => active.selected.has(i.id)),
              ...active.tempIngredients.filter((i) => active.selected.has(i.id)),
            ];
            runSolver(allIngs);
          }}
          className="w-full bg-teal-dim hover:bg-teal text-white py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Compose meal ({active.selected.size} ingredients)
        </button>
      )}
    </div>
  );
}

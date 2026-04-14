"use client";

import { useCallback } from "react";
import type { Ingredient } from "@/lib/portion-solver";
import { computeItemMacros, isCountBased, gramsToCount, countToGrams } from "@/lib/portion-solver";
import { MacroPreviewBars } from "./macro-preview-bars";

export interface PortionEntry {
  ingredient: Ingredient;
  grams: number;
}

interface CompositionViewProps {
  portions: PortionEntry[];
  budget: { calories: number; protein: number; carbs: number; fat: number };
  onPortionChange: (id: string, grams: number) => void;
  onRemove: (id: string) => void;
  onLog: () => void;
  onSavePreset: () => void;
  onCancel: () => void;
  logging: boolean;
  slotLabel: string;
}

const INCREMENTS: Record<string, number> = {
  protein: 25, carbs: 10, vegetable: 25, fat: 5, dairy: 25,
  fruit: 25, sauce: 10, supplement: 5, other: 10,
};

export function CompositionView({
  portions, budget, onPortionChange, onRemove, onLog, onSavePreset, onCancel, logging, slotLabel,
}: CompositionViewProps) {
  // Compute meal totals
  const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  for (const p of portions) {
    const m = computeItemMacros(p.ingredient, p.grams);
    totals.calories += m.calories;
    totals.protein += m.protein;
    totals.carbs += m.carbs;
    totals.fat += m.fat;
  }

  const adjust = useCallback((id: string, delta: number) => {
    const entry = portions.find((p) => p.ingredient.id === id);
    if (!entry) return;
    const step = INCREMENTS[entry.ingredient.category] ?? 10;
    const newGrams = Math.max(5, entry.grams + delta * step);
    onPortionChange(id, newGrams);
  }, [portions, onPortionChange]);

  if (portions.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-xs text-slate-500">Select ingredients above to start composing.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Macro preview bars */}
      <MacroPreviewBars current={totals} budget={budget} />

      {/* Ingredient rows */}
      <div className="space-y-1">
        {portions.map(({ ingredient: ing, grams }) => {
          const macros = computeItemMacros(ing, grams);
          const countBased = isCountBased(ing);
          const displayCount = countBased ? gramsToCount(ing, grams) : null;
          const step = INCREMENTS[ing.category] ?? 10;

          return (
            <div key={ing.id} className="flex items-center gap-2 bg-slate-950/40 rounded-md px-2 py-1.5">
              {/* Name */}
              <span className="text-sm text-slate-200 truncate flex-1 min-w-0">
                {ing.name}
              </span>

              {/* Portion controls */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => adjust(ing.id, -1)}
                  className="w-6 h-6 rounded bg-slate-800 text-slate-400 hover:text-white text-xs flex items-center justify-center"
                >
                  -
                </button>
                <input
                  type="number"
                  value={countBased ? displayCount ?? 0 : grams}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    const newGrams = countBased ? countToGrams(ing, val) : val;
                    onPortionChange(ing.id, Math.max(5, newGrams));
                  }}
                  className="w-14 bg-slate-800 border border-slate-700 rounded text-center text-xs py-1"
                />
                <span className="text-[10px] text-slate-500 w-4">
                  {countBased ? ing.unit : "g"}
                </span>
                <button
                  onClick={() => adjust(ing.id, 1)}
                  className="w-6 h-6 rounded bg-slate-800 text-slate-400 hover:text-white text-xs flex items-center justify-center"
                >
                  +
                </button>
              </div>

              {/* Per-item macros */}
              <span className="text-[10px] text-slate-500 w-10 text-right shrink-0">
                {Math.round(macros.calories)}
              </span>
              <span className="text-[10px] text-slate-400 w-8 text-right shrink-0">
                {Math.round(macros.protein)}P
              </span>

              {/* Remove */}
              <button
                onClick={() => onRemove(ing.id)}
                className="text-slate-600 hover:text-red-400 text-xs shrink-0"
              >
                x
              </button>
            </div>
          );
        })}
      </div>

      {/* Totals summary */}
      <div className="flex justify-between text-xs bg-slate-800/50 rounded-md px-3 py-2">
        <span className="text-slate-400">Meal total</span>
        <span className="text-slate-200 font-medium">
          {Math.round(totals.calories)} kcal | {Math.round(totals.protein)}P | {Math.round(totals.carbs)}C | {Math.round(totals.fat)}F
        </span>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onLog}
          disabled={logging || portions.length === 0}
          className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
        >
          {logging ? "Logging..." : `Log to ${slotLabel}`}
        </button>
        <button
          onClick={onSavePreset}
          className="px-3 py-2.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-700 rounded-lg transition-colors"
        >
          Save Preset
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-2.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

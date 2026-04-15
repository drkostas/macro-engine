"use client";

import { useCallback, useState } from "react";
import type { Ingredient } from "@/lib/portion-solver";
import { computeItemMacros, isCountBased, gramsToCount, countToGrams } from "@/lib/portion-solver";
import { MacroPreviewBars } from "./macro-preview-bars";
import { InfoTip } from "./info-tip";

export interface PortionEntry {
  ingredient: Ingredient;
  grams: number;
}

interface CompositionViewProps {
  portions: PortionEntry[];
  budget: { calories: number; protein: number; carbs: number; fat: number };
  isFuture?: boolean;
  onPortionChange: (id: string, grams: number) => void;
  onRemove: (id: string) => void;
  onLog: (opts?: { notes?: string; weigh_method?: string; planned?: boolean }) => void;
  onSavePreset: (name: string) => void;
  onCancel: () => void;
  onBulkScale?: (factor: number) => void;
  logging: boolean;
  slotLabel: string;
}

const INCREMENTS: Record<string, number> = {
  protein: 25, carbs: 10, vegetable: 25, fat: 5, dairy: 25,
  fruit: 25, sauce: 10, supplement: 5, other: 10,
};

export function CompositionView({
  portions, budget, isFuture = false,
  onPortionChange, onRemove, onLog, onSavePreset, onCancel, onBulkScale,
  logging, slotLabel,
}: CompositionViewProps) {
  const [linked, setLinked] = useState(true);
  const [weighMethod, setWeighMethod] = useState<"raw" | "cooked" | "">("");
  const [notes, setNotes] = useState("");
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [presetName, setPresetName] = useState("");

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

    if (linked && onBulkScale) {
      // Linked mode: scale all portions proportionally
      const factor = newGrams / entry.grams;
      onBulkScale(factor);
    } else {
      onPortionChange(id, newGrams);
    }
  }, [portions, onPortionChange, onBulkScale, linked]);

  const handleInputChange = useCallback((id: string, newGrams: number) => {
    const entry = portions.find((p) => p.ingredient.id === id);
    if (!entry) return;
    if (linked && onBulkScale && entry.grams > 0) {
      onBulkScale(newGrams / entry.grams);
    } else {
      onPortionChange(id, newGrams);
    }
  }, [portions, onPortionChange, onBulkScale, linked]);

  if (portions.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-xs text-text-muted">Select ingredients above to start composing.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Macro preview bars */}
      <MacroPreviewBars current={totals} budget={budget} />

      {/* Mode toggle row */}
      <div className="flex items-center justify-between gap-2 px-1">
        <button
          onClick={() => setLinked(!linked)}
          className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-full font-medium transition-colors ${
            linked
              ? "bg-warm-bg border border-warm-dim text-warm"
              : "bg-transparent border border-border-glow text-text-muted"
          }`}
          title={linked ? "Portions scale together" : "Adjust each independently"}
        >
          {linked ? "🔗 Linked" : "⚡ Free"}
          <InfoTip text="Linked: changing one portion scales all others proportionally (keeps composition). Free: adjust each ingredient independently." />
        </button>

        {/* Weigh method selector */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-text-muted">Weighed:</span>
          {(["raw", "cooked"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setWeighMethod(weighMethod === m ? "" : m)}
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors ${
                weighMethod === m
                  ? "bg-teal-bg border border-teal-dim text-teal"
                  : "bg-transparent border border-border-glow text-text-muted"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Ingredient rows */}
      <div className="space-y-1">
        {portions.map(({ ingredient: ing, grams }) => {
          const macros = computeItemMacros(ing, grams);
          const countBased = isCountBased(ing);
          const displayCount = countBased ? gramsToCount(ing, grams) : null;

          return (
            <div key={ing.id} className="flex items-center gap-2 bg-base/50 rounded-md px-2 py-1.5">
              <span className="text-sm text-text truncate flex-1 min-w-0">{ing.name}</span>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => adjust(ing.id, -1)}
                  className="w-6 h-6 rounded bg-surface-elevated text-text-secondary hover:text-white text-xs flex items-center justify-center"
                >-</button>
                <input
                  type="number"
                  value={countBased ? displayCount ?? 0 : grams}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    const newGrams = countBased ? countToGrams(ing, val) : val;
                    handleInputChange(ing.id, Math.max(5, newGrams));
                  }}
                  className="w-14 bg-surface-elevated border border-border-glow rounded text-center text-xs py-1"
                />
                <span className="text-[10px] text-text-muted w-4">
                  {countBased ? ing.unit : "g"}
                </span>
                <button
                  onClick={() => adjust(ing.id, 1)}
                  className="w-6 h-6 rounded bg-surface-elevated text-text-secondary hover:text-white text-xs flex items-center justify-center"
                >+</button>
              </div>

              <span className="text-[10px] text-text-muted w-10 text-right shrink-0">{Math.round(macros.calories)}</span>
              <span className="text-[10px] text-warm w-8 text-right shrink-0">{Math.round(macros.protein)}P</span>

              <button
                onClick={() => onRemove(ing.id)}
                className="text-text-faint hover:text-danger text-xs shrink-0"
              >x</button>
            </div>
          );
        })}
      </div>

      {/* Notes field */}
      <div>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional: e.g. 'rushed', 'ate out', 'hungry')"
          className="w-full bg-surface-elevated/50 border border-border rounded-md px-3 py-1.5 text-xs text-text placeholder-text-faint focus:outline-none focus:border-teal-dim"
          maxLength={200}
        />
      </div>

      {/* Totals */}
      <div className="flex justify-between text-xs bg-surface-elevated/50 rounded-md px-3 py-2">
        <span className="text-text-secondary">Meal total</span>
        <span className="text-text font-medium">
          {Math.round(totals.calories)} kcal
          <span className="text-warm ml-1">{Math.round(totals.protein)}P</span>
          <span className="text-indigo ml-1">{Math.round(totals.carbs)}C</span>
          <span className="text-lime ml-1">{Math.round(totals.fat)}F</span>
        </span>
      </div>

      {/* Save preset prompt */}
      {showSavePrompt && (
        <div className="flex gap-2 items-center bg-warm-bg/50 border border-warm-dim rounded-lg p-2">
          <input
            type="text"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder="Preset name"
            className="flex-1 bg-surface-elevated border border-border-glow rounded-md px-2 py-1.5 text-xs text-text focus:outline-none focus:border-warm"
            autoFocus
          />
          <button
            onClick={() => {
              if (presetName.trim()) {
                onSavePreset(presetName.trim());
                setShowSavePrompt(false);
                setPresetName("");
              }
            }}
            className="text-xs bg-warm hover:bg-warm-light text-white px-3 py-1.5 rounded-md font-medium"
          >
            Save
          </button>
          <button
            onClick={() => { setShowSavePrompt(false); setPresetName(""); }}
            className="text-xs text-text-muted hover:text-text px-2"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {isFuture ? (
          <button
            onClick={() => onLog({ notes: notes || undefined, weigh_method: weighMethod || undefined, planned: true })}
            disabled={logging || portions.length === 0}
            className="flex-1 bg-warm hover:bg-warm-light text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {logging ? "Planning..." : `📅 Plan ${slotLabel}`}
          </button>
        ) : (
          <button
            onClick={() => onLog({ notes: notes || undefined, weigh_method: weighMethod || undefined })}
            disabled={logging || portions.length === 0}
            className="flex-1 bg-teal-dim hover:bg-teal text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {logging ? "Logging..." : `Log to ${slotLabel}`}
          </button>
        )}
        {!showSavePrompt && (
          <button
            onClick={() => {
              const suggested = portions.slice(0, 3).map((p) => p.ingredient.name).join(" + ");
              setPresetName(suggested);
              setShowSavePrompt(true);
            }}
            className="px-3 py-2.5 text-xs text-warm border border-warm-dim rounded-lg hover:bg-warm-bg transition-colors"
          >
            Save Preset
          </button>
        )}
        <button
          onClick={onCancel}
          className="px-3 py-2.5 text-xs text-text-muted hover:text-text transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

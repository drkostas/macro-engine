"use client";

import type { MacroTargets } from "@/lib/macro-engine";

interface MealItem {
  id: number;
  food_name: string;
  grams: number | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface MealSlotCardProps {
  slot: string;
  budget: MacroTargets;
  items: MealItem[];
  isSkipped: boolean;
  onAddClick: (slot: string) => void;
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

export function MealSlotCard({ slot, budget, items, isSkipped, onAddClick }: MealSlotCardProps) {
  const color = SLOT_COLORS[slot] ?? "#64748B";
  const label = SLOT_LABELS[slot] ?? slot;
  const hasItems = items.length > 0;

  const totalCal = items.reduce((s, i) => s + i.calories, 0);
  const totalP = items.reduce((s, i) => s + i.protein, 0);

  if (isSkipped) {
    return (
      <div className="bg-slate-900/50 rounded-xl border border-slate-800/50 p-4 opacity-50">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-slate-500">{label}</span>
          <span className="text-xs text-slate-600">Skipped</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
      {/* Header */}
      <div
        className="px-4 py-2.5 flex justify-between items-center"
        style={{ backgroundColor: `${color}20` }}
      >
        <span className="text-sm font-semibold" style={{ color }}>{label}</span>
        {hasItems ? (
          <span className="text-xs text-slate-300">
            {totalCal} kcal | {Math.round(totalP)}g P
          </span>
        ) : (
          <span className="text-xs text-slate-500">
            Budget: {budget.calories} kcal
          </span>
        )}
      </div>

      {/* Items */}
      <div className="p-3 space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex justify-between items-center bg-slate-950/60 rounded-lg px-3 py-2"
          >
            <div>
              <p className="text-sm text-slate-200">{item.food_name}</p>
              <p className="text-[11px] text-slate-500">
                {item.grams ? `${item.grams}g` : ""} {item.calories} kcal
              </p>
            </div>
            <span className="text-xs text-slate-400 font-medium">
              {Math.round(item.protein)}g P
            </span>
          </div>
        ))}

        {!hasItems && (
          <div className="text-center py-3">
            <p className="text-xs text-slate-500 mb-2">
              {budget.protein > 0
                ? `Target: ${budget.calories} kcal | ${budget.protein}g P | ${budget.carbs}g C | ${budget.fat}g F`
                : "No budget remaining"}
            </p>
          </div>
        )}

        {/* Add button */}
        <button
          onClick={() => onAddClick(slot)}
          className="w-full py-3 text-xs font-medium rounded-lg border border-dashed border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors"
        >
          + Add food
        </button>
      </div>
    </div>
  );
}

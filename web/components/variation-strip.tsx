"use client";

import type { Variation } from "@/lib/variation-state";
import { autoNameVariation } from "@/lib/variation-state";

interface Budget {
  calories: number; protein: number; carbs: number; fat: number;
}
interface Macros {
  calories: number;
}

interface Props {
  variations: Variation[];
  activeId: string;
  macros: Map<string, Macros>;
  budget: Budget;
  onSwitch: (id: string) => void;
  onLog: (id: string) => void;
  onAdd: () => void;
}

export function VariationStrip({ variations, activeId, macros, budget, onSwitch, onLog, onAdd }: Props) {
  return (
    <div className="bg-base/50 rounded-xl border border-border-glow p-3 space-y-2">
      <p className="text-[10px] font-semibold text-warm uppercase tracking-wider">
        Variations · tap to edit
      </p>
      <div className="space-y-1.5">
        {variations.map((v, i) => {
          const isActive = v.id === activeId;
          const m = macros.get(v.id);
          const cal = Math.round(m?.calories ?? 0);
          const delta = cal - budget.calories;
          const deltaLabel = delta === 0 ? "on" : `${delta > 0 ? "+" : ""}${delta}`;
          const deltaClass = Math.abs(delta) <= 50
            ? "bg-success/15 text-success"
            : delta > 0
              ? "bg-warm/15 text-warm"
              : "bg-danger/15 text-danger";
          const label = autoNameVariation(v, i);
          return (
            <div
              key={v.id}
              role="button"
              tabIndex={0}
              onClick={() => !isActive && onSwitch(v.id)}
              onKeyDown={(e) => { if (e.key === "Enter" && !isActive) onSwitch(v.id); }}
              className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 min-h-[44px] cursor-pointer transition-colors ${
                isActive
                  ? "bg-teal-bg border border-teal"
                  : "bg-surface-elevated border border-border-subtle hover:bg-surface-hover"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isActive ? "bg-teal" : "bg-text-faint"}`} />
              <span className="text-xs font-semibold text-text-secondary w-6">V{i + 1}</span>
              <span className="text-sm text-text flex-1 truncate">{label}</span>
              <span className="text-[11px] text-text-muted tnum">{cal} kcal</span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${deltaClass} tnum`}>
                {deltaLabel}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); onLog(v.id); }}
                aria-label={`Log V${i + 1}`}
                className={`text-[11px] font-semibold px-3 py-1 rounded border border-teal transition-colors ${
                  isActive ? "bg-teal text-base" : "bg-transparent text-teal hover:bg-teal-bg"
                }`}
              >
                Log
              </button>
            </div>
          );
        })}
      </div>
      <button
        onClick={onAdd}
        className="w-full text-xs text-teal font-medium py-2 rounded-lg border border-dashed border-border-glow hover:bg-teal-bg/30 transition-colors"
      >
        + New variation
      </button>
    </div>
  );
}

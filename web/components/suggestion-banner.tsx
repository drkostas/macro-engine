"use client";

import type { MacroTargets } from "@/lib/macro-engine";

interface SuggestionBannerProps {
  remaining: MacroTargets;
  nextSlot: string | null;
}

const SLOT_LABELS: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  pre_sleep: "Pre-Sleep",
};

export function SuggestionBanner({ remaining, nextSlot }: SuggestionBannerProps) {
  if (!nextSlot || remaining.calories <= 0) return null;

  return (
    <div className="bg-gradient-to-r from-blue-950/80 to-slate-900 rounded-xl border border-blue-800/40 p-5">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-blue-400 mb-1">
            {SLOT_LABELS[nextSlot] ?? nextSlot} suggestion
          </h3>
          <p className="text-slate-300 text-sm">
            You need{" "}
            <span className="font-semibold text-white">{remaining.protein}g protein</span>,{" "}
            <span className="font-semibold text-white">{remaining.carbs}g carbs</span>, and{" "}
            <span className="font-semibold text-white">{remaining.fat}g fat</span>{" "}
            to hit your targets.
          </p>
          <p className="text-xs text-slate-500 mt-2">
            {remaining.calories} kcal remaining today
          </p>
        </div>
        <button
          onClick={() => window.location.href = `/log?slot=${nextSlot}`}
          className="shrink-0 ml-4 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          Log {SLOT_LABELS[nextSlot] ?? nextSlot}
        </button>
      </div>
    </div>
  );
}

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

const SLOT_ICONS: Record<string, string> = {
  breakfast: "☀",
  lunch: "◔",
  dinner: "◑",
  pre_sleep: "☾",
};

export function SuggestionBanner({ remaining, nextSlot }: SuggestionBannerProps) {
  if (!nextSlot || remaining.calories <= 0) return null;
  const label = SLOT_LABELS[nextSlot] ?? nextSlot;

  return (
    <div className="bg-warm/10 border border-warm/20 rounded-2xl px-5 py-4 flex items-center gap-4">
      <span className="text-2xl text-warm shrink-0">{SLOT_ICONS[nextSlot]}</span>
      <div className="min-w-0 flex-1">
        <p className="t-caption text-text-muted">Next up</p>
        <p className="t-title text-text">
          {label} <span className="text-text-muted font-normal">— {remaining.calories} kcal left</span>
        </p>
      </div>
      <div className="hidden md:flex items-center gap-3 t-caption text-text-muted tnum">
        <span>{remaining.protein}P</span>
        <span>·</span>
        <span>{remaining.carbs}C</span>
        <span>·</span>
        <span>{remaining.fat}F</span>
      </div>
    </div>
  );
}

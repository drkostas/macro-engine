"use client";

import { useState } from "react";

import type { RefeedTargets } from "@/lib/refeed";

interface Props {
  refeed: {
    detected: boolean;
    suggestedTargets: RefeedTargets | null;
  };
}

/**
 * Dashboard card surfacing M6 refeed signals.
 * - Celebration badge when today's logged macros match the implicit refeed rule
 *   (kcal ≥ 95% TDEE, carbs ≥ 5 g/kg, fat ≤ 1.0 g/kg)
 * - Expandable "Plan a refeed" block showing the suggested macro targets so
 *   users can build a refeed day proactively.
 */
export function RefeedCard({ refeed }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { detected, suggestedTargets } = refeed;

  // Hide entirely when we have no data at all (e.g. onboarding state)
  if (!suggestedTargets && !detected) return null;

  return (
    <div className="space-y-2" data-testid="refeed-card">
      {detected && (
        <div
          role="status"
          data-testid="refeed-detection-badge"
          className="flex items-start gap-2 border border-success/30 bg-success/10 text-success rounded-lg px-3 py-2 text-xs"
        >
          <span className="text-base leading-none" aria-hidden>✓</span>
          <div className="flex-1">
            <p className="font-semibold leading-tight">Refeed logged today</p>
            <p className="text-[11px] opacity-80 mt-0.5 leading-relaxed">
              Deficit-duration counter reduced by 3 days.
            </p>
          </div>
        </div>
      )}

      {suggestedTargets && (
        <div
          data-testid="refeed-plan-block"
          className="border border-border-glow rounded-lg bg-surface-elevated"
        >
          <button
            type="button"
            onClick={() => setExpanded((x) => !x)}
            aria-expanded={expanded}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-text hover:bg-surface-hover rounded-lg transition-colors"
          >
            <span>Plan a refeed</span>
            <span className="text-text-muted">{expanded ? "−" : "+"}</span>
          </button>
          {expanded && (
            <div className="px-3 pb-3 pt-1 border-t border-border-subtle">
              <p className="text-[11px] text-text-muted leading-relaxed mb-2">
                Carb-heavy, moderate protein, low fat. Logging one resets 3
                days off the deficit-duration counter (6 for a 2-day refeed).
              </p>
              <div className="grid grid-cols-4 gap-2 text-center">
                <Stat label="kcal" value={suggestedTargets.kcal} />
                <Stat label="P g" value={suggestedTargets.proteinG} />
                <Stat label="C g" value={suggestedTargets.carbsG} />
                <Stat label="F g" value={suggestedTargets.fatG} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded bg-surface py-1.5">
      <p className="text-sm font-semibold text-text tnum">{value}</p>
      <p className="text-[10px] uppercase tracking-widest text-text-muted">{label}</p>
    </div>
  );
}

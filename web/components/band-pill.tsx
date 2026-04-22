"use client";

import type { Band } from "@/lib/macro-targets";

interface Props {
  band: Band;
  weightKg?: number;
}

const BAND_META: Record<Band, { label: string; tone: string; gPerKg: number }> = {
  rest:      { label: "Rest",      tone: "bg-surface-elevated text-text-muted",         gPerKg: 3.0 },
  light:     { label: "Light",     tone: "bg-teal-bg/30 text-teal-dim",                 gPerKg: 3.5 },
  moderate:  { label: "Moderate",  tone: "bg-teal-bg text-teal border border-teal/30",  gPerKg: 5.0 },
  hard:      { label: "Hard",      tone: "bg-warm/15 text-warm border border-warm/30",  gPerKg: 6.5 },
  very_hard: { label: "Very hard", tone: "bg-danger/15 text-danger border border-danger/30", gPerKg: 8.0 },
};

/**
 * Colored chip showing today's training band. Title attribute carries the
 * carb g/kg target so hovering explains the visual without opening a modal.
 */
export function BandPill({ band, weightKg }: Props) {
  const meta = BAND_META[band];
  const totalG = weightKg ? Math.round(meta.gPerKg * weightKg) : null;
  const tooltip = totalG
    ? `${meta.label} band — ${meta.gPerKg} g/kg carbs (${totalG}g today)`
    : `${meta.label} band — ${meta.gPerKg} g/kg carbs`;

  return (
    <span
      title={tooltip}
      data-testid={`band-pill-${band}`}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${meta.tone}`}
    >
      {meta.label}
    </span>
  );
}

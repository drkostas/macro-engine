"use client";

import type { Mode } from "@/lib/mode-engine";
import { MODE_COPY } from "@/lib/mode-copy";
import type { Tier } from "@/lib/safety-rails";

interface Props {
  tier: Tier;
  mode: Mode;
}

const TIER_DESCRIPTION: Record<Tier, string> = {
  T1: "T1 (≥28% BF)",
  T2: "T2 (20-28% BF)",
  T3: "T3 (15-20% BF)",
  T4: "T4 (10-15% BF)",
  T5: "T5 (<10% BF)",
};

/**
 * Compact "T2 · Aggressive" chip surfacing the user's current BF% tier and
 * active deficit mode. Title attribute explains both for hover readers.
 */
export function TierPill({ tier, mode }: Props) {
  const modeLabel = MODE_COPY[mode].label;
  const tooltip = `${TIER_DESCRIPTION[tier]} · ${modeLabel}`;

  return (
    <span
      title={tooltip}
      data-testid={`tier-pill-${tier}-${mode}`}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-border-glow bg-surface-elevated text-[10px] font-semibold text-text-secondary uppercase tracking-wider"
    >
      {tier} · {modeLabel}
    </span>
  );
}

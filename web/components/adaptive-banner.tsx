"use client";

import { useMemo, useState } from "react";

import type {
  AdaptiveTdeeResult,
  DietBreakLevel,
  PlateauResult,
  PlateauType,
} from "@/lib/adaptive";

interface AdaptivePayload {
  tdee: AdaptiveTdeeResult | null;
  refeedPressureScore: number;
  dietBreakLevel: DietBreakLevel;
  plateau: PlateauResult | null;
}

interface Props {
  adaptive: AdaptivePayload;
}

type BannerKind = "drift" | "refeed" | "diet_break" | "plateau";
type Tone = "info" | "amber" | "warm" | "danger";

interface BannerDescriptor {
  kind: BannerKind;
  tone: Tone;
  title: string;
  body: string;
}

const PLATEAU_COPY: Record<PlateauType, { title: string; body: string }> = {
  adaptation: {
    title: "Plateau detected — adaptation",
    body: "Weight stalled with elevated hunger/fatigue. A refeed or 2-week diet break is usually the fastest reset.",
  },
  intake_creep: {
    title: "Plateau detected — intake creep",
    body: "Weight stalled but hunger is normal. Audit your meal logs — small under-counting is the usual culprit.",
  },
  water: {
    title: "Plateau detected — water/transient",
    body: "Short-term weight stall without metabolic signals. Hold course for another week.",
  },
  recomp: {
    title: "Recomposition",
    body: "Strength improving while weight flat — body comp is still changing even if the scale isn't.",
  },
};

function describeBanners(adaptive: AdaptivePayload): BannerDescriptor[] {
  const banners: BannerDescriptor[] = [];

  if (adaptive.tdee?.driftFlag) {
    const pct = Math.round(adaptive.tdee.discrepancyPct);
    banners.push({
      kind: "drift",
      tone: "amber",
      title: "TDEE drift detected",
      body: `Reported TDEE and actual weight trend disagree by ${pct}%. Consider re-estimating.`,
    });
  }

  if (adaptive.refeedPressureScore >= 60) {
    banners.push({
      kind: "refeed",
      tone: "amber",
      title: "Refeed pressure high",
      body: `Score ${adaptive.refeedPressureScore}/100 — a 1-2 day carb-heavy refeed is advisable.`,
    });
  }

  if (adaptive.dietBreakLevel !== "none") {
    if (adaptive.dietBreakLevel === "suggested") {
      banners.push({
        kind: "diet_break",
        tone: "amber",
        title: "Diet break suggested",
        body: "You've been in a deficit for 8+ weeks. A 2-week maintenance break is advisable.",
      });
    } else if (adaptive.dietBreakLevel === "strong") {
      banners.push({
        kind: "diet_break",
        tone: "warm",
        title: "Diet break strongly recommended",
        body: "12+ weeks in deficit. A 2-week maintenance break is strongly advised before continuing.",
      });
    } else if (adaptive.dietBreakLevel === "mandatory") {
      banners.push({
        kind: "diet_break",
        tone: "danger",
        title: "Diet break required",
        body: "16+ weeks in deficit. Switch to Maintenance for 2 weeks — progress will improve.",
      });
    }
  }

  if (
    adaptive.plateau?.isPlateau
    && adaptive.plateau.type
    && adaptive.plateau.type !== "recomp"
  ) {
    const copy = PLATEAU_COPY[adaptive.plateau.type];
    banners.push({
      kind: "plateau",
      tone: adaptive.plateau.type === "adaptation" ? "warm" : "info",
      title: copy.title,
      body: copy.body,
    });
  }

  return banners;
}

const TONE_CLASSES: Record<Tone, string> = {
  info:   "bg-teal-bg/30 border-teal-dim/40 text-teal-dim",
  amber:  "bg-warm/10 border-warm/30 text-warm",
  warm:   "bg-warm/15 border-warm/50 text-warm",
  danger: "bg-danger/15 border-danger/40 text-danger",
};

/**
 * Stack of advisory banners driven by plan.context.adaptive. Each banner
 * supports session-local dismissal (doesn't persist server-side — this is
 * an advisory layer, not a workflow state).
 */
export function AdaptiveBanner({ adaptive }: Props) {
  const descriptors = useMemo(() => describeBanners(adaptive), [adaptive]);
  const [dismissed, setDismissed] = useState<Set<BannerKind>>(new Set());

  const visible = descriptors.filter((b) => !dismissed.has(b.kind));

  if (visible.length === 0) return null;

  return (
    <div className="space-y-2" data-testid="adaptive-banner-stack">
      {visible.map((b) => (
        <div
          key={b.kind}
          role="status"
          data-testid={`adaptive-banner-${b.kind}`}
          className={`flex items-start gap-3 border rounded-lg px-3 py-2 text-xs ${TONE_CLASSES[b.tone]}`}
        >
          <div className="flex-1">
            <p className="font-semibold leading-tight">{b.title}</p>
            <p className="text-[11px] opacity-80 mt-0.5 leading-relaxed">{b.body}</p>
          </div>
          <button
            aria-label={`Dismiss ${b.kind} banner`}
            onClick={() => setDismissed((prev) => new Set(prev).add(b.kind))}
            className="text-sm opacity-60 hover:opacity-100 transition-opacity"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

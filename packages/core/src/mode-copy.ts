/**
 * Per-mode UI copy. Kept out of component files so the selector, modal, and
 * any future surfaces stay in sync. Research citations are verbatim from
 * SOMA-NUTRITION-SCIENCE-V2.md so they can be grep-compared to the source.
 */

import type { GateReason, Mode, TransitionReason } from "./mode-engine";

export interface ModeCopy {
  label: string;
  tagline: string;
  description: string;
  rules: readonly string[];
  citations: readonly string[];
}

export const MODE_COPY: Record<Mode, ModeCopy> = {
  standard: {
    label: "Standard cut",
    tagline: "Default deficit with safety rails",
    description:
      "The baseline cutting mode. A user-chosen daily deficit on top of full safety rails — BMR floor, protein floor, fat floor, and the 5-tier rate cap.",
    rules: [
      "Available for tiers T1-T4",
      "No BF% hard floor",
      "No duration cap — runs until tier transition or user exit",
    ],
    citations: ["Helms 2014 physique meta", "Trexler 2014 adaptive thermogenesis review"],
  },
  aggressive: {
    label: "Aggressive cut",
    tagline: "Short-burst deeper deficit",
    description:
      "Opt-in deep deficit for short blocks. Bypasses the Cunningham portion of the BMR floor, allows up to 1200 kcal below TDEE, and requires a mandatory reverse diet on exit.",
    rules: [
      "Available for tiers T1-T2 only — BLOCKED at T3 and leaner",
      "Hard contraindication below 12% BF",
      "Duration capped at 12 weeks at the 700-900 kcal envelope",
      "Exiting requires a Reverse diet of 2-6 weeks",
    ],
    citations: [
      "Longland 2016 (aggressive deficit envelope)",
      "Rossow 2013 (T/mood decline in very-lean cuts)",
      "Helms 2014 physique meta",
    ],
  },
  reverse: {
    label: "Reverse diet",
    tagline: "Post-cut ramp back to maintenance or bulk",
    description:
      "A 2-6 week ramp that adds 50-150 kcal per week (carbs first). Used after an aggressive block or as the mandatory bridge between cutting and bulking.",
    rules: [
      "Available for every tier",
      "No BF% hard floor",
      "Runs for 2-6 weeks; capped at 42 days",
    ],
    citations: ["Helms 2014 physique meta §reverse-diet"],
  },
  maintenance: {
    label: "Maintenance",
    tagline: "Indefinite TDEE ±5%",
    description:
      "Target calories within ±5% of TDEE. Fat target bumps to a real 0.8-1.0 g/kg, protein drops to 2.0 g/kg. 5-point re-entry checklist gates the next cut.",
    rules: [
      "Available for every tier",
      "No BF% hard floor",
      "Indefinite — minimum 8 weeks stable before the next cut",
    ],
    citations: [
      "Ostendorf 2019 NWCR cohort (no residual RMR suppression)",
      "Sumithran 2011 (hunger/ghrelin adaptation)",
      "Wing 2006 STOP Regain RCT",
    ],
  },
  bulk: {
    label: "Lean bulk",
    tagline: "Slow surplus with BF ceiling",
    description:
      "A conservative +250-350 kcal/day surplus targeting 0.25-0.35% BW/week gain. BF% ceiling of ~18% triggers a minicut. Requires a reverse diet bridge if coming from a cut.",
    rules: [
      "Available for tiers T2-T5 — BLOCKED at T1 (>28% BF)",
      "No BF% hard floor",
      "12-20 weeks per bulk block; capped at 140 days",
      "Entering from Standard or Aggressive requires a Reverse diet first",
    ],
    citations: [
      "Helms 2023 RCT (15% surplus → more fat, same muscle vs 5%)",
      "Slater 2019 (358-478 kcal conservative start)",
      "Morton 2018 (1.6 g/kg protein plateau)",
    ],
  },
  injured: {
    label: "Injured",
    tagline: "Recovery — overrides other gates",
    description:
      "A 3-phase state (Acute 0-10d / Subacute 10d-6w / Chronic >6w) with protein tiers from 2.2 up to 2.5 g/kg, and a stricter EA floor (30 kcal/kg FFM + rehab).",
    rules: [
      "Available for every tier — overrides tier × BF% gates",
      "Never drop protein below pre-injury",
      "Re-entry to cutting: 4-6 weeks at Maintenance first",
    ],
    citations: ["Tipton 2015 (injury nutrition meta)", "Mountjoy 2018 RED-S"],
  },
};

/**
 * Short inline status copy shown beneath a mode's label when the user can't
 * switch to it right now. Keeps the selector readable without opening the modal.
 */
export function gateReasonCopy(reason: GateReason): string {
  if (reason === "tier_not_allowed") return "Not available at your tier";
  return "Below the BF% floor for this mode";
}

export function transitionReasonCopy(reason: TransitionReason): string {
  if (reason === "mode_not_available") return "Not available at your tier";
  if (reason === "aggressive_requires_reverse") {
    return "Switch to Reverse diet first";
  }
  return "Requires a Reverse diet bridge first";
}

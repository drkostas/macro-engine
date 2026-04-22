import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { BandPill } from "@/components/band-pill";
import { TierPill } from "@/components/tier-pill";
import type { Band } from "@/lib/macro-targets";
import type { Mode } from "@/lib/mode-engine";
import type { Tier } from "@/lib/safety-rails";

const ALL_BANDS: Band[] = ["rest", "light", "moderate", "hard", "very_hard"];
const ALL_MODES: Mode[] = ["standard", "aggressive", "reverse", "maintenance", "bulk", "injured"];
const ALL_TIERS: Tier[] = ["T1", "T2", "T3", "T4", "T5"];

describe("BandPill", () => {
  it.each(ALL_BANDS)("renders label for %s band", (band: Band) => {
    render(<BandPill band={band} />);
    expect(screen.getByTestId(`band-pill-${band}`)).toBeDefined();
  });

  it("hard band shows its label text", () => {
    render(<BandPill band="hard" />);
    expect(screen.getByText(/Hard/i)).toBeDefined();
  });

  it("tooltip includes per-day gram target when weight provided", () => {
    render(<BandPill band="hard" weightKg={74} />);
    const pill = screen.getByTestId("band-pill-hard");
    // 6.5 g/kg × 74 = 481g
    expect(pill.getAttribute("title")).toMatch(/481g/);
  });

  it("tooltip shows g/kg only when weight absent", () => {
    render(<BandPill band="moderate" />);
    const pill = screen.getByTestId("band-pill-moderate");
    expect(pill.getAttribute("title")).toMatch(/5 g\/kg/);
  });
});

describe("TierPill", () => {
  it.each(ALL_TIERS)("renders %s tier label", (tier: Tier) => {
    render(<TierPill tier={tier} mode="standard" />);
    expect(screen.getByTestId(`tier-pill-${tier}-standard`)).toBeDefined();
  });

  it.each(ALL_MODES)("renders %s mode label", (mode: Mode) => {
    render(<TierPill tier="T2" mode={mode} />);
    expect(screen.getByTestId(`tier-pill-T2-${mode}`)).toBeDefined();
  });

  it("combines tier + mode in the tooltip", () => {
    render(<TierPill tier="T2" mode="aggressive" />);
    const pill = screen.getByTestId("tier-pill-T2-aggressive");
    expect(pill.getAttribute("title")).toMatch(/T2 \(20-28% BF\)/);
    expect(pill.getAttribute("title")).toMatch(/Aggressive/);
  });

  it("displays tier · mode format", () => {
    render(<TierPill tier="T3" mode="maintenance" />);
    expect(screen.getByText(/T3.*Maintenance/)).toBeDefined();
  });
});

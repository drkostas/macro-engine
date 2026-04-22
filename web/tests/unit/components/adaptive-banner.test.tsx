import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AdaptiveBanner } from "@/components/adaptive-banner";
import type {
  AdaptiveTdeeResult,
  DietBreakLevel,
  PlateauResult,
} from "@/lib/adaptive";

function make(overrides: {
  tdee?: AdaptiveTdeeResult | null;
  refeedPressureScore?: number;
  dietBreakLevel?: DietBreakLevel;
  plateau?: PlateauResult | null;
}) {
  return {
    tdee: overrides.tdee ?? null,
    refeedPressureScore: overrides.refeedPressureScore ?? 0,
    dietBreakLevel: overrides.dietBreakLevel ?? ("none" as const),
    plateau: overrides.plateau ?? null,
  };
}

describe("AdaptiveBanner", () => {
  it("renders nothing when no signals", () => {
    const { container } = render(<AdaptiveBanner adaptive={make({})} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows drift banner when TDEE drift flagged", () => {
    render(
      <AdaptiveBanner
        adaptive={make({
          tdee: {
            effectiveTdee: 2800, reportedTdee: 2400,
            discrepancyPct: 17, driftFlag: true,
          },
        })}
      />,
    );
    expect(screen.getByTestId("adaptive-banner-drift")).toBeDefined();
    expect(screen.getByText(/17%/)).toBeDefined();
  });

  it("shows refeed banner at RPS ≥ 60", () => {
    render(<AdaptiveBanner adaptive={make({ refeedPressureScore: 72 })} />);
    expect(screen.getByTestId("adaptive-banner-refeed")).toBeDefined();
    expect(screen.getByText(/72\/100/)).toBeDefined();
  });

  it("omits refeed banner below threshold", () => {
    render(<AdaptiveBanner adaptive={make({ refeedPressureScore: 55 })} />);
    expect(screen.queryByTestId("adaptive-banner-refeed")).toBeNull();
  });

  it("shows diet-break banner at each level with distinct copy", () => {
    const { rerender } = render(
      <AdaptiveBanner adaptive={make({ dietBreakLevel: "suggested" })} />,
    );
    expect(screen.getByText(/2-week maintenance break is advisable/i)).toBeDefined();

    rerender(<AdaptiveBanner adaptive={make({ dietBreakLevel: "strong" })} />);
    expect(screen.getByText(/strongly advised/i)).toBeDefined();

    rerender(<AdaptiveBanner adaptive={make({ dietBreakLevel: "mandatory" })} />);
    expect(screen.getByText(/Switch to Maintenance/i)).toBeDefined();
  });

  it("shows plateau banner with type-specific copy", () => {
    render(
      <AdaptiveBanner
        adaptive={make({
          plateau: {
            isPlateau: true,
            emaSlopeKgPerWk: 0.05,
            type: "adaptation",
            daysStalled: 20,
          },
        })}
      />,
    );
    expect(screen.getByTestId("adaptive-banner-plateau")).toBeDefined();
    expect(screen.getByText(/adaptation/i)).toBeDefined();
  });

  it("omits plateau banner when type is recomp", () => {
    render(
      <AdaptiveBanner
        adaptive={make({
          plateau: {
            isPlateau: true,
            emaSlopeKgPerWk: 0.05,
            type: "recomp",
            daysStalled: 20,
          },
        })}
      />,
    );
    expect(screen.queryByTestId("adaptive-banner-plateau")).toBeNull();
  });

  it("stacks multiple banners simultaneously", () => {
    render(
      <AdaptiveBanner
        adaptive={make({
          tdee: {
            effectiveTdee: 2800, reportedTdee: 2400,
            discrepancyPct: 17, driftFlag: true,
          },
          refeedPressureScore: 72,
          dietBreakLevel: "strong",
        })}
      />,
    );
    expect(screen.getByTestId("adaptive-banner-drift")).toBeDefined();
    expect(screen.getByTestId("adaptive-banner-refeed")).toBeDefined();
    expect(screen.getByTestId("adaptive-banner-diet_break")).toBeDefined();
  });

  it("dismisses a banner on × click (session-local)", async () => {
    render(<AdaptiveBanner adaptive={make({ refeedPressureScore: 72 })} />);
    expect(screen.getByTestId("adaptive-banner-refeed")).toBeDefined();
    await userEvent.click(screen.getByRole("button", { name: /dismiss refeed/i }));
    expect(screen.queryByTestId("adaptive-banner-refeed")).toBeNull();
  });
});

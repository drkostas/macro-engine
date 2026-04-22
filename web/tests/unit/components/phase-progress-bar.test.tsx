import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { PhaseProgressBar } from "@/components/phase-progress-bar";

describe("PhaseProgressBar", () => {
  it("labels all three phases", () => {
    render(<PhaseProgressBar phase="acute" daysSinceInjury={3} />);
    expect(screen.getByTestId("phase-segment-acute")).toBeDefined();
    expect(screen.getByTestId("phase-segment-subacute")).toBeDefined();
    expect(screen.getByTestId("phase-segment-chronic")).toBeDefined();
  });

  it("highlights the current phase", () => {
    render(<PhaseProgressBar phase="subacute" daysSinceInjury={20} />);
    const active = screen.getByTestId("phase-segment-subacute");
    expect(active.getAttribute("data-active")).toBe("true");
    const acute = screen.getByTestId("phase-segment-acute");
    expect(acute.getAttribute("data-active")).toBe("false");
  });

  it("shows days since injury", () => {
    render(<PhaseProgressBar phase="chronic" daysSinceInjury={120} />);
    expect(screen.getByText(/120/)).toBeDefined();
  });
});

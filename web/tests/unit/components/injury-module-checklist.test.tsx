import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { InjuryModuleChecklist } from "@/components/injury-module-checklist";

const MODULE = {
  label: "Tendon/ligament recovery",
  supplements: ["gelatin", "vitamin C"],
  rationale: "Gelatin + vit C 30-60 min pre-rehab boosts collagen synthesis (Shaw 2017).",
};

describe("InjuryModuleChecklist", () => {
  it("renders each supplement as a list item", () => {
    render(<InjuryModuleChecklist module={MODULE} />);
    expect(screen.getByText(/gelatin/i)).toBeDefined();
    expect(screen.getByText(/vitamin C/i)).toBeDefined();
  });

  it("exposes the rationale as a tooltip / title attr", () => {
    render(<InjuryModuleChecklist module={MODULE} />);
    const tip = screen.getByTestId("injury-rationale");
    expect(tip.getAttribute("title")).toContain("collagen");
  });

  it("renders nothing when supplements list is empty", () => {
    const { container } = render(
      <InjuryModuleChecklist
        module={{ label: "Standard recovery", supplements: [], rationale: "" }}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});

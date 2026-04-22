import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { InjuryCard } from "@/components/injury-card";

const ACTIVE = {
  active: true as const,
  id: 7,
  injuryDate: "2026-04-20",
  type: "acl" as const,
  phase: "acute" as const,
  proteinGPerKg: 2.4,
  eaFloorKcal: 2220,
  module: {
    label: "ACL / muscle recovery",
    supplements: ["omega-3"],
    rationale: "EPA + DHA 3 g/day offsets disuse-driven muscle protein breakdown.",
  },
};

describe("InjuryCard", () => {
  beforeEach(() => {
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response),
    );
  });

  it("renders 'No active injury' empty state with CTA when injury=null", () => {
    render(<InjuryCard injury={null} onChange={() => {}} />);
    expect(screen.getByTestId("injury-card")).toBeDefined();
    expect(screen.getByText(/No active injury/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /Log injury/i })).toBeDefined();
  });

  it("renders active injury status (type + phase + protein + EA floor + module)", () => {
    render(<InjuryCard injury={ACTIVE} onChange={() => {}} />);
    expect(screen.getByTestId("injury-card")).toBeDefined();
    // Injury type surfaced (multiple matches: type pill + module label both say "ACL")
    expect(screen.getAllByText(/acl/i).length).toBeGreaterThan(0);
    // Phase — match whole word (header + progress bar both surface "Acute")
    expect(screen.getAllByText(/\bacute\b/i).length).toBeGreaterThan(0);
    // Protein tier
    expect(screen.getAllByText(/2\.4/).length).toBeGreaterThan(0);
    // EA floor kcal
    expect(screen.getAllByText(/2220/).length).toBeGreaterThan(0);
    // Module label
    expect(screen.getByText(/ACL \/ muscle recovery/)).toBeDefined();
  });

  it("shows 'Mark recovered' CTA on active state", () => {
    render(<InjuryCard injury={ACTIVE} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: /Mark recovered/i })).toBeDefined();
  });

  it("opens a log form when 'Log injury' is clicked", async () => {
    render(<InjuryCard injury={null} onChange={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /Log injury/i }));
    // Type picker
    expect(screen.getByLabelText(/Injury type/i)).toBeDefined();
  });

  it("renders the phase progress bar when active", () => {
    render(<InjuryCard injury={ACTIVE} onChange={() => {}} />);
    expect(screen.getByTestId("phase-progress-bar")).toBeDefined();
  });

  it("renders the supplement checklist when module has supplements", () => {
    render(<InjuryCard injury={ACTIVE} onChange={() => {}} />);
    expect(screen.getByTestId("injury-module-checklist")).toBeDefined();
    expect(screen.getByText(/omega-3/i)).toBeDefined();
  });
});

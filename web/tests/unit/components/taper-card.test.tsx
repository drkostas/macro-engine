import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { TaperCard } from "@/components/taper-card";

const ACTIVE = {
  raceDate: "2026-05-02",
  daysUntil: 10,
  phase: "volume_taper" as const,
  carbGPerKg: 6,
  proteinGPerKg: 2.0,
};

describe("TaperCard", () => {
  beforeEach(() => {
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response),
    );
  });

  it("renders empty state + 'Set race' CTA when taper=null", () => {
    render(<TaperCard taper={null} onChange={() => {}} />);
    expect(screen.getByTestId("taper-card")).toBeDefined();
    expect(screen.getByText(/no upcoming race/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /Set race/i })).toBeDefined();
  });

  it("opens a date picker form when 'Set race' clicked", async () => {
    render(<TaperCard taper={null} onChange={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /Set race/i }));
    expect(screen.getByLabelText(/Race date/i)).toBeDefined();
  });

  it("renders active taper with phase + days_until + targets", () => {
    render(<TaperCard taper={ACTIVE} onChange={() => {}} />);
    expect(screen.getByTestId("taper-card")).toBeDefined();
    // Days until race
    expect(screen.getByText(/10/)).toBeDefined();
    // Phase label humanized
    expect(screen.getByText(/volume taper/i)).toBeDefined();
    // Carb target
    expect(screen.getAllByText(/6/).length).toBeGreaterThan(0);
    // Protein target
    expect(screen.getAllByText(/2\.0/).length).toBeGreaterThan(0);
  });

  it("shows 'Clear race' on active state", () => {
    render(<TaperCard taper={ACTIVE} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: /Clear race/i })).toBeDefined();
  });

  it("race_day label for phase=race_day", () => {
    render(
      <TaperCard
        taper={{ ...ACTIVE, phase: "race_day", daysUntil: 0 }}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText(/race day/i)).toBeDefined();
  });

  it("recovery label for phase=recovery + days_until < 0", () => {
    render(
      <TaperCard
        taper={{ ...ACTIVE, phase: "recovery", daysUntil: -3 }}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText(/recovery/i)).toBeDefined();
  });
});

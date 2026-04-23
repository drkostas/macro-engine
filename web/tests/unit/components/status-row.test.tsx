import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { StatusRow } from "@/components/status-row";

const INJURY = {
  active: true as const,
  id: 1,
  injuryDate: "2026-04-15",
  type: "acl" as const,
  phase: "acute" as const,
  proteinGPerKg: 2.4,
  eaFloorKcal: 2138,
  module: { label: "ACL / muscle recovery", supplements: ["omega-3"], rationale: "" },
};

const TAPER = {
  raceDate: "2026-04-27",
  daysUntil: 5,
  phase: "intensity_taper" as const,
  carbGPerKg: 7,
  proteinGPerKg: 2.2,
};

const CLIMATE = {
  env: "altitude" as const,
  adjustment: {
    extraFluidMl: 500, extraSodiumMg: 0, extraKcal: 0, extraCarbG: 74,
    ironTargetMg: 12, notes: "",
  },
};

describe("StatusRow", () => {
  beforeEach(() => {
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response),
    );
  });

  it("renders nothing when all statuses are inactive", () => {
    const { container } = render(
      <StatusRow
        injury={null} taper={null} climate={null}
        expanded={null} onToggleExpanded={() => {}} onRefresh={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders a pill for each active status", () => {
    render(
      <StatusRow
        injury={INJURY} taper={TAPER} climate={CLIMATE}
        expanded={null} onToggleExpanded={() => {}} onRefresh={() => {}}
      />,
    );
    expect(screen.getByTestId("status-pill-injury")).toBeDefined();
    expect(screen.getByTestId("status-pill-taper")).toBeDefined();
    expect(screen.getByTestId("status-pill-climate")).toBeDefined();
  });

  it("pill text reflects active state", () => {
    render(
      <StatusRow
        injury={INJURY} taper={null} climate={null}
        expanded={null} onToggleExpanded={() => {}} onRefresh={() => {}}
      />,
    );
    expect(screen.getByText(/acl/i)).toBeDefined();
    expect(screen.getByText(/acute/i)).toBeDefined();
  });

  it("clicking a pill calls onToggleExpanded with its key", async () => {
    const onToggle = vi.fn();
    render(
      <StatusRow
        injury={INJURY} taper={null} climate={null}
        expanded={null} onToggleExpanded={onToggle} onRefresh={() => {}}
      />,
    );
    await userEvent.click(screen.getByTestId("status-pill-injury"));
    expect(onToggle).toHaveBeenCalledWith("injury");
  });

  it("shows ⚙ setup button when any status is inactive", () => {
    render(
      <StatusRow
        injury={INJURY} taper={null} climate={null}
        expanded={null} onToggleExpanded={() => {}} onRefresh={() => {}}
      />,
    );
    expect(screen.getByTestId("status-setup-button")).toBeDefined();
  });

  it("hides ⚙ setup button when all are active", () => {
    render(
      <StatusRow
        injury={INJURY} taper={TAPER} climate={CLIMATE}
        expanded={null} onToggleExpanded={() => {}} onRefresh={() => {}}
      />,
    );
    expect(screen.queryByTestId("status-setup-button")).toBeNull();
  });

  it("⚙ popover lists only inactive features", async () => {
    render(
      <StatusRow
        injury={INJURY} taper={null} climate={null}
        expanded={null} onToggleExpanded={() => {}} onRefresh={() => {}}
      />,
    );
    await userEvent.click(screen.getByTestId("status-setup-button"));
    expect(screen.getByRole("button", { name: /Set race/i })).toBeDefined();
    // Climate sub-menu offers Altitude/Heat/Cold directly
    expect(screen.getByRole("button", { name: /^Altitude$/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /^Heat$/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /^Cold$/i })).toBeDefined();
    // Injury is already active — not offered for setup
    expect(screen.queryByRole("button", { name: /Log injury/i })).toBeNull();
  });

  it("expanded=X marks that pill as active", () => {
    render(
      <StatusRow
        injury={INJURY} taper={TAPER} climate={null}
        expanded="taper" onToggleExpanded={() => {}} onRefresh={() => {}}
      />,
    );
    const taperPill = screen.getByTestId("status-pill-taper");
    expect(taperPill.getAttribute("data-expanded")).toBe("true");
    const injuryPill = screen.getByTestId("status-pill-injury");
    expect(injuryPill.getAttribute("data-expanded")).toBe("false");
  });
});

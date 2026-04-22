import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ClimateCard } from "@/components/climate-card";

const ALT = {
  env: "altitude" as const,
  adjustment: {
    extraFluidMl: 500,
    extraSodiumMg: 0,
    extraKcal: 0,
    extraCarbG: 70,
    ironTargetMg: 18,
    notes: "Hypoxia blunts appetite.",
  },
};

describe("ClimateCard", () => {
  beforeEach(() => {
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response),
    );
  });

  it("renders 4-way env selector always", () => {
    render(<ClimateCard climate={null} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: /^Normal$/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /^Altitude$/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /^Heat$/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /^Cold$/i })).toBeDefined();
  });

  it("no adjustments tiles when climate=null (env=normal)", () => {
    render(<ClimateCard climate={null} onChange={() => {}} />);
    expect(screen.queryByTestId("climate-adjustments")).toBeNull();
  });

  it("renders fluid + carb + iron tiles on altitude", () => {
    render(<ClimateCard climate={ALT} onChange={() => {}} />);
    expect(screen.getByTestId("climate-adjustments")).toBeDefined();
    expect(screen.getByText(/\+500/)).toBeDefined();
    expect(screen.getByText(/\+70/)).toBeDefined();
    expect(screen.getByText(/18/)).toBeDefined();
  });

  it("clicking an env triggers POST", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response),
    );
    global.fetch = fetchMock as typeof fetch;
    render(<ClimateCard climate={null} onChange={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /^Heat$/i }));
    expect(fetchMock).toHaveBeenCalled();
    const call = fetchMock.mock.calls[0] as unknown as [string, { body?: BodyInit }];
    const body = JSON.parse(String(call[1]?.body ?? "{}"));
    expect(body).toMatchObject({ env: "heat" });
  });

  it("notes text rendered when present", () => {
    render(<ClimateCard climate={ALT} onChange={() => {}} />);
    expect(screen.getByText(/Hypoxia blunts appetite/)).toBeDefined();
  });
});

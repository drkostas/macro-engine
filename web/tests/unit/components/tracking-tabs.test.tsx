import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { TrackingTabs } from "@/components/tracking-tabs";

function mockFetch(url: string) {
  if (url.includes("/api/nutrition/wrapup")) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        wrapup: {
          weekStart: "2026-04-14", weekEnd: "2026-04-20",
          daysTotal: 7, daysClosed: 5, adherencePct: 80,
          avgKcal: 2050, avgProteinG: 140, avgProteinGPerKg: 2.0,
          trainingDays: 3, weightDeltaKg: -0.4, grade: "B",
        },
        takeaway: "Solid adherence. protein averaged 2.0 g/kg.",
      }),
    } as Response);
  }
  if (url.includes("/api/nutrition/progression")) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        progression: {
          windowDays: 30, daysTotal: 30, daysClosed: 25,
          weightDeltaKg: -1.8, weightDeltaPerWeek: -0.42,
          adherenceAvgPct: 76, avgDailyDeficit: 440,
          trainingDays: 11,
        },
      }),
    } as Response);
  }
  if (url.includes("/api/nutrition/year-review")) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        review: {
          year: 2026, totalDaysTracked: 110, daysClosed: 95,
          overallAdherencePct: 82,
          weightStart: 80, weightEnd: 75.5, weightDeltaKg: -4.5,
          avgKcal: 2050, avgProteinG: 145,
          bestStreak: 21, trainingDaysTotal: 45,
          months: Array.from({ length: 12 }, (_, i) => ({
            month: i + 1, daysTracked: 0, daysClosed: 0,
            adherencePct: 0, avgKcal: 0, trainingDays: 0,
          })),
        },
      }),
    } as Response);
  }
  return Promise.resolve({ ok: false, json: () => Promise.resolve({}) } as Response);
}

describe("TrackingTabs", () => {
  beforeEach(() => {
    global.fetch = vi.fn((input: RequestInfo) => mockFetch(String(input))) as typeof fetch;
    Object.assign(URL, {
      createObjectURL: vi.fn(() => "blob:fake"),
      revokeObjectURL: vi.fn(),
    });
  });
  afterEach(() => vi.resetAllMocks());

  it("renders 3 tabs: Week / Progress / Year", () => {
    render(<TrackingTabs />);
    expect(screen.getByRole("button", { name: /^Week$/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /^Progress$/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /^Year$/i })).toBeDefined();
  });

  it("Week is the default tab", async () => {
    render(<TrackingTabs />);
    await waitFor(() => {
      // WeeklyWrapupCard renders its testid
      expect(screen.getByTestId("weekly-wrapup-card")).toBeDefined();
    });
  });

  it("clicking Progress switches to progression body", async () => {
    render(<TrackingTabs />);
    await userEvent.click(screen.getByRole("button", { name: /^Progress$/i }));
    await waitFor(() => {
      expect(screen.getByTestId("progression-card")).toBeDefined();
    });
    expect(screen.queryByTestId("weekly-wrapup-card")).toBeNull();
  });

  it("clicking Year switches to year-review body", async () => {
    render(<TrackingTabs />);
    await userEvent.click(screen.getByRole("button", { name: /^Year$/i }));
    await waitFor(() => {
      expect(screen.getByTestId("year-review-card")).toBeDefined();
    });
    expect(screen.queryByTestId("weekly-wrapup-card")).toBeNull();
    expect(screen.queryByTestId("progression-card")).toBeNull();
  });

  it("active tab button marked via data-active", async () => {
    render(<TrackingTabs />);
    const weekBtn = screen.getByRole("button", { name: /^Week$/i });
    expect(weekBtn.getAttribute("data-active")).toBe("true");
    const yearBtn = screen.getByRole("button", { name: /^Year$/i });
    expect(yearBtn.getAttribute("data-active")).toBe("false");
  });
});

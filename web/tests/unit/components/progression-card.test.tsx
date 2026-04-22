import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ProgressionCard } from "@/components/progression-card";

const MAKE = (windowDays: number) => ({
  progression: {
    windowDays,
    daysTotal: windowDays,
    daysClosed: windowDays - 5,
    weightDeltaKg: -1.8,
    weightDeltaPerWeek: -0.42,
    adherenceAvgPct: 84,
    avgDailyDeficit: 440,
    trainingDays: Math.floor(windowDays / 3),
  },
});

describe("ProgressionCard", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn((url: RequestInfo) => {
      const s = String(url);
      const m = s.match(/window=(\d+)/);
      const win = m ? Number(m[1]) : 30;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(MAKE(win)),
      } as Response);
    });
    global.fetch = fetchMock as typeof fetch;
  });

  afterEach(() => vi.resetAllMocks());

  it("renders 30/60/90 segmented toggle", async () => {
    render(<ProgressionCard />);
    expect(screen.getByTestId("progression-card")).toBeDefined();
    expect(screen.getByRole("button", { name: /^30d$/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /^60d$/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /^90d$/ })).toBeDefined();
  });

  it("loads 30-day window by default", async () => {
    render(<ProgressionCard />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toMatch(/window=30/);
  });

  it("re-fetches when 60d clicked", async () => {
    render(<ProgressionCard />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await userEvent.click(screen.getByRole("button", { name: /^60d$/ }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const url = String(fetchMock.mock.calls[1][0]);
    expect(url).toMatch(/window=60/);
  });

  it("renders weight + adherence + deficit + training tiles", async () => {
    render(<ProgressionCard />);
    await waitFor(() => {
      // Weight delta
      expect(screen.getByText(/1\.8/)).toBeDefined();
      // Adherence
      expect(screen.getByText(/84/)).toBeDefined();
      // Avg deficit
      expect(screen.getByText(/440/)).toBeDefined();
    });
  });

  it("days closed subtext shown", async () => {
    render(<ProgressionCard />);
    await waitFor(() => {
      expect(screen.getByText(/25 \/ 30 days closed/)).toBeDefined();
    });
  });
});

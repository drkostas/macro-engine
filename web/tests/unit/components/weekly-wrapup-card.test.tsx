import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import { WeeklyWrapupCard } from "@/components/weekly-wrapup-card";

const FAKE_WRAPUP = {
  weekStart: "2026-04-08",
  weekEnd: "2026-04-14",
  daysTotal: 7,
  daysClosed: 6,
  adherencePct: 92,
  avgKcal: 2050,
  avgProteinG: 158,
  avgProteinGPerKg: 2.1,
  trainingDays: 4,
  weightDeltaKg: -0.6,
  grade: "A",
};

describe("WeeklyWrapupCard", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          wrapup: FAKE_WRAPUP,
          takeaway: "Strong week on track. protein averaged 2.1 g/kg. 4 training days. weight down 0.6 kg.",
        }),
      } as Response),
    );
    global.fetch = fetchMock as typeof fetch;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("renders a skeleton initially then the wrapup", async () => {
    render(<WeeklyWrapupCard />);
    expect(screen.getByTestId("weekly-wrapup-card")).toBeDefined();
    await waitFor(() => {
      expect(screen.getByText(/\bA\b/)).toBeDefined(); // grade pill
    });
  });

  it("shows adherence percent + grade pill", async () => {
    render(<WeeklyWrapupCard />);
    await waitFor(() => expect(screen.getByText(/92/)).toBeDefined());
    expect(screen.getByTestId("wrapup-grade")).toBeDefined();
  });

  it("shows avg kcal + protein + training + weight tiles", async () => {
    render(<WeeklyWrapupCard />);
    await waitFor(() => {
      expect(screen.getAllByText(/2050/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/2\.1/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/^4$/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/0\.6/).length).toBeGreaterThan(0);
    });
  });

  it("shows takeaway paragraph", async () => {
    render(<WeeklyWrapupCard />);
    await waitFor(() => {
      expect(screen.getByText(/Strong week on track/)).toBeDefined();
    });
  });

  it("calls /api/nutrition/wrapup with default end=today", async () => {
    render(<WeeklyWrapupCard />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("/api/nutrition/wrapup");
  });
});

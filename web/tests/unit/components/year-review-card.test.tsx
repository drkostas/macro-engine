import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { YearReviewCard } from "@/components/year-review-card";

const FAKE_REVIEW = {
  year: 2026,
  totalDaysTracked: 200,
  daysClosed: 180,
  overallAdherencePct: 87,
  weightStart: 82.0,
  weightEnd: 77.5,
  weightDeltaKg: -4.5,
  avgKcal: 2050,
  avgProteinG: 155,
  bestStreak: 42,
  trainingDaysTotal: 120,
  months: Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    daysTracked: i < 10 ? 20 : 0,
    daysClosed: i < 10 ? 18 : 0,
    adherencePct: i < 10 ? 88 : 0,
    avgKcal: i < 10 ? 2050 : 0,
    trainingDays: i < 10 ? 12 : 0,
  })),
};

describe("YearReviewCard", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ review: FAKE_REVIEW }),
      } as Response),
    );
    global.fetch = fetchMock as typeof fetch;
    // createObjectURL/revokeObjectURL for JSON export
    Object.assign(URL, {
      createObjectURL: vi.fn(() => "blob:fake"),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => vi.resetAllMocks());

  it("loads + shows year header + 4 stat tiles", async () => {
    render(<YearReviewCard />);
    expect(screen.getByTestId("year-review-card")).toBeDefined();
    await waitFor(() => {
      expect(screen.getByText(/2026/)).toBeDefined();
      // Weight delta
      expect(screen.getByText(/4\.5/)).toBeDefined();
      // Adherence
      expect(screen.getByText(/87/)).toBeDefined();
      // Best streak
      expect(screen.getByText(/42/)).toBeDefined();
    });
  });

  it("shows training days total", async () => {
    render(<YearReviewCard />);
    await waitFor(() => {
      expect(screen.getByText(/120/)).toBeDefined();
    });
  });

  it("has a 'Download JSON' button", async () => {
    render(<YearReviewCard />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Download JSON/i })).toBeDefined(),
    );
  });

  it("clicking Download JSON triggers a blob URL", async () => {
    render(<YearReviewCard />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Download JSON/i })).toBeDefined(),
    );
    await userEvent.click(screen.getByRole("button", { name: /Download JSON/i }));
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it("fetches /api/nutrition/year-review", async () => {
    render(<YearReviewCard />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("/api/nutrition/year-review");
  });
});

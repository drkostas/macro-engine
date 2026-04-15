import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DayCompleteModal, type DayCompleteData } from "@/components/day-complete-modal";

const base: DayCompleteData = {
  actualCalories: 1800,
  targetCalories: 2000,
  tdee: 2500,
  goalDeficit: 500,
  actualProtein: 160,
  proteinTarget: 165,
  streak: 0,
};

describe("DayCompleteModal", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<DayCompleteModal open={false} data={base} onDismiss={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when data is null", () => {
    const { container } = render(<DayCompleteModal open={true} data={null} onDismiss={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows success tone when deficit is hit on target", () => {
    render(<DayCompleteModal open data={base} onDismiss={() => {}} />);
    // actualDeficit = 2500 - 1800 = 700, goal = 500 → hit with 200 kcal margin (> 50)
    expect(screen.getByText(/Deficit hit with 200 kcal to spare/)).toBeInTheDocument();
  });

  it("shows warn tone when close but missed", () => {
    render(<DayCompleteModal open data={{ ...base, actualCalories: 2050 }} onDismiss={() => {}} />);
    // actualDeficit = 2500 - 2050 = 450, goal = 500. Within 100 of goal → warn.
    expect(screen.getByText(/Close to target/)).toBeInTheDocument();
  });

  it("shows danger tone when far short of deficit", () => {
    render(<DayCompleteModal open data={{ ...base, actualCalories: 2300 }} onDismiss={() => {}} />);
    // actualDeficit = 200, short by 300. text: "Deficit short by 300"
    expect(screen.getByText(/Deficit short by 300/)).toBeInTheDocument();
  });

  it("shows over-maintenance message when actual calories exceed TDEE", () => {
    render(<DayCompleteModal open data={{ ...base, actualCalories: 2800 }} onDismiss={() => {}} />);
    expect(screen.getByText(/Ate 300 kcal over maintenance/)).toBeInTheDocument();
  });

  it("shows protein hit when >= 90% of target", () => {
    // 150 / 165 = 90.9% → hit
    render(<DayCompleteModal open data={{ ...base, actualProtein: 150 }} onDismiss={() => {}} />);
    expect(screen.getByText(/Protein hit/)).toBeInTheDocument();
  });

  it("shows protein short when < 90% of target", () => {
    render(<DayCompleteModal open data={{ ...base, actualProtein: 100 }} onDismiss={() => {}} />);
    expect(screen.getByText(/Protein short/)).toBeInTheDocument();
  });

  it("renders 7-day streak milestone", () => {
    render(<DayCompleteModal open data={{ ...base, streak: 7 }} onDismiss={() => {}} />);
    expect(screen.getByText(/7-day streak/)).toBeInTheDocument();
  });

  it("renders 30-day streak milestone", () => {
    render(<DayCompleteModal open data={{ ...base, streak: 30 }} onDismiss={() => {}} />);
    expect(screen.getByText(/30-day streak/)).toBeInTheDocument();
  });

  it("renders 100-day streak milestone", () => {
    render(<DayCompleteModal open data={{ ...base, streak: 100 }} onDismiss={() => {}} />);
    expect(screen.getByText(/100-day streak/)).toBeInTheDocument();
  });

  it("shows regular streak line for non-milestone days", () => {
    render(<DayCompleteModal open data={{ ...base, streak: 4 }} onDismiss={() => {}} />);
    expect(screen.getByText(/4 days on track/)).toBeInTheDocument();
  });

  it("calls onDismiss when Done is clicked", async () => {
    const onDismiss = vi.fn();
    const user = (await import("@testing-library/user-event")).default.setup();
    render(<DayCompleteModal open data={base} onDismiss={onDismiss} />);
    await user.click(screen.getByText("Done"));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("shows calorie summary (ate / target / burn)", () => {
    render(<DayCompleteModal open data={base} onDismiss={() => {}} />);
    expect(screen.getByText("1,800")).toBeInTheDocument();
    expect(screen.getByText("2,000")).toBeInTheDocument();
    expect(screen.getByText("2,500")).toBeInTheDocument();
  });
});

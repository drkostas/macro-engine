import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OnboardingTour } from "@/components/onboarding-tour";

const STORAGE_KEY = "me_tour_done";

describe("OnboardingTour", () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });
  afterEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  it("renders when flag is unset", async () => {
    render(<OnboardingTour />);
    // Opens after 500ms delay
    await act(() => new Promise((r) => setTimeout(r, 700)));
    expect(screen.getByRole("dialog", { name: "Onboarding tour" })).toBeInTheDocument();
    expect(screen.getByText(/Step 1 of/)).toBeInTheDocument();
  });

  it("does not render when flag is set", async () => {
    localStorage.setItem(STORAGE_KEY, "1");
    render(<OnboardingTour />);
    await act(() => new Promise((r) => setTimeout(r, 700)));
    expect(screen.queryByRole("dialog", { name: "Onboarding tour" })).not.toBeInTheDocument();
  });

  it("writes flag and closes on Skip", async () => {
    const user = userEvent.setup();
    render(<OnboardingTour />);
    await act(() => new Promise((r) => setTimeout(r, 700)));
    await user.click(screen.getByText("Skip"));
    expect(localStorage.getItem(STORAGE_KEY)).toBe("1");
    expect(screen.queryByRole("dialog", { name: "Onboarding tour" })).not.toBeInTheDocument();
  });

  it("writes flag and closes after clicking Finish on last step", async () => {
    const user = userEvent.setup();
    render(<OnboardingTour />);
    await act(() => new Promise((r) => setTimeout(r, 700)));
    // Click Next 3 times then Finish
    for (let i = 0; i < 3; i++) {
      await user.click(screen.getByText(/Next/));
    }
    await user.click(screen.getByText("Finish"));
    expect(localStorage.getItem(STORAGE_KEY)).toBe("1");
    expect(screen.queryByRole("dialog", { name: "Onboarding tour" })).not.toBeInTheDocument();
  });

  it("Back button is disabled on first step", async () => {
    render(<OnboardingTour />);
    await act(() => new Promise((r) => setTimeout(r, 700)));
    const back = screen.getByText(/Back/);
    expect(back).toBeDisabled();
  });
});

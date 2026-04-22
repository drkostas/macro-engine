import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { RefeedCard } from "@/components/refeed-card";

const TARGETS = { kcal: 2800, proteinG: 148, carbsG: 519, fatG: 52 };

describe("RefeedCard", () => {
  it("renders nothing when no data", () => {
    const { container } = render(
      <RefeedCard refeed={{ detected: false, suggestedTargets: null }} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows detection badge when detected=true", () => {
    render(
      <RefeedCard
        refeed={{ detected: true, suggestedTargets: TARGETS }}
      />,
    );
    expect(screen.getByTestId("refeed-detection-badge")).toBeDefined();
    expect(screen.getByText(/Refeed logged today/i)).toBeDefined();
    expect(screen.getByText(/reduced by 3/i)).toBeDefined();
  });

  it("hides badge when detected=false", () => {
    render(
      <RefeedCard refeed={{ detected: false, suggestedTargets: TARGETS }} />,
    );
    expect(screen.queryByTestId("refeed-detection-badge")).toBeNull();
  });

  it("plan block collapsed by default", () => {
    render(
      <RefeedCard refeed={{ detected: false, suggestedTargets: TARGETS }} />,
    );
    const toggle = screen.getByRole("button", { name: /Plan a refeed/i });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    // Macro targets hidden while collapsed
    expect(screen.queryByText(/kcal/i)).toBeNull();
  });

  it("expands plan block to reveal target grid", async () => {
    render(
      <RefeedCard refeed={{ detected: false, suggestedTargets: TARGETS }} />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Plan a refeed/i }));
    // Four stat tiles
    expect(screen.getByText("2800")).toBeDefined();
    expect(screen.getByText("148")).toBeDefined();
    expect(screen.getByText("519")).toBeDefined();
    expect(screen.getByText("52")).toBeDefined();
  });

  it("still renders plan block even without detection", () => {
    render(
      <RefeedCard refeed={{ detected: false, suggestedTargets: TARGETS }} />,
    );
    expect(screen.getByTestId("refeed-plan-block")).toBeDefined();
  });
});

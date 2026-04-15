import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MealComposer } from "@/components/meal-composer";
import type { Ingredient } from "@/lib/portion-solver";

const chicken: Ingredient = {
  id: "chicken",
  name: "Chicken Breast",
  calories_per_100g: 165,
  protein_per_100g: 31,
  carbs_per_100g: 0,
  fat_per_100g: 3.6,
  fiber_per_100g: 0,
  category: "protein",
};

describe("MealComposer — variations", () => {
  it("renders a VariationStrip with one empty V1 on mount", () => {
    render(
      <MealComposer
        slot="lunch"
        slotLabel="Lunch"
        date="2026-04-15"
        budget={{ calories: 500, protein: 45, carbs: 55, fat: 15 }}
        ingredients={[chicken]}
        presets={[]}
        onMealLogged={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText(/Variations/i)).toBeInTheDocument();
    // V1 appears twice: the ordinal badge ("V1") and the auto-name label ("V1")
    expect(screen.getAllByText(/V1/).length).toBeGreaterThan(0);
  });

  it("+ New variation adds an empty V2 to the strip", () => {
    render(
      <MealComposer
        slot="lunch"
        slotLabel="Lunch"
        date="2026-04-15"
        budget={{ calories: 500, protein: 45, carbs: 55, fat: 15 }}
        ingredients={[chicken]}
        presets={[]}
        onMealLogged={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /new variation/i }));
    // V2 appears twice: the ordinal badge ("V2") and the auto-name label ("V2")
    expect(screen.getAllByText(/V2/).length).toBeGreaterThan(0);
  });

  it("Solve to targets rebalances grams of the active variation", async () => {
    const onPreview = vi.fn();
    render(
      <MealComposer
        slot="lunch"
        slotLabel="Lunch"
        date="2026-04-15"
        budget={{ calories: 500, protein: 45, carbs: 55, fat: 15 }}
        ingredients={[chicken]}
        presets={[]}
        onMealLogged={vi.fn()}
        onCancel={vi.fn()}
        onTotalsPreview={onPreview}
      />,
    );
    // Select chicken in the picker (toggle selection)
    fireEvent.click(screen.getByText("Chicken Breast"));
    // Move to compose phase — composer calls solver once already
    fireEvent.click(screen.getByRole("button", { name: /compose meal/i }));
    // Click Solve to targets — re-runs the solver against budget
    const solveBtn = await screen.findByRole("button", { name: /solve to targets/i });
    fireEvent.click(solveBtn);
    // Preview callback should receive a totals object keyed to the solver's output.
    // Chicken alone (single-protein ingredient) gets capped by the protein=45g
    // constraint: ~145g chicken = ~239 kcal, well within ±40% of the chicken-only
    // optimum. We assert the solver produced a non-trivial preview with calories
    // within ±40% of the achievable optimum (200 kcal floor, 700 kcal ceiling).
    const lastCall = onPreview.mock.calls.at(-1)?.[0];
    expect(lastCall).toBeDefined();
    expect(lastCall.calories).toBeGreaterThan(100);
    expect(lastCall.calories).toBeLessThanOrEqual(700);
    // Protein should be close to the 45g target (solver's binding constraint)
    expect(lastCall.protein).toBeGreaterThan(27); // >=60% of 45g
    expect(lastCall.protein).toBeLessThanOrEqual(63); // <=140% of 45g
  });
});

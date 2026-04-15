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
});

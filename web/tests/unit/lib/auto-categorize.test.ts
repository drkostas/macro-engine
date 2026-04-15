import { describe, it, expect } from "vitest";
import { autoCategorizeFood, SHRINK_PRIORITY } from "@/lib/auto-categorize";

describe("autoCategorizeFood", () => {
  it("categorizes chicken breast as protein", () => {
    // chicken breast: 120kcal, 23g P, 0g C, 2.5g F
    expect(autoCategorizeFood({
      calories: 120, protein: 23, carbs: 0, fat: 2.5,
    })).toBe("protein");
  });

  it("categorizes rice as carbs", () => {
    // white rice: 130kcal, 3g P, 28g C, 0.3g F — sub-threshold, falls to 'other'
    // Use cooked rice at 365 to ensure > 40g threshold
    expect(autoCategorizeFood({
      calories: 365, protein: 7, carbs: 80, fat: 0.5,
    })).toBe("carbs");
  });

  it("categorizes olive oil as fat", () => {
    expect(autoCategorizeFood({
      calories: 884, protein: 0, carbs: 0, fat: 100,
    })).toBe("fat");
  });

  it("categorizes greek yogurt as dairy (8<=P<=15 and fat > 15)", () => {
    // A higher-fat yogurt with protein in the dairy band
    expect(autoCategorizeFood({
      calories: 200, protein: 10, carbs: 4, fat: 16,
    })).toBe("dairy");
  });

  it("categorizes broccoli as vegetable (fiber > 3, cal < 50)", () => {
    expect(autoCategorizeFood({
      calories: 34, protein: 2.8, carbs: 7, fat: 0.4, fiber: 2.6,
    })).toBe("other"); // fiber 2.6 is below > 3 threshold
    expect(autoCategorizeFood({
      calories: 24, protein: 2, carbs: 4, fat: 0.3, fiber: 3.5,
    })).toBe("vegetable");
  });

  it("categorizes low-cal high-sugar fruit", () => {
    expect(autoCategorizeFood({
      calories: 60, protein: 0.5, carbs: 15, fat: 0.2, sugar: 12,
    })).toBe("fruit");
  });

  it("falls back to 'other' for ambiguous items", () => {
    expect(autoCategorizeFood({
      calories: 200, protein: 5, carbs: 20, fat: 8,
    })).toBe("other");
  });
});

describe("SHRINK_PRIORITY", () => {
  it("carbs shrink first, vegetables never", () => {
    expect(SHRINK_PRIORITY.carbs).toBeLessThan(SHRINK_PRIORITY.protein);
    expect(SHRINK_PRIORITY.vegetable).toBeGreaterThan(SHRINK_PRIORITY.supplement);
  });
  it("protein is relatively protected", () => {
    expect(SHRINK_PRIORITY.protein).toBeGreaterThan(SHRINK_PRIORITY.carbs);
    expect(SHRINK_PRIORITY.protein).toBeGreaterThan(SHRINK_PRIORITY.fat);
  });
});

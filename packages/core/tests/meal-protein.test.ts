import { describe, it, expect } from "vitest";
import { mealProteinLevel, mealProteinThresholds } from "../src/meal-protein";
import { checkPerMealProtein } from "../src/safety-rails";

describe("protein in one meal, scaled by body weight", () => {
  it("puts the synthesis floor at 0.4 g/kg and 'more than enough' at 0.55 g/kg", () => {
    expect(mealProteinThresholds(80)).toEqual({ red: 16, amber: 27, yellow: 32, plenty: 44 });
    expect(mealProteinThresholds(75).yellow).toBe(30);
  });

  it("keeps sensible floors for a light person", () => {
    expect(mealProteinThresholds(40)).toEqual({ red: 10, amber: 17, yellow: 20, plenty: 40 });
  });

  it("falls back to fixed grams without a weight", () => {
    expect(mealProteinThresholds(null)).toEqual({ red: 15, amber: 25, yellow: 30, plenty: 55 });
    expect(mealProteinThresholds(0)).toEqual(mealProteinThresholds(undefined));
  });

  it("grades a meal at 80 kg", () => {
    expect([10, 20, 30, 40, 50].map((g) => mealProteinLevel(g, 80))).toEqual(["red", "amber", "yellow", "green", "plenty"]);
  });
});

describe("checkPerMealProtein", () => {
  it("⛔ follows the body-weight rule when it has a weight, so an app and the package agree", () => {
    expect(checkPerMealProtein(30, 80)).toBe("yellow"); // under 32 g, the floor at 80 kg
    expect(checkPerMealProtein(50, 80)).toBe("no_warning"); // above 44 g
    expect(checkPerMealProtein(40, 80)).toBe("green");
  });

  it("keeps the original fixed grams without one", () => {
    expect([14, 24, 29, 55, 56].map((g) => checkPerMealProtein(g))).toEqual(["red", "amber", "yellow", "green", "no_warning"]);
  });
});

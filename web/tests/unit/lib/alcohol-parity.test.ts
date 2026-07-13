import { describe, it, expect } from "vitest";
import { fatOxidationPauseHours, computeAlcoholDisplacement, computeDrinkEntry } from "macro-engine-core/alcohol";
import golden from "../../fixtures/golden_alcohol.json";

describe("alcohol — Python parity", () => {
  it("fatOxidationPauseHours", () => {
    for (const c of (golden as any).fatOx) expect(fatOxidationPauseHours(c.in)).toBeCloseTo(c.out, 9);
  });
  it("computeAlcoholDisplacement", () => {
    for (const c of (golden as any).displace) {
      const g = computeAlcoholDisplacement(c.in.alcoholCalories, c.in.remainingFatG, c.in.remainingCarbsG, c.in.fatFraction);
      expect(g).toEqual(c.out);
    }
  });
  it("computeDrinkEntry", () => {
    for (const c of (golden as any).drink) {
      expect(computeDrinkEntry(c.in.drinkType, c.in.quantity)).toEqual(c.out);
    }
  });
});

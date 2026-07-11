import { describe, it, expect } from "vitest";
import { computeActualTarget } from "@macro-engine/core/day-close";
import golden from "../../fixtures/golden_dayclose.json";
describe("computeActualTarget — Python parity", () => {
  it("matches all golden cases", () => {
    for (const c of golden as Array<{ in: any; out: any }>) {
      const g = computeActualTarget({ bmr: c.in.bmr, actualSteps: c.in.actualSteps, weightKg: c.in.weightKg, actualRunCal: c.in.actualRunCal, actualGymCal: c.in.actualGymCal, deficitUsed: c.in.deficitUsed });
      expect(g).toEqual(c.out);
    }
  });
});

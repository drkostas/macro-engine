import { describe, it, expect } from "vitest";
import { computeExerciseCalories } from "macro-engine-core/exercise-calories";
import golden from "../../fixtures/golden_exercise.json";
describe("computeExerciseCalories — Python parity", () => {
  it("matches all golden cases", () => {
    const bad: string[] = [];
    for (const c of golden as { in: Parameters<typeof computeExerciseCalories>[0]; out: number }[]) {
      const g = computeExerciseCalories({ workoutSteps: c.in.workoutSteps, weightKg: c.in.weightKg, age: c.in.age, sex: c.in.sex, hasGym: c.in.hasGym, runDistanceKm: c.in.runDistanceKm });
      if (Math.abs(g - c.out) > 1e-9) bad.push(`in=${JSON.stringify(c.in)} exp=${c.out} got=${g}`);
    }
    if (bad.length) throw new Error(`${bad.length} mismatch:\n${bad.slice(0,4).join("\n")}`);
    expect(bad.length).toBe(0);
  });
});

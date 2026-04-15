import { describe, it, expect } from "vitest";
import { MILESTONES, evaluateMilestones, type Stats } from "@/lib/milestones";

const base: Stats = { streak: 0, totalMealsLogged: 0, daysClosed: 0, kgLost: 0 };

describe("MILESTONES", () => {
  it("has unique ids", () => {
    const ids = MILESTONES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("evaluateMilestones", () => {
  it("unlocks nothing on a fresh account", () => {
    expect(evaluateMilestones(base).map((m) => m.id)).toEqual([]);
  });

  it("unlocks first_meal at meal #1", () => {
    expect(evaluateMilestones({ ...base, totalMealsLogged: 1 }).map((m) => m.id))
      .toContain("first_meal");
  });

  it("unlocks streak milestones at exact thresholds", () => {
    expect(evaluateMilestones({ ...base, streak: 7 }).map((m) => m.id)).toContain("streak_7");
    expect(evaluateMilestones({ ...base, streak: 29 }).map((m) => m.id)).not.toContain("streak_30");
    expect(evaluateMilestones({ ...base, streak: 30 }).map((m) => m.id)).toContain("streak_30");
    expect(evaluateMilestones({ ...base, streak: 100 }).map((m) => m.id)).toContain("streak_100");
  });

  it("cumulative unlocks: streak_30 implies streak_7", () => {
    const ids = evaluateMilestones({ ...base, streak: 30 }).map((m) => m.id);
    expect(ids).toContain("streak_7");
    expect(ids).toContain("streak_30");
  });

  it("kg lost unlocks at fractional thresholds", () => {
    expect(evaluateMilestones({ ...base, kgLost: 0.9 }).map((m) => m.id)).not.toContain("lost_1kg");
    expect(evaluateMilestones({ ...base, kgLost: 1.0 }).map((m) => m.id)).toContain("lost_1kg");
    expect(evaluateMilestones({ ...base, kgLost: 4.9 }).map((m) => m.id)).not.toContain("lost_5kg");
    expect(evaluateMilestones({ ...base, kgLost: 5.0 }).map((m) => m.id)).toContain("lost_5kg");
  });
});

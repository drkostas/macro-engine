import { describe, it, expect } from "vitest";
import {
  nutritionDayState,
  nutritionEngagement,
  WEEK_ENGAGEMENT_FLOOR_DAYS,
  type NutritionDayInput,
} from "../src/engagement";

const TODAY = "2026-09-06";

function nd(date: string, o: Partial<NutritionDayInput> = {}): NutritionDayInput {
  return { date, status: "closed", coverage: 1, ...o };
}

describe("nutritionDayState", () => {
  const cases: [string, NutritionDayInput, string][] = [
    ["closed at full coverage is complete", nd("2026-09-06"), "complete"],
    ["closed exactly at the floor is complete", nd("2026-09-06", { coverage: 0.75 }), "complete"],
    ["closed below the floor is partial, not complete", nd("2026-09-06", { coverage: 0.5 }), "partial"],
    ["open with something logged is partial", nd("2026-09-06", { status: "active", coverage: 0.25 }), "partial"],
    ["open with nothing logged is absent", nd("2026-09-06", { status: "active", coverage: 0 }), "absent"],
    ["closed with ZERO coverage is absent — the May-Jun poison", nd("2026-09-06", { coverage: 0 }), "absent"],
    ["null coverage is absent, never complete", nd("2026-09-06", { coverage: null }), "absent"],
  ];
  for (const [name, d, want] of cases) it(name, () => expect(nutritionDayState(d)).toBe(want));
});

describe("nutritionEngagement (week ending today)", () => {
  it("floor is 3 of 7, calibrated from Mar-Apr 2026 (#698)", () => {
    expect(WEEK_ENGAGEMENT_FLOOR_DAYS).toBe(3);
  });

  const cases: [string, NutritionDayInput[], string, number][] = [
    ["no rows at all is absent", [], "absent", 0],
    [
      "the user's actual recent state: a few open rows, nothing logged → absent",
      [nd("2026-09-04", { status: "active", coverage: 0 }), nd("2026-09-05", { status: "active", coverage: 0 }), nd("2026-09-06", { status: "active", coverage: 0 })],
      "absent",
      0,
    ],
    [
      "breakfast only on two days is partial",
      [nd("2026-09-05", { status: "active", coverage: 0.25 }), nd("2026-09-06", { status: "active", coverage: 0.25 })],
      "partial",
      0,
    ],
    [
      "two full days is still partial (below the floor)",
      [nd("2026-09-05"), nd("2026-09-06")],
      "partial",
      2 / 7,
    ],
    [
      "three full days is complete",
      [nd("2026-09-04"), nd("2026-09-05"), nd("2026-09-06")],
      "complete",
      3 / 7,
    ],
    [
      "seven full days is complete at coverage 1",
      ["2026-08-31", "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05", "2026-09-06"].map((d) => nd(d)),
      "complete",
      1,
    ],
    [
      "full days OUTSIDE the window do not count (an April streak is not this week)",
      [nd("2026-04-10"), nd("2026-04-11"), nd("2026-04-12"), nd("2026-09-06", { status: "active", coverage: 0 })],
      "absent",
      0,
    ],
    [
      "the poison: closed-with-zero days are absent even inside the window",
      [nd("2026-09-03", { coverage: 0 }), nd("2026-09-04", { coverage: 0 }), nd("2026-09-05", { coverage: 0 }), nd("2026-09-06", { coverage: 0 })],
      "absent",
      0,
    ],
    [
      "a future-dated row is ignored",
      [nd("2026-09-07"), nd("2026-09-06", { status: "active", coverage: 0 })],
      "absent",
      0,
    ],
  ];
  for (const [name, days, wantState, wantCov] of cases) {
    it(name, () => {
      const e = nutritionEngagement(days, TODAY);
      expect(e.state).toBe(wantState);
      expect(e.coverage).toBeCloseTo(wantCov, 6);
      expect(e.basis).toBeTruthy();
    });
  }

  it("basis names the counts", () => {
    const e = nutritionEngagement([nd("2026-09-05"), nd("2026-09-06", { status: "active", coverage: 0.5 })], TODAY);
    expect(e.basis).toContain("1 fully logged");
    expect(e.basis).toContain("1 partly logged");
  });
});

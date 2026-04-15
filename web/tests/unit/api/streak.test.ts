import { describe, it, expect } from "vitest";
import { computeStreak, type ClosedDay } from "@/app/api/nutrition/streak/route";

function day(date: string, deficitHit: boolean, slack = 0): ClosedDay {
  // tdee=2500, deficit=500 baseline; slack adjusts how much we miss/exceed by.
  return {
    date,
    tdee_used: 2500,
    deficit_used: 500,
    actual_calories: deficitHit ? 2500 - 500 - slack : 2500 - 300,
  };
}

describe("computeStreak", () => {
  it("returns 0/0 on empty input", () => {
    expect(computeStreak([])).toEqual({ streak: 0, longest: 0 });
  });

  it("current streak counts consecutive hits from most recent day", () => {
    const rows: ClosedDay[] = [
      day("2026-04-14", true),
      day("2026-04-13", true),
      day("2026-04-12", true),
      day("2026-04-11", false),
      day("2026-04-10", true),
    ];
    expect(computeStreak(rows)).toEqual({ streak: 3, longest: 3 });
  });

  it("current streak is 0 when most recent day is a miss", () => {
    const rows: ClosedDay[] = [
      day("2026-04-14", false),
      day("2026-04-13", true),
      day("2026-04-12", true),
    ];
    expect(computeStreak(rows)).toEqual({ streak: 0, longest: 2 });
  });

  it("a calendar gap breaks the current streak", () => {
    const rows: ClosedDay[] = [
      day("2026-04-14", true),
      day("2026-04-12", true), // skip 04-13
      day("2026-04-11", true),
    ];
    expect(computeStreak(rows)).toEqual({ streak: 1, longest: 2 });
  });

  it("allows up to 100 kcal slack below target deficit", () => {
    // Need deficit >= 500 - 100 = 400. actual_calories = 2500 - 400 = 2100 → hit.
    const rows: ClosedDay[] = [
      { date: "2026-04-14", tdee_used: 2500, deficit_used: 500, actual_calories: 2100 },
      { date: "2026-04-13", tdee_used: 2500, deficit_used: 500, actual_calories: 2101 }, // 399 deficit → miss
    ];
    expect(computeStreak(rows)).toEqual({ streak: 1, longest: 1 });
  });

  it("longest reflects the best historical run, not just current", () => {
    const rows: ClosedDay[] = [
      day("2026-04-14", true),
      day("2026-04-13", false),
      day("2026-04-12", true),
      day("2026-04-11", true),
      day("2026-04-10", true),
      day("2026-04-09", true),
      day("2026-04-08", false),
    ];
    expect(computeStreak(rows)).toEqual({ streak: 1, longest: 4 });
  });
});

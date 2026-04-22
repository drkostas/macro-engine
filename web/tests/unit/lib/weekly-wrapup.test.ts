/**
 * M10 Phase A — Weekly wrap-up TS mirror tests.
 * Source-of-truth: tests/test_weekly_wrapup.py
 */

import { describe, expect, it } from "vitest";
import {
  adherenceGrade,
  computeWeeklyWrapup,
  wrapupTakeaway,
  type DayRecord,
} from "@/lib/weekly-wrapup";

function day(offset: number, overrides: Partial<DayRecord> = {}): DayRecord {
  const d = new Date("2026-04-01T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + offset);
  return {
    day: d.toISOString().split("T")[0],
    targetKcal: 2000,
    actualKcal: 1950,
    proteinG: 140,
    weightKg: 75.0,
    hadTraining: false,
    wasClosed: true,
    ...overrides,
  };
}

describe("M10A.1 computeWeeklyWrapup", () => {
  it("empty → zeros", () => {
    const w = computeWeeklyWrapup([], { weightKg: 75 });
    expect(w.adherencePct).toBe(0);
    expect(w.avgKcal).toBe(0);
    expect(w.daysTotal).toBe(0);
    expect(w.weightDeltaKg).toBeNull();
  });

  it("all on-target → 100% adherence", () => {
    const days = Array.from({ length: 7 }, (_, i) => day(i, { actualKcal: 2050 }));
    expect(computeWeeklyWrapup(days, { weightKg: 75 }).adherencePct).toBe(100);
  });

  it("5/7 on target → ~71%", () => {
    const days = [
      ...Array.from({ length: 5 }, (_, i) => day(i, { actualKcal: 2050 })),
      ...Array.from({ length: 2 }, (_, i) => day(5 + i, { actualKcal: 3000 })),
    ];
    const w = computeWeeklyWrapup(days, { weightKg: 75 });
    expect(w.adherencePct).toBeGreaterThanOrEqual(70);
    expect(w.adherencePct).toBeLessThanOrEqual(72);
  });

  it("open days skipped from adherence", () => {
    const days = [
      ...Array.from({ length: 3 }, (_, i) => day(i, { wasClosed: false })),
      ...Array.from({ length: 4 }, (_, i) => day(3 + i)),
    ];
    const w = computeWeeklyWrapup(days, { weightKg: 75 });
    expect(w.adherencePct).toBe(100);
    expect(w.daysClosed).toBe(4);
    expect(w.daysTotal).toBe(7);
  });

  it("avg kcal = mean of closed days", () => {
    const days = [
      day(0, { actualKcal: 2000 }),
      day(1, { actualKcal: 2100 }),
      day(2, { actualKcal: 1900 }),
    ];
    expect(computeWeeklyWrapup(days, { weightKg: 75 }).avgKcal).toBe(2000);
  });

  it("avg protein → g/kg", () => {
    const days = Array.from({ length: 4 }, (_, i) => day(i, { proteinG: 150 }));
    const w = computeWeeklyWrapup(days, { weightKg: 75 });
    expect(w.avgProteinG).toBe(150);
    expect(w.avgProteinGPerKg).toBeCloseTo(2.0, 2);
  });

  it("training days counts flagged days", () => {
    const days = [
      day(0, { hadTraining: true }),
      day(1, { hadTraining: false }),
      day(2, { hadTraining: true }),
      day(3, { hadTraining: true }),
    ];
    expect(computeWeeklyWrapup(days, { weightKg: 75 }).trainingDays).toBe(3);
  });

  it("weight delta = last - first", () => {
    const days = [
      day(0, { weightKg: 75.0 }),
      day(1, { weightKg: 74.8 }),
      day(2, { weightKg: 74.5 }),
    ];
    expect(computeWeeklyWrapup(days, { weightKg: 75 }).weightDeltaKg).toBeCloseTo(-0.5, 2);
  });

  it("weight delta skips null weights", () => {
    const days = [
      day(0, { weightKg: 75.0 }),
      day(1, { weightKg: null }),
      day(2, { weightKg: 74.0 }),
    ];
    expect(computeWeeklyWrapup(days, { weightKg: 75 }).weightDeltaKg).toBeCloseTo(-1.0, 2);
  });
});

describe("M10A.2 adherenceGrade", () => {
  it("90+ = A", () => {
    expect(adherenceGrade(90)).toBe("A");
    expect(adherenceGrade(100)).toBe("A");
  });
  it("80-89 = B", () => {
    expect(adherenceGrade(85)).toBe("B");
  });
  it("70-79 = C", () => {
    expect(adherenceGrade(75)).toBe("C");
  });
  it("60-69 = D", () => {
    expect(adherenceGrade(65)).toBe("D");
  });
  it("<60 = F", () => {
    expect(adherenceGrade(59)).toBe("F");
    expect(adherenceGrade(0)).toBe("F");
  });
});

describe("M10A.2 wrapupTakeaway", () => {
  it("strong week → praises", () => {
    const days = Array.from({ length: 7 }, (_, i) =>
      day(i, { actualKcal: 2000, proteinG: 165, weightKg: 75 - i * 0.08, hadTraining: i % 2 === 0 }),
    );
    const w = computeWeeklyWrapup(days, { weightKg: 75 });
    const txt = wrapupTakeaway(w);
    expect(txt.length).toBeGreaterThan(0);
    expect(txt.toLowerCase()).toMatch(/strong|solid|on track/);
  });

  it("off-track flags it", () => {
    const days = Array.from({ length: 7 }, (_, i) =>
      day(i, { actualKcal: 3000, proteinG: 100 }),
    );
    const w = computeWeeklyWrapup(days, { weightKg: 75 });
    const txt = wrapupTakeaway(w);
    expect(txt.toLowerCase()).toMatch(/over|off|below/);
  });

  it("empty → safe fallback", () => {
    const txt = wrapupTakeaway(computeWeeklyWrapup([], { weightKg: 75 }));
    expect(txt.toLowerCase()).toMatch(/not enough|no data/);
  });
});

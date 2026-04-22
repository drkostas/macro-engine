/**
 * M10 Phase C — Year-in-review TS mirror tests.
 * Source-of-truth: tests/test_year_review.py
 */

import { describe, expect, it } from "vitest";
import {
  computeYearReview,
  type YearDayRecord,
} from "@/lib/year-review";

function day(year: number, offset: number, overrides: Partial<YearDayRecord> = {}): YearDayRecord {
  const d = new Date(`${year}-01-01T00:00:00Z`);
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

describe("M10C computeYearReview", () => {
  it("empty → zeros + 12 empty months", () => {
    const r = computeYearReview([], { year: 2026 });
    expect(r.year).toBe(2026);
    expect(r.totalDaysTracked).toBe(0);
    expect(r.overallAdherencePct).toBe(0);
    expect(r.weightStart).toBeNull();
    expect(r.months).toHaveLength(12);
    expect(r.months[0].month).toBe(1);
    expect(r.months[0].daysTracked).toBe(0);
  });

  it("year filter drops other years", () => {
    const days = [day(2025, 0), day(2026, 0), day(2026, 40), day(2027, 0)];
    expect(computeYearReview(days, { year: 2026 }).totalDaysTracked).toBe(2);
  });

  it("overall adherence 80%", () => {
    const hit = Array.from({ length: 8 }, (_, i) => day(2026, i, { actualKcal: 2050 }));
    const miss = Array.from({ length: 2 }, (_, i) => day(2026, 8 + i, { actualKcal: 3000 }));
    expect(computeYearReview([...hit, ...miss], { year: 2026 }).overallAdherencePct).toBe(80);
  });

  it("best streak", () => {
    const a = Array.from({ length: 3 }, (_, i) => day(2026, i));
    const gap = [day(2026, 3, { wasClosed: false })];
    const b = Array.from({ length: 5 }, (_, i) => day(2026, 4 + i));
    expect(computeYearReview([...a, ...gap, ...b], { year: 2026 }).bestStreak).toBe(5);
  });

  it("weight delta", () => {
    const days = [
      day(2026, 0, { weightKg: 80.0 }),
      day(2026, 50, { weightKg: 78.0 }),
      day(2026, 200, { weightKg: 75.5 }),
    ];
    const r = computeYearReview(days, { year: 2026 });
    expect(r.weightStart).toBeCloseTo(80.0, 1);
    expect(r.weightEnd).toBeCloseTo(75.5, 1);
    expect(r.weightDeltaKg).toBeCloseTo(-4.5, 1);
  });

  it("training days total", () => {
    const days = Array.from({ length: 20 }, (_, i) =>
      day(2026, i, { hadTraining: i % 2 === 0 }),
    );
    expect(computeYearReview(days, { year: 2026 }).trainingDaysTotal).toBe(10);
  });

  it("months per-month stats", () => {
    const jan = Array.from({ length: 5 }, (_, i) => day(2026, i));
    const mar = Array.from({ length: 3 }, (_, i) => ({
      day: `2026-03-${String(i + 1).padStart(2, "0")}`,
      targetKcal: 2000, actualKcal: 1950, proteinG: 140,
      weightKg: null, hadTraining: false, wasClosed: true,
    } as YearDayRecord));
    const r = computeYearReview([...jan, ...mar], { year: 2026 });
    expect(r.months[0].daysTracked).toBe(5);
    expect(r.months[1].daysTracked).toBe(0);
    expect(r.months[2].daysTracked).toBe(3);
  });

  it("invalid year throws", () => {
    expect(() => computeYearReview([], { year: 0 })).toThrow();
    expect(() => computeYearReview([], { year: 10000 })).toThrow();
  });
});

/**
 * M10 Phase B — Progression TS mirror tests.
 * Source-of-truth: tests/test_progression.py
 */

import { describe, expect, it } from "vitest";
import {
  computeProgressionWindow,
  type DayRecord,
} from "@/lib/progression";

function day(offset: number, overrides: Partial<DayRecord> = {}): DayRecord {
  const d = new Date("2026-01-01T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + offset);
  return {
    day: d.toISOString().split("T")[0],
    targetKcal: 2000,
    actualKcal: 1950,
    weightKg: 75.0,
    hadTraining: false,
    wasClosed: true,
    tdeeKcal: null,
    ...overrides,
  };
}

describe("M10B computeProgressionWindow", () => {
  it("empty → zeros with preserved window_days", () => {
    const w = computeProgressionWindow([], { weightKg: 75, windowDays: 30 });
    expect(w.windowDays).toBe(30);
    expect(w.weightDeltaKg).toBeNull();
    expect(w.adherenceAvgPct).toBe(0);
    expect(w.avgDailyDeficit).toBe(0);
    expect(w.trainingDays).toBe(0);
    expect(w.daysTotal).toBe(0);
  });

  it("30-day weight delta + per-week", () => {
    const days = Array.from({ length: 30 }, (_, i) =>
      day(i, { weightKg: 75.0 - i * 0.04 }),
    );
    const w = computeProgressionWindow(days, { weightKg: 75, windowDays: 30 });
    expect(w.weightDeltaKg).toBeCloseTo(-1.16, 1);
    expect(w.weightDeltaPerWeek).toBeCloseTo(-0.27, 1);
  });

  it("adherence is closed-day average", () => {
    const hit = Array.from({ length: 15 }, (_, i) => day(i, { actualKcal: 2050 }));
    const miss = Array.from({ length: 5 }, (_, i) => day(15 + i, { actualKcal: 3000 }));
    const open = Array.from({ length: 10 }, (_, i) => day(20 + i, { wasClosed: false }));
    const w = computeProgressionWindow([...hit, ...miss, ...open], {
      weightKg: 75, windowDays: 30,
    });
    expect(w.adherenceAvgPct).toBe(75);
    expect(w.daysClosed).toBe(20);
    expect(w.daysTotal).toBe(30);
  });

  it("avg daily deficit uses tdee - intake", () => {
    const days = Array.from({ length: 7 }, (_, i) =>
      day(i, { actualKcal: 2000, tdeeKcal: 2500 }),
    );
    const w = computeProgressionWindow(days, { weightKg: 75, windowDays: 30 });
    expect(w.avgDailyDeficit).toBe(500);
  });

  it("avg daily deficit falls back to target - intake", () => {
    const days = Array.from({ length: 7 }, (_, i) =>
      day(i, { targetKcal: 2500, actualKcal: 2000, tdeeKcal: null }),
    );
    const w = computeProgressionWindow(days, { weightKg: 75, windowDays: 30 });
    expect(w.avgDailyDeficit).toBe(500);
  });

  it("training days", () => {
    const days = Array.from({ length: 30 }, (_, i) =>
      day(i, { hadTraining: i % 3 === 0 }),
    );
    expect(
      computeProgressionWindow(days, { weightKg: 75, windowDays: 30 }).trainingDays,
    ).toBe(10);
  });

  it("weight delta ignores null weights", () => {
    const days = [
      day(0, { weightKg: 75.0 }),
      day(15, { weightKg: null }),
      day(29, { weightKg: 74.0 }),
    ];
    expect(
      computeProgressionWindow(days, { weightKg: 75, windowDays: 30 }).weightDeltaKg,
    ).toBeCloseTo(-1.0, 1);
  });

  it("invalid windowDays throws", () => {
    expect(() =>
      computeProgressionWindow([], { weightKg: 75, windowDays: 45 }),
    ).toThrow();
  });

  it("accepts 60 and 90", () => {
    expect(computeProgressionWindow([], { weightKg: 75, windowDays: 60 }).windowDays).toBe(60);
    expect(computeProgressionWindow([], { weightKg: 75, windowDays: 90 }).windowDays).toBe(90);
  });
});

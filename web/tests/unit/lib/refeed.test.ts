/**
 * M6 Phase A — Refeed macros TypeScript mirror tests.
 * Source-of-truth: tests/test_refeed.py
 */

import { describe, expect, it } from "vitest";
import {
  applyRefeedToCounter,
  computeRefeedTargets,
  isRefeedDay,
} from "@/lib/refeed";

describe("M6.1 isRefeedDay", () => {
  it("all conditions met → true", () => {
    expect(
      isRefeedDay({ kcal: 2800, tdee: 2800, carbsG: 400, fatG: 50, weightKg: 74 }),
    ).toBe(true);
  });

  it("kcal below 95% → false", () => {
    expect(
      isRefeedDay({ kcal: 2600, tdee: 2800, carbsG: 400, fatG: 50, weightKg: 74 }),
    ).toBe(false);
  });

  it("carbs below 5 g/kg → false", () => {
    expect(
      isRefeedDay({ kcal: 2800, tdee: 2800, carbsG: 362, fatG: 50, weightKg: 74 }),
    ).toBe(false);
  });

  it("fat above 1 g/kg → false", () => {
    expect(
      isRefeedDay({ kcal: 2800, tdee: 2800, carbsG: 400, fatG: 75, weightKg: 74 }),
    ).toBe(false);
  });

  it("boundary: exact 95% kcal passes", () => {
    expect(
      isRefeedDay({
        kcal: 0.95 * 2800, tdee: 2800, carbsG: 400, fatG: 50, weightKg: 74,
      }),
    ).toBe(true);
  });

  it("boundary: carbs exactly 5 g/kg passes", () => {
    expect(
      isRefeedDay({
        kcal: 2800, tdee: 2800, carbsG: 5.0 * 74, fatG: 50, weightKg: 74,
      }),
    ).toBe(true);
  });

  it("boundary: fat exactly 1 g/kg passes", () => {
    expect(
      isRefeedDay({
        kcal: 2800, tdee: 2800, carbsG: 400, fatG: 1.0 * 74, weightKg: 74,
      }),
    ).toBe(true);
  });

  it("throws on zero tdee", () => {
    expect(() =>
      isRefeedDay({ kcal: 2000, tdee: 0, carbsG: 400, fatG: 50, weightKg: 74 }),
    ).toThrow(RangeError);
  });
});

describe("M6.2 computeRefeedTargets", () => {
  it("maintenance at user profile", () => {
    const r = computeRefeedTargets({ weightKg: 74.2, tdee: 2800 });
    expect(r.proteinG).toBe(148);
    expect(r.carbsG).toBe(519);
    expect(r.fatG).toBe(52);
    expect(r.kcal).toBe(2800);
  });

  it("plus_5 intensity", () => {
    const r = computeRefeedTargets({
      weightKg: 74.2, tdee: 2800, intensity: "plus_5",
    });
    expect(r.kcal).toBe(Math.round(2800 * 1.05));
  });

  it("plus_10 intensity", () => {
    const r = computeRefeedTargets({
      weightKg: 74.2, tdee: 2800, intensity: "plus_10",
    });
    expect(r.kcal).toBe(Math.round(2800 * 1.10));
  });

  it("throws on invalid inputs", () => {
    expect(() => computeRefeedTargets({ weightKg: -1, tdee: 2800 })).toThrow(RangeError);
    expect(() => computeRefeedTargets({ weightKg: 74, tdee: 0 })).toThrow(RangeError);
  });
});

describe("M6.3 applyRefeedToCounter", () => {
  it("single refeed subtracts 3", () => {
    expect(applyRefeedToCounter(10, { refeedLengthDays: 1 })).toBe(7);
  });

  it("two-day refeed subtracts 6", () => {
    expect(applyRefeedToCounter(10, { refeedLengthDays: 2 })).toBe(4);
  });

  it("floors at zero", () => {
    expect(applyRefeedToCounter(2, { refeedLengthDays: 2 })).toBe(0);
  });

  it("zero counter stays zero", () => {
    expect(applyRefeedToCounter(0, { refeedLengthDays: 1 })).toBe(0);
  });

  it("invalid length throws", () => {
    expect(() =>
      applyRefeedToCounter(10, { refeedLengthDays: 3 as 1 | 2 }),
    ).toThrow(RangeError);
  });
});

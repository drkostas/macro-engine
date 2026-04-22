/**
 * M3 Body Composition — TypeScript mirror of Python tests.
 *
 * Source-of-truth: tests/test_forbes.py, test_method_sigma.py,
 * test_creatine_water.py.
 */

import { describe, expect, it } from "vitest";
import {
  ALL_METHODS,
  biaCreatineCorrection,
  creatineWaterAdjustment,
  effectiveSigmaKg,
  methodSigmaKg,
  partitionWeightChange,
  type Method,
} from "@/lib/body-comp";

describe("Forbes partitioning (M3.1)", () => {
  it("zero change → zero everywhere", () => {
    const r = partitionWeightChange(0.0, 20.0);
    expect(r.dFfmKg).toBeCloseTo(0, 9);
    expect(r.dFmKg).toBeCloseTo(0, 9);
  });

  it("gain at fm=20 → ffm_fraction ≈ 10.4/30.4", () => {
    const r = partitionWeightChange(1.0, 20.0);
    expect(r.ffmFraction).toBeCloseTo(10.4 / 30.4, 6);
    expect(r.dFfmKg).toBeCloseTo(10.4 / 30.4, 6);
    expect(r.dFmKg).toBeCloseTo(1.0 - 10.4 / 30.4, 6);
  });

  it("loss at fm=10 → ffm_fraction ≈ 10.4/20.4", () => {
    const r = partitionWeightChange(-1.0, 10.0);
    expect(r.ffmFraction).toBeCloseTo(10.4 / 20.4, 6);
    expect(r.dFfmKg).toBeCloseTo(-10.4 / 20.4, 6);
  });

  it("high FM biases toward fat", () => {
    const r = partitionWeightChange(1.0, 90.0);
    expect(r.ffmFraction).toBeLessThan(0.12);
    expect(r.dFmKg).toBeGreaterThan(r.dFfmKg);
  });

  it("low FM biases toward lean", () => {
    const r = partitionWeightChange(1.0, 3.0);
    expect(r.ffmFraction).toBeGreaterThan(0.7);
    expect(r.dFfmKg).toBeGreaterThan(r.dFmKg);
  });

  it("recomp shrinks ffm fraction by 0.6×", () => {
    const base = partitionWeightChange(1.0, 20.0);
    const rec = partitionWeightChange(1.0, 20.0, { recomp: true });
    expect(rec.ffmFraction).toBeCloseTo(base.ffmFraction * 0.6, 6);
  });

  it("invariant: dFfm + dFm == dBw", () => {
    for (const dBw of [-2.0, -0.5, 0.5, 2.0]) {
      for (const fm of [5.0, 15.0, 30.0, 60.0]) {
        const r = partitionWeightChange(dBw, fm);
        expect(r.dFfmKg + r.dFmKg).toBeCloseTo(dBw, 9);
      }
    }
  });

  it("negative fmKg throws", () => {
    expect(() => partitionWeightChange(1.0, -5.0)).toThrow(RangeError);
  });
});

describe("Method sigmas (M3.2)", () => {
  it.each([
    ["dexa", 1.0],
    ["caliper", 2.0],
    ["navy", 2.2],
    ["bia", 2.5],
    ["nhanes", 3.0],
  ] as [Method, number][])("base sigma for %s = %f", (method, expected) => {
    expect(methodSigmaKg(method)).toBeCloseTo(expected);
  });

  it("fresh → base", () => {
    expect(effectiveSigmaKg("dexa", 0)).toBeCloseTo(1.0);
  });

  it("12 weeks → still base", () => {
    expect(effectiveSigmaKg("bia", 12)).toBeCloseTo(2.5);
  });

  it("24 weeks adds 1.2 kg", () => {
    expect(effectiveSigmaKg("navy", 24)).toBeCloseTo(2.2 + 1.2);
  });

  it("36 weeks adds 2.4 kg", () => {
    expect(effectiveSigmaKg("dexa", 36)).toBeCloseTo(1.0 + 2.4);
  });

  it("negative weeks treated as fresh", () => {
    expect(effectiveSigmaKg("dexa", -2)).toBeCloseTo(1.0);
  });

  it.each(ALL_METHODS)("%s has positive sigma", (m: Method) => {
    expect(methodSigmaKg(m)).toBeGreaterThan(0);
  });
});

describe("Creatine water correction (M3.3)", () => {
  const today = new Date("2026-04-22T00:00:00Z");
  const daysAgo = (n: number) => new Date(today.getTime() - n * 24 * 60 * 60 * 1000);

  it("zero dose → zero", () => {
    expect(
      creatineWaterAdjustment({
        ffmKg: 60, doseGPerDay: 0, startDate: daysAgo(30), today,
      }),
    ).toBeCloseTo(0);
  });

  it("null start + positive dose → full W_max", () => {
    const offset = creatineWaterAdjustment({
      ffmKg: 60, doseGPerDay: 5, startDate: null, today,
    });
    expect(offset).toBeCloseTo(0.0155 * 60, 6);
  });

  it("loading day 7 ≥ 96% of W_max", () => {
    const offset = creatineWaterAdjustment({
      ffmKg: 60, doseGPerDay: 20, startDate: daysAgo(7), today,
    });
    const wMax = 0.0155 * 60;
    expect(offset).toBeGreaterThanOrEqual(wMax * 0.96);
  });

  it("non-loading day 28 ≥ 96% of W_max", () => {
    const offset = creatineWaterAdjustment({
      ffmKg: 60, doseGPerDay: 5, startDate: daysAgo(28), today,
    });
    const wMax = 0.0155 * 60;
    expect(offset).toBeGreaterThanOrEqual(wMax * 0.96);
  });

  it("loading threshold is 15 g/day inclusive", () => {
    const loading = creatineWaterAdjustment({
      ffmKg: 60, doseGPerDay: 15, startDate: daysAgo(5), today,
    });
    const nonLoading = creatineWaterAdjustment({
      ffmKg: 60, doseGPerDay: 14.9, startDate: daysAgo(5), today,
    });
    expect(loading).toBeGreaterThan(nonLoading);
  });

  it("42 days after stop nearly cleared", () => {
    const offset = creatineWaterAdjustment({
      ffmKg: 60, doseGPerDay: 5,
      startDate: daysAgo(90), today, stopDate: daysAgo(42),
    });
    const wMax = 0.0155 * 60;
    expect(offset).toBeLessThan(wMax * 0.1);
  });

  it("FFM scales linearly", () => {
    const a = creatineWaterAdjustment({
      ffmKg: 50, doseGPerDay: 5, startDate: null, today,
    });
    const b = creatineWaterAdjustment({
      ffmKg: 100, doseGPerDay: 5, startDate: null, today,
    });
    expect(b).toBeCloseTo(a * 2, 6);
  });

  it("BIA correction divides by 0.73", () => {
    expect(biaCreatineCorrection(0.73)).toBeCloseTo(1.0);
    expect(biaCreatineCorrection(0)).toBeCloseTo(0);
  });

  it("negative dose throws", () => {
    expect(() =>
      creatineWaterAdjustment({
        ffmKg: 60, doseGPerDay: -5, startDate: null, today,
      }),
    ).toThrow(RangeError);
  });

  it("future start date → zero", () => {
    const future = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
    expect(
      creatineWaterAdjustment({
        ffmKg: 60, doseGPerDay: 5, startDate: future, today,
      }),
    ).toBeCloseTo(0);
  });
});

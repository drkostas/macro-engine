/**
 * M9 Phase D — Race taper TypeScript mirror tests.
 * Source-of-truth: tests/test_taper.py
 */

import { describe, expect, it } from "vitest";
import {
  classifyTaperPhase,
  taperCarbGPerKg,
  taperProteinGPerKg,
} from "@/lib/taper";

const TODAY = new Date("2026-04-22T00:00:00Z");
const dOffset = (n: number) =>
  new Date(TODAY.getTime() + n * 86400000);

describe("M9D.1 classifyTaperPhase", () => {
  it("null race_date → normal", () => {
    expect(classifyTaperPhase(null, TODAY)).toBe("normal");
  });

  it("15d out → normal", () => {
    expect(classifyTaperPhase(dOffset(15), TODAY)).toBe("normal");
  });

  it("14d out → volume_taper", () => {
    expect(classifyTaperPhase(dOffset(14), TODAY)).toBe("volume_taper");
  });

  it("8d out → volume_taper", () => {
    expect(classifyTaperPhase(dOffset(8), TODAY)).toBe("volume_taper");
  });

  it("7d out → intensity_taper", () => {
    expect(classifyTaperPhase(dOffset(7), TODAY)).toBe("intensity_taper");
  });

  it("4d out → intensity_taper", () => {
    expect(classifyTaperPhase(dOffset(4), TODAY)).toBe("intensity_taper");
  });

  it("3d out → glycogen_loading", () => {
    expect(classifyTaperPhase(dOffset(3), TODAY)).toBe("glycogen_loading");
  });

  it("1d out → glycogen_loading", () => {
    expect(classifyTaperPhase(dOffset(1), TODAY)).toBe("glycogen_loading");
  });

  it("race day → race_day", () => {
    expect(classifyTaperPhase(TODAY, TODAY)).toBe("race_day");
  });

  it("1d after → recovery", () => {
    expect(classifyTaperPhase(dOffset(-1), TODAY)).toBe("recovery");
  });

  it("7d after → recovery", () => {
    expect(classifyTaperPhase(dOffset(-7), TODAY)).toBe("recovery");
  });

  it("8d after → normal", () => {
    expect(classifyTaperPhase(dOffset(-8), TODAY)).toBe("normal");
  });
});

describe("M9D.2 taperCarbGPerKg", () => {
  it("normal → baseline", () => {
    expect(taperCarbGPerKg("normal", { baselineGPerKg: 5.0 })).toBe(5.0);
  });
  it("volume_taper → 6", () => {
    expect(taperCarbGPerKg("volume_taper", { baselineGPerKg: 5.0 })).toBe(6.0);
  });
  it("intensity_taper → 7", () => {
    expect(taperCarbGPerKg("intensity_taper", { baselineGPerKg: 5.0 })).toBe(7.0);
  });
  it("glycogen_loading → 10", () => {
    expect(taperCarbGPerKg("glycogen_loading", { baselineGPerKg: 5.0 })).toBe(10.0);
  });
  it("race_day → 9", () => {
    expect(taperCarbGPerKg("race_day", { baselineGPerKg: 5.0 })).toBe(9.0);
  });
  it("recovery → 7", () => {
    expect(taperCarbGPerKg("recovery", { baselineGPerKg: 5.0 })).toBe(7.0);
  });
  it("never below baseline", () => {
    expect(taperCarbGPerKg("volume_taper", { baselineGPerKg: 8.0 })).toBe(8.0);
  });
  it("negative baseline throws", () => {
    expect(() => taperCarbGPerKg("normal", { baselineGPerKg: -1 })).toThrow(RangeError);
  });
});

describe("M9D.2 taperProteinGPerKg", () => {
  it("floors at 1.8", () => {
    expect(taperProteinGPerKg("volume_taper", { baselineGPerKg: 1.5 })).toBe(1.8);
  });
  it("respects higher baseline", () => {
    expect(taperProteinGPerKg("race_day", { baselineGPerKg: 2.5 })).toBe(2.5);
  });
  it("negative baseline throws", () => {
    expect(() => taperProteinGPerKg("normal", { baselineGPerKg: -1 })).toThrow(RangeError);
  });
});

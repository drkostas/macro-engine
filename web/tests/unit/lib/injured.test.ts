/**
 * M9 Phase A — Injured mode TypeScript mirror tests.
 * Source-of-truth: tests/test_injured.py
 */

import { describe, expect, it } from "vitest";
import {
  ALL_INJURY_TYPES,
  classifyInjuryPhase,
  getInjuryModule,
  injuredEaHardFloor,
  injuryProteinGPerKg,
  type InjuryType,
} from "@/lib/injured";

const TODAY = new Date("2026-04-22T00:00:00Z");
const daysAgo = (n: number) =>
  new Date(TODAY.getTime() - n * 24 * 60 * 60 * 1000);

describe("M9.1 Injury phase", () => {
  it("day 0 → acute", () => {
    expect(classifyInjuryPhase(TODAY, TODAY)).toBe("acute");
  });

  it("day 10 → acute", () => {
    expect(classifyInjuryPhase(daysAgo(10), TODAY)).toBe("acute");
  });

  it("day 11 → subacute", () => {
    expect(classifyInjuryPhase(daysAgo(11), TODAY)).toBe("subacute");
  });

  it("day 42 → subacute", () => {
    expect(classifyInjuryPhase(daysAgo(42), TODAY)).toBe("subacute");
  });

  it("day 43 → chronic", () => {
    expect(classifyInjuryPhase(daysAgo(43), TODAY)).toBe("chronic");
  });

  it("future date throws", () => {
    const future = new Date(TODAY.getTime() + 5 * 86400000);
    expect(() => classifyInjuryPhase(future, TODAY)).toThrow(RangeError);
  });
});

describe("M9.2 Injury protein", () => {
  it("default → 2.2", () => {
    expect(injuryProteinGPerKg("default", { preInjuryGPerKg: 2.0 })).toBe(2.2);
  });

  it("immobilization / acl → 2.4", () => {
    expect(injuryProteinGPerKg("immobilization", { preInjuryGPerKg: 2.0 })).toBe(2.4);
    expect(injuryProteinGPerKg("acl", { preInjuryGPerKg: 2.0 })).toBe(2.4);
  });

  it("severe → 2.5", () => {
    expect(injuryProteinGPerKg("severe", { preInjuryGPerKg: 2.0 })).toBe(2.5);
  });

  it("never below pre-injury", () => {
    expect(injuryProteinGPerKg("default", { preInjuryGPerKg: 2.8 })).toBe(2.8);
  });
});

describe("M9.3 Injured EA floor", () => {
  it("FFM 55, rehab 300 → 1950", () => {
    expect(injuredEaHardFloor({ ffmKg: 55, rehabKcal: 300 })).toBe(1950);
  });

  it("FFM 70, no rehab → 2100", () => {
    expect(injuredEaHardFloor({ ffmKg: 70, rehabKcal: 0 })).toBe(2100);
  });

  it("FFM 45, high rehab → 2150", () => {
    expect(injuredEaHardFloor({ ffmKg: 45, rehabKcal: 800 })).toBe(2150);
  });

  it("negative values throw", () => {
    expect(() => injuredEaHardFloor({ ffmKg: -1, rehabKcal: 0 })).toThrow(RangeError);
    expect(() => injuredEaHardFloor({ ffmKg: 60, rehabKcal: -1 })).toThrow(RangeError);
  });
});

describe("M9.4 Injury module", () => {
  it("tendon → gelatin + vit C", () => {
    const m = getInjuryModule("tendon");
    expect(m.supplements).toContain("gelatin");
    expect(m.supplements).toContain("vitamin C");
  });

  it("concussion → creatine", () => {
    expect(getInjuryModule("concussion").supplements).toContain("creatine");
  });

  it("acl → omega-3", () => {
    expect(getInjuryModule("acl").supplements).toContain("omega-3");
  });

  it("bone → calcium + vit D", () => {
    const m = getInjuryModule("bone");
    expect(m.supplements).toContain("calcium");
    expect(m.supplements).toContain("vitamin D");
  });

  it("strain → standard", () => {
    expect(getInjuryModule("strain").label).toBe("Standard recovery");
  });

  it.each(ALL_INJURY_TYPES)("every type returns a module: %s", (t: InjuryType) => {
    const m = getInjuryModule(t);
    expect(m.label).toBeTruthy();
  });
});

/**
 * M2 Mode Engine — TypeScript mirror of Python tests.
 *
 * Source-of-truth: tests/test_mode.py, test_mode_availability.py,
 * test_mode_transitions.py.
 *
 * When the Python tests change, these must be updated to match.
 */

import { describe, expect, it } from "vitest";
import {
  ALL_MODES,
  checkModeAvailability,
  checkTransition,
  getModeConfig,
  type Mode,
} from "@/lib/mode-engine";
import type { Tier } from "@/lib/safety-rails";

const ALL_TIERS: Tier[] = ["T1", "T2", "T3", "T4", "T5"];

describe("Mode enum + config (M2.1)", () => {
  it("has six modes", () => {
    expect(ALL_MODES).toHaveLength(6);
  });

  it("standard: T1-T4, no hard floor, no bridge, indefinite", () => {
    const c = getModeConfig("standard");
    expect([...c.tierAllowed].sort()).toEqual(["T1", "T2", "T3", "T4"]);
    expect(c.bfHardFloorPct).toBeNull();
    expect(c.requiresReverseBridgeFrom.size).toBe(0);
    expect(c.maxDurationDays).toBeNull();
  });

  it("aggressive: T1-T2 only, 12% hard floor, 84d max (12wk)", () => {
    const c = getModeConfig("aggressive");
    expect([...c.tierAllowed].sort()).toEqual(["T1", "T2"]);
    expect(c.bfHardFloorPct).toBe(12.0);
    expect(c.maxDurationDays).toBe(84);
  });

  it("reverse: all tiers, 42d max (6wk post-aggressive)", () => {
    const c = getModeConfig("reverse");
    expect(c.tierAllowed.size).toBe(5);
    expect(c.maxDurationDays).toBe(42);
  });

  it("maintenance: all tiers, indefinite", () => {
    const c = getModeConfig("maintenance");
    expect(c.tierAllowed.size).toBe(5);
    expect(c.bfHardFloorPct).toBeNull();
    expect(c.maxDurationDays).toBeNull();
  });

  it("bulk: T2-T5, requires reverse bridge from Standard/Aggressive, 140d max", () => {
    const c = getModeConfig("bulk");
    expect([...c.tierAllowed].sort()).toEqual(["T2", "T3", "T4", "T5"]);
    expect([...c.requiresReverseBridgeFrom].sort()).toEqual([
      "aggressive",
      "standard",
    ]);
    expect(c.maxDurationDays).toBe(140);
  });

  it("injured: all tiers, no caps", () => {
    const c = getModeConfig("injured");
    expect(c.tierAllowed.size).toBe(5);
    expect(c.bfHardFloorPct).toBeNull();
    expect(c.maxDurationDays).toBeNull();
  });

  it.each(ALL_MODES)("every mode has a config (%s)", (mode: Mode) => {
    const c = getModeConfig(mode);
    expect(c.tierAllowed.size).toBeGreaterThan(0);
  });
});

describe("Mode availability (M2.2)", () => {
  it("standard allowed for T1-T4", () => {
    for (const tier of ["T1", "T2", "T3", "T4"] as Tier[]) {
      expect(checkModeAvailability("standard", tier, 22.0).allowed).toBe(true);
    }
  });

  it("standard blocked at T5", () => {
    const r = checkModeAvailability("standard", "T5", 9.0);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("tier_not_allowed");
  });

  it("aggressive blocked at T3+", () => {
    for (const tier of ["T3", "T4", "T5"] as Tier[]) {
      const r = checkModeAvailability("aggressive", tier, 14.0);
      expect(r.allowed).toBe(false);
      expect(r.reason).toBe("tier_not_allowed");
    }
  });

  it("aggressive blocked at BF=12% (hard floor, inclusive)", () => {
    const r = checkModeAvailability("aggressive", "T2", 12.0);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("bf_below_hard_floor");
  });

  it("aggressive allowed just above 12%", () => {
    expect(checkModeAvailability("aggressive", "T2", 12.1).allowed).toBe(true);
  });

  it("bulk blocked at T1 (>28% BF — must cut first)", () => {
    const r = checkModeAvailability("bulk", "T1", 30.0);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("tier_not_allowed");
  });

  it("injured allowed at every tier", () => {
    for (const tier of ALL_TIERS) {
      expect(checkModeAvailability("injured", tier, 10.0).allowed).toBe(true);
    }
  });

  it("no (mode × tier) combo throws", () => {
    for (const mode of ALL_MODES) {
      for (const tier of ALL_TIERS) {
        const r = checkModeAvailability(mode, tier, 20.0);
        expect(typeof r.allowed).toBe("boolean");
      }
    }
  });
});

describe("Mode transitions (M2.3)", () => {
  const T = "T2" as Tier;
  const BF = 23.5;

  it("same-mode transition is a no-op allow", () => {
    for (const mode of ALL_MODES) {
      expect(checkTransition(mode, mode, T, BF).allowed).toBe(true);
    }
  });

  it("any → injured always allowed", () => {
    for (const mode of ALL_MODES) {
      expect(checkTransition(mode, "injured", T, BF).allowed).toBe(true);
    }
  });

  it("aggressive → reverse allowed", () => {
    expect(checkTransition("aggressive", "reverse", T, BF).allowed).toBe(true);
  });

  it.each(["standard", "maintenance"] as Mode[])(
    "aggressive → %s blocked with AGGRESSIVE_REQUIRES_REVERSE",
    (target: Mode) => {
      const r = checkTransition("aggressive", target, T, BF);
      expect(r.allowed).toBe(false);
      expect(r.reason).toBe("aggressive_requires_reverse");
    },
  );

  it("aggressive → bulk uses bridge reason (more actionable)", () => {
    const r = checkTransition("aggressive", "bulk", T, BF);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("requires_reverse_bridge");
    expect(r.requiresBridge).toBe("reverse");
  });

  it("standard → bulk requires reverse bridge", () => {
    const r = checkTransition("standard", "bulk", T, BF);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("requires_reverse_bridge");
    expect(r.requiresBridge).toBe("reverse");
  });

  it("reverse → bulk allowed", () => {
    expect(checkTransition("reverse", "bulk", T, BF).allowed).toBe(true);
  });

  it("maintenance → bulk allowed (no bridge needed)", () => {
    expect(checkTransition("maintenance", "bulk", T, BF).allowed).toBe(true);
  });

  it("bulk → standard/aggressive/maintenance allowed at eligible tier", () => {
    for (const target of ["standard", "aggressive", "maintenance"] as Mode[]) {
      expect(checkTransition("bulk", target, T, 22.0).allowed).toBe(true);
    }
  });

  it("standard → aggressive blocked at T3", () => {
    const r = checkTransition("standard", "aggressive", "T3", 17.0);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("mode_not_available");
  });

  it("maintenance → bulk blocked at T1", () => {
    const r = checkTransition("maintenance", "bulk", "T1", 30.0);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("mode_not_available");
  });

  it("injured → aggressive still runs availability gate", () => {
    const r = checkTransition("injured", "aggressive", "T3", 17.0);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("mode_not_available");
  });

  it("every (current, next) pair resolves without throwing", () => {
    for (const a of ALL_MODES) {
      for (const b of ALL_MODES) {
        const r = checkTransition(a, b, T, BF);
        expect(typeof r.allowed).toBe("boolean");
      }
    }
  });
});

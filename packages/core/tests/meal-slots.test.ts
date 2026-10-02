import { describe, it, expect } from "vitest";
import {
  DAY_SLOTS, DEFAULT_MEAL_KCAL, emptySlots, nextMealSlot, slotBudget, slotForHour, slotsRemaining,
} from "../src/meal-slots";

describe("slotForHour", () => {
  it("uses the boundaries the widgets use: 11, 16 and 21", () => {
    expect([0, 10, 11, 15, 16, 20, 21, 23].map(slotForHour)).toEqual([
      "breakfast", "breakfast", "lunch", "lunch", "dinner", "dinner", "pre_sleep", "pre_sleep",
    ]);
  });
});

describe("nextMealSlot", () => {
  it("⛔ never files food arriving in the afternoon as a skipped breakfast", () => {
    expect(nextMealSlot([], "lunch")).toBe("lunch");
  });
  it("takes the first empty slot at or after the clock", () => {
    expect(nextMealSlot([{ slot: "lunch" }], "lunch")).toBe("dinner");
  });
  it("falls back to the last slot when everything from now on is taken", () => {
    expect(nextMealSlot([{ slot: "dinner" }, { slot: "pre_sleep" }], "dinner")).toBe("pre_sleep");
  });
  it("starts at the beginning for a slot outside the day", () => {
    expect(nextMealSlot([{ slot: "breakfast" }], "during_workout")).toBe("lunch");
  });
});

describe("emptySlots", () => {
  it("lists the empty slots in day order", () => {
    expect(emptySlots([{ slot: "lunch" }, { slot: "during_workout" }])).toEqual(["breakfast", "dinner", "pre_sleep"]);
    expect(DAY_SLOTS).toEqual(["breakfast", "lunch", "dinner", "pre_sleep"]);
  });
});

describe("slot budget", () => {
  it("counts this slot and the ones after it", () => {
    expect(slotsRemaining("breakfast")).toBe(4);
    expect(slotsRemaining("pre_sleep")).toBe(1);
    expect(slotsRemaining("during_workout")).toBe(1);
  });
  it("splits what is left of the day evenly", () => {
    expect(slotBudget({ dayTarget: 2000, consumed: 500, slotsLeft: 3 })).toBe(500);
  });
  it("gives nothing once the day is spent, and an ordinary meal when there is no plan", () => {
    expect(slotBudget({ dayTarget: 2000, consumed: 2100, slotsLeft: 2 })).toBe(0);
    expect(slotBudget({ dayTarget: 0, consumed: 0, slotsLeft: 4 })).toBe(DEFAULT_MEAL_KCAL);
  });
});

import { SLOT_KCAL_SHARES, slotBudgetByShare } from "../src/meal-slots";

describe("slotBudgetByShare (the plan's shares)", () => {
  const day = { dayTarget: 2000, consumed: 0 };
  it("gives breakfast its 28% of a fresh day", () => {
    expect(slotBudgetByShare({ ...day, slot: "breakfast" })).toBe(560);
  });
  it("gives dinner 37/47 of what is left once breakfast and lunch are done", () => {
    expect(slotBudgetByShare({ dayTarget: 2000, consumed: 1000, slot: "dinner" })).toBe(787);
  });
  it("gives the last slot everything left, like the plan does", () => {
    expect(slotBudgetByShare({ dayTarget: 2000, consumed: 1700, slot: "pre_sleep" })).toBe(300);
  });
  it("gives a slot outside the day what is left, nothing once the day is spent, and a default without a plan", () => {
    expect(slotBudgetByShare({ dayTarget: 2000, consumed: 1500, slot: "during_workout" })).toBe(500);
    expect(slotBudgetByShare({ dayTarget: 2000, consumed: 2100, slot: "lunch" })).toBe(0);
    expect(slotBudgetByShare({ dayTarget: 0, consumed: 0, slot: "lunch" })).toBe(500);
  });
  it("uses the same shares as the plan", () => {
    expect(SLOT_KCAL_SHARES).toEqual({ breakfast: 0.28, lunch: 0.25, dinner: 0.37, pre_sleep: 0.1 });
  });
});

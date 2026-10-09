/**
 * Which meal a piece of food belongs to, and how much of the day is left for it.
 *
 * Every surface (the web, the app, the widgets) has to agree on these, so they live in one place.
 * The day has four slots in order. `during_workout` is fuelling, not a point in the day, so it sits
 * outside the order.
 */

/** The slots that make up a day, in order. */
export const DAY_SLOTS = ["breakfast", "lunch", "dinner", "pre_sleep"] as const;
export type DaySlot = (typeof DAY_SLOTS)[number];

/** A day with no plan still gets an ordinary meal rather than a budget of nothing. */
export const DEFAULT_MEAL_KCAL = 500;

/** The slot the clock suggests for a local hour (0 to 23). */
export function slotForHour(h: number): string {
  if (h < 11) return "breakfast";
  if (h < 16) return "lunch";
  if (h < 21) return "dinner";
  return "pre_sleep";
}

/** The slots with nothing in them yet, in the order they come. */
export function emptySlots(logged: Array<{ slot: string }>): string[] {
  const taken = new Set(logged.map((m) => m.slot));
  return DAY_SLOTS.filter((s) => !taken.has(s));
}

/**
 * Where the next proper meal belongs: the first empty slot at or after the one the clock suggests.
 *
 * Not simply the earliest empty slot. With nothing logged at half past three that would be
 * breakfast, and a plate of chicken and rice would be filed as breakfast. A slot in the past that
 * was skipped stays skipped, and food arriving now belongs now or later.
 *
 * When everything from here on is taken, it is the last slot of the day, because the food exists
 * and has to go somewhere.
 */
export function nextMealSlot(logged: Array<{ slot: string }>, clockSlot: string): string {
  const from = DAY_SLOTS.indexOf(clockSlot as DaySlot);
  const start = from < 0 ? 0 : from;
  const empty = new Set(emptySlots(logged));
  for (let i = start; i < DAY_SLOTS.length; i++) {
    if (empty.has(DAY_SLOTS[i])) return DAY_SLOTS[i];
  }
  return DAY_SLOTS[DAY_SLOTS.length - 1];
}

/** How many slots of the day remain, counting this one. A slot outside the day gets what is left. */
export function slotsRemaining(slot: string): number {
  const i = DAY_SLOTS.indexOf(slot as DaySlot);
  return i < 0 ? 1 : DAY_SLOTS.length - i;
}

/** An even share of what is left of the day for each remaining slot. */
export function slotBudget(o: { dayTarget: number; consumed: number; slotsLeft: number }): number {
  if (!o.dayTarget) return DEFAULT_MEAL_KCAL;
  const left = o.dayTarget - o.consumed;
  if (left <= 0) return 0;
  return Math.round(left / Math.max(1, o.slotsLeft));
}

/** The share of the day's calories each slot gets in a plan: breakfast 28%, lunch 25%, dinner 37%, pre-sleep 10%. */
export const SLOT_KCAL_SHARES: Readonly<Record<DaySlot, number>> = { breakfast: 0.28, lunch: 0.25, dinner: 0.37, pre_sleep: 0.1 };

/**
 * What is left of the day for this slot, split by the plan's shares over this slot and the ones
 * after it. Earlier slots count as done, eaten or not, which is how a plan redistributes too. A slot
 * outside the day (during_workout) gets what is left.
 */
export function slotBudgetByShare(o: {
  dayTarget: number; consumed: number; slot: string; shares?: Readonly<Record<string, number>>;
}): number {
  if (!o.dayTarget) return DEFAULT_MEAL_KCAL;
  const left = o.dayTarget - o.consumed;
  if (left <= 0) return 0;
  const shares: Readonly<Record<string, number>> = o.shares ?? SLOT_KCAL_SHARES;
  const i = DAY_SLOTS.indexOf(o.slot as DaySlot);
  if (i < 0) return Math.round(left);
  const ahead = DAY_SLOTS.slice(i).reduce((s, x) => s + (shares[x] ?? 0), 0);
  return ahead > 0 ? Math.round(left * (shares[o.slot] ?? 0) / ahead) : Math.round(left);
}

import { describe, it, expect, vi, afterEach } from "vitest";
import { logMeal, saveOnboard, updateProfile, closeDay, type FoodResult, type OnboardProfile } from "./api";

function stubFetch(response: unknown, ok = true) {
  const f = vi.fn().mockResolvedValue({ ok, json: async () => response });
  vi.stubGlobal("fetch", f);
  return f;
}

afterEach(() => vi.unstubAllGlobals());

const food: FoodResult = {
  id: 1, name: "Oats", brand: null, calories: 380, protein: 13, carbs: 67, fat: 7, fiber: 10,
  serving_description: "100 g",
};

describe("macro-engine universal api payload builders", () => {
  it("logMeal scales macros by grams/100 and posts one item", async () => {
    const f = stubFetch({ id: 1 });
    await logMeal("2026-07-16", "breakfast", food, 50); // f = 0.5
    const [url, opts] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/nutrition/log-meal");
    expect(opts.method).toBe("POST");
    const body = JSON.parse(opts.body as string);
    expect(body).toMatchObject({ date: "2026-07-16", meal_slot: "breakfast", source: "macro_engine" });
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({ name: "Oats", grams: 50, calories: 190, protein: 6.5, carbs: 33.5, fat: 3.5, fiber: 5 });
  });

  it("logMeal defaults to 100 g (unscaled)", async () => {
    const f = stubFetch({ id: 2 });
    await logMeal("2026-07-16", "lunch", food);
    const body = JSON.parse((f.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.items[0]).toMatchObject({ grams: 100, calories: 380, protein: 13 });
  });

  it("updateProfile PATCHes a single field", async () => {
    const f = stubFetch({ ok: true });
    await updateProfile("daily_deficit", 800);
    const [url, opts] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/nutrition/profile");
    expect(opts.method).toBe("PATCH");
    expect(JSON.parse(opts.body as string)).toEqual({ daily_deficit: 800 });
  });

  it("saveOnboard POSTs the profile", async () => {
    const f = stubFetch({ ok: true });
    const p: OnboardProfile = {
      weight_kg: 73, height_cm: 178, age: 31, sex: "male", goal: "cut",
      daily_deficit: 800, step_goal: 10000, activity_level: "active",
    };
    const ok = await saveOnboard(p);
    expect(ok).toBe(true);
    const [url, opts] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/nutrition/onboard");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body as string)).toMatchObject({ weight_kg: 73, goal: "cut" });
  });

  it("closeDay returns the status", async () => {
    stubFetch({ status: "closed" });
    expect(await closeDay("2026-07-16")).toBe("closed");
  });
});

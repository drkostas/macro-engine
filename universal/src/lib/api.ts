import { useEffect, useState } from "react";

/** macro-engine API base. Override with EXPO_PUBLIC_API_URL for device/prod. */
const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3457";

export interface MacroSet {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface SlotBudget extends MacroSet {
  slot: string;
}

export interface Plan {
  date: string;
  weightKg: number;
  targets: MacroSet & { band?: string; tier?: string };
  eaten: MacroSet;
  remaining: MacroSet;
  tdee: { bmr: number; deficit: number; total: number; targetCalories: number };
  slotBudgets: SlotBudget[];
}

export interface PlanState {
  data: Plan | null;
  loading: boolean;
  error: string | null;
}

export interface FoodResult {
  id: number;
  name: string;
  brand: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  serving_description: string;
}

/** Debounced food search against the macro-engine API. */
export function useFoodSearch(query: string) {
  const [results, setResults] = useState<FoodResult[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let alive = true;
    const t = setTimeout(() => {
      fetch(`${API_BASE}/api/food/search?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d) => alive && setResults(d.results ?? []))
        .catch(() => alive && setResults([]))
        .finally(() => alive && setLoading(false));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [query]);
  return { results, loading };
}

export interface OnboardProfile {
  weight_kg: number;
  height_cm: number;
  age: number;
  sex: string;
  goal: string;
  daily_deficit: number;
  estimated_bf_pct?: number;
  target_bf_pct?: number;
  step_goal: number;
  activity_level: string;
}

/** Create the nutrition profile from onboarding. */
export async function saveOnboard(p: OnboardProfile): Promise<boolean> {
  const res = await fetch(`${API_BASE}/api/nutrition/onboard`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(p),
  });
  return res.ok;
}

/** Update a single profile field (PATCH takes the field directly). */
export async function updateProfile(key: string, value: string | number): Promise<boolean> {
  const res = await fetch(`${API_BASE}/api/nutrition/profile`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ [key]: value }),
  });
  return res.ok;
}

/** Load the current profile (GET wraps it in { profile }). */
export function useProfile() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE}/api/nutrition/profile`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setData(d?.profile ?? null))
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  return data;
}

/** Log a food to a meal slot. Returns true on success. */
export async function logMeal(
  date: string,
  slot: string,
  food: FoodResult,
  grams = 100,
): Promise<boolean> {
  const f = grams / 100;
  const res = await fetch(`${API_BASE}/api/nutrition/log-meal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      date,
      meal_slot: slot,
      source: "macro_engine",
      items: [
        {
          name: food.name,
          grams,
          calories: food.calories * f,
          protein: food.protein * f,
          carbs: food.carbs * f,
          fat: food.fat * f,
          fiber: food.fiber * f,
        },
      ],
    }),
  });
  return res.ok;
}

/** Fetch the day plan from the macro-engine API. */
export function usePlan(date: string): PlanState & { refetch: () => void } {
  const [state, setState] = useState<PlanState>({ data: null, loading: true, error: null });
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fetch(`${API_BASE}/api/nutrition/plan?date=${date}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: Plan) => alive && setState({ data, loading: false, error: null }))
      .catch((e) => alive && setState({ data: null, loading: false, error: String(e.message ?? e) }));
    return () => {
      alive = false;
    };
  }, [date, reload]);
  return { ...state, refetch: () => setReload((n) => n + 1) };
}

export interface Wrapup {
  weekStart: string;
  weekEnd: string;
  daysTotal: number;
  daysClosed: number;
  adherencePct: number;
  avgKcal: number;
  avgProteinG: number;
  avgProteinGPerKg: number;
  trainingDays: number;
  weightDeltaKg: number | null;
  grade: string;
}

/** Weekly wrap-up summary (adherence grade + averages) ending on `end`. */
export function useWrapup(end: string) {
  const [data, setData] = useState<{ wrapup: Wrapup; takeaway: string } | null>(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE}/api/nutrition/wrapup?end=${end}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => alive && setData(d))
      .catch(() => {});
    return () => { alive = false; };
  }, [end, reload]);
  return { data, refetch: () => setReload((n) => n + 1) };
}

/** Close (finalize) a day. Returns the resulting status ("closed" | "already_closed"). */
export async function closeDay(date: string): Promise<string | null> {
  const res = await fetch(`${API_BASE}/api/nutrition/close-day`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date }),
  });
  if (!res.ok) return null;
  const d = (await res.json()) as { status?: string };
  return d.status ?? null;
}

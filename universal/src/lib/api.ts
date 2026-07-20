import { useCallback, useEffect, useState } from "react";

/** macro-engine API base. Override with EXPO_PUBLIC_API_URL for device/prod. */
const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3457";

/** Personal API token for prod (the deployed API gates /api/* behind a session;
    the token bypasses that for this native client). Empty in local dev. */
const API_TOKEN = process.env.EXPO_PUBLIC_API_TOKEN;
const AUTH_HEADERS: Record<string, string> = API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {};

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
  const [reload, setReload] = useState(0);
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
      fetch(`${API_BASE}/api/food/search?q=${encodeURIComponent(q)}`, { headers: AUTH_HEADERS })
        .then((r) => r.json())
        .then((d) => alive && setResults(d.results ?? []))
        .catch(() => alive && setResults([]))
        .finally(() => alive && setLoading(false));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [query, reload]);
  return { results, loading, refetch: () => setReload((n) => n + 1) };
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
    headers: { "Content-Type": "application/json", ...AUTH_HEADERS },
    body: JSON.stringify(p),
  });
  return res.ok;
}

/** Update a single profile field (PATCH takes the field directly). */
export async function updateProfile(key: string, value: string | number): Promise<boolean> {
  const res = await fetch(`${API_BASE}/api/nutrition/profile`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...AUTH_HEADERS },
    body: JSON.stringify({ [key]: value }),
  });
  return res.ok;
}

/** Load the current profile (GET wraps it in { profile }). */
export function useProfile() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE}/api/nutrition/profile`, { headers: AUTH_HEADERS })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setData(d?.profile ?? null))
      .catch(() => {});
    return () => { alive = false; };
  }, [reload]);
  return { profile: data, refetch: () => setReload((n) => n + 1) };
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
    headers: { "Content-Type": "application/json", ...AUTH_HEADERS },
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
    fetch(`${API_BASE}/api/nutrition/plan?date=${date}`, { headers: AUTH_HEADERS })
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
    fetch(`${API_BASE}/api/nutrition/wrapup?end=${end}`, { headers: AUTH_HEADERS })
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
    headers: { "Content-Type": "application/json", ...AUTH_HEADERS },
    body: JSON.stringify({ date }),
  });
  if (!res.ok) return null;
  const d = (await res.json()) as { status?: string };
  return d.status ?? null;
}

/**
 * Pull-to-refresh helper: wraps one or more refetch callbacks in a spinner-
 * friendly `refreshing` flag (drops after a short beat so the control settles).
 */
export function usePullRefresh(...refetchers: Array<() => void>) {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refetchers.forEach((r) => r());
    setTimeout(() => setRefreshing(false), 900);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, refetchers);
  return { refreshing, onRefresh };
}

export interface WeekSummary {
  week: string;
  avgCalories: number;
  avgTarget: number;
  adherencePct: number;
  avgWeight: number | null;
}

/** Weekly rollups (avg calories / adherence per week), oldest→newest for charting. */
export function useWeeklySummary(weeks = 12): { data: WeekSummary[]; refetch: () => void } {
  const [data, setData] = useState<WeekSummary[]>([]);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE}/api/nutrition/weekly-summary?weeks=${weeks}`, { headers: AUTH_HEADERS })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => alive && setData([...(d.weeks ?? [])].reverse())) // API returns DESC
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [weeks, reload]);
  return { data, refetch: () => setReload((n) => n + 1) };
}

export interface WeightPoint {
  date: string;
  weight: number;
  avg7d: number;
  bfPct: number | null;
}

/** Daily weight + 7d-average trend, oldest→newest, for a sparkline. */
export function useWeightTrend(days = 30): { data: WeightPoint[]; refetch: () => void } {
  const [data, setData] = useState<WeightPoint[]>([]);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE}/api/nutrition/weight-trend?days=${days}`, { headers: AUTH_HEADERS })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => {
        if (!alive) return;
        const t: WeightPoint[] = [...(d.trend ?? [])].sort((a, b) => a.date.localeCompare(b.date));
        setData(t);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [days, reload]);
  return { data, refetch: () => setReload((n) => n + 1) };
}

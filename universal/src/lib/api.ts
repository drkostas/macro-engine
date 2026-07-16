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

/** Fetch the day plan from the macro-engine API. */
export function usePlan(date: string): PlanState {
  const [state, setState] = useState<PlanState>({ data: null, loading: true, error: null });
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
  }, [date]);
  return state;
}

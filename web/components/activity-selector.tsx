"use client";

import { useState, useEffect } from "react";
import { InfoTip } from "./info-tip";

interface Routine {
  hevy_title: string;
  avg_calories: number;
  avg_duration_s: number;
  session_count: number;
}

interface ActivitySelectorProps {
  date: string;
  trainingDayType: string;
  runEnabled?: boolean;
  selectedWorkouts?: string[];
  expectedSteps?: number;
  disabled?: boolean;
  onChanged: () => void;
  autoDetected?: { run: boolean; gym: string[] };
}

export function ActivitySelector({
  date, runEnabled = false, selectedWorkouts = [],
  expectedSteps, disabled = false, onChanged, autoDetected,
}: ActivitySelectorProps) {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [run, setRun] = useState(runEnabled);
  const [workouts, setWorkouts] = useState<Set<string>>(new Set(selectedWorkouts));
  const [steps, setSteps] = useState(expectedSteps ?? 10000);
  const [lastDelta, setLastDelta] = useState<{ label: string; cals: number } | null>(null);

  useEffect(() => {
    fetch("/api/nutrition/workout-calories")
      .then((r) => r.json())
      .then((d) => setRoutines(d.routines ?? []))
      .catch(() => {});
  }, []);

  // Clear delta after 3s
  useEffect(() => {
    if (!lastDelta) return;
    const t = setTimeout(() => setLastDelta(null), 3000);
    return () => clearTimeout(t);
  }, [lastDelta]);

  const save = async (updates: Record<string, unknown>) => {
    await fetch("/api/nutrition/activity-select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, ...updates }),
    });
    onChanged();
  };

  const toggleRun = () => {
    const next = !run;
    setRun(next);
    setLastDelta({ label: "Run", cals: next ? 200 : -200 });
    save({ run_enabled: next, selected_workouts: [...workouts], expected_steps: steps });
  };

  const toggleWorkout = (title: string, avgCal: number) => {
    const next = new Set(workouts);
    const adding = !next.has(title);
    if (adding) next.add(title);
    else next.delete(title);
    setWorkouts(next);
    setLastDelta({ label: title.substring(0, 15), cals: adding ? avgCal : -avgCal });
    save({ run_enabled: run, selected_workouts: [...next], expected_steps: steps });
  };

  // Sum selected workout calories for display
  const selectedCals = routines
    .filter((r) => workouts.has(r.hevy_title))
    .reduce((s, r) => s + r.avg_calories, 0);
  const totalActivityCals = selectedCals + (run ? 200 : 0);

  return (
    <div className="bg-surface rounded-2xl border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex items-center">
          Activity
          <InfoTip text="Toggle today's planned activities. Each adds its average calories to your daily target, giving you more food budget on training days." />
        </h3>
        <div className="flex items-center gap-2">
          {totalActivityCals > 0 && (
            <span className="text-xs text-success font-medium">+{totalActivityCals} kcal</span>
          )}
          {lastDelta && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full animate-pulse ${
              lastDelta.cals > 0 ? "bg-teal-bg text-success" : "bg-red-950 text-danger"
            }`}>
              {lastDelta.cals > 0 ? "+" : ""}{lastDelta.cals} from {lastDelta.label}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {/* Run toggle */}
        <button
          onClick={toggleRun}
          disabled={disabled}
          className={`px-4 py-2.5 text-xs rounded-lg border transition-colors min-h-[44px] ${
            run
              ? "bg-teal-bg border-teal-dim text-teal"
              : "bg-surface-elevated border-border-glow text-text-muted hover:text-text"
          } disabled:opacity-50`}
        >
          Run {run ? "ON" : "OFF"}
          {autoDetected?.run && <span className="ml-1 text-[8px] px-1 py-0.5 rounded bg-emerald-800 text-teal uppercase">auto</span>}
        </button>

        {/* Gym workout chips */}
        {routines.map((r) => (
          <button
            key={r.hevy_title}
            onClick={() => toggleWorkout(r.hevy_title, r.avg_calories)}
            disabled={disabled}
            className={`px-4 py-2.5 text-xs rounded-lg border transition-colors min-h-[44px] ${
              workouts.has(r.hevy_title)
                ? "bg-teal-bg border-teal-dim text-teal-light"
                : "bg-surface-elevated border-border-glow text-text-muted hover:text-text"
            } disabled:opacity-50`}
          >
            {r.hevy_title}
            <span className="text-[10px] ml-1 opacity-60">~{r.avg_calories}cal</span>
            {autoDetected?.gym.includes(r.hevy_title) && <span className="ml-1 text-[8px] px-1 py-0.5 rounded bg-blue-800 text-teal-light uppercase">auto</span>}
          </button>
        ))}

        {/* Step override */}
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-[10px] text-text-muted">Steps:</span>
          <button
            onClick={() => { const n = steps - 1000; setSteps(n); save({ run_enabled: run, selected_workouts: [...workouts], expected_steps: n }); }}
            disabled={disabled}
            className="w-9 h-9 rounded-lg bg-surface-elevated text-text-secondary text-sm flex items-center justify-center disabled:opacity-50 hover:bg-surface-hover"
          >-</button>
          <span className="text-xs text-text w-12 text-center tabular-nums">{steps.toLocaleString()}</span>
          <button
            onClick={() => { const n = steps + 1000; setSteps(n); save({ run_enabled: run, selected_workouts: [...workouts], expected_steps: n }); }}
            disabled={disabled}
            className="w-9 h-9 rounded-lg bg-surface-elevated text-text-secondary text-sm flex items-center justify-center disabled:opacity-50 hover:bg-surface-hover"
          >+</button>
        </div>
      </div>
    </div>
  );
}

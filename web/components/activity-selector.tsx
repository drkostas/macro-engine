"use client";

import { useState, useEffect } from "react";

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
}

const DAY_TYPE_LABELS: Record<string, string> = {
  rest: "Rest Day", easy_run: "Easy Run", hard_run: "Hard Run",
  long_run: "Long Run", gym: "Gym", gym_and_run: "Gym + Run",
  race: "Race", race_eve: "Race Eve",
};

export function ActivitySelector({
  date, trainingDayType, runEnabled = false, selectedWorkouts = [],
  expectedSteps, disabled = false, onChanged,
}: ActivitySelectorProps) {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [run, setRun] = useState(runEnabled);
  const [workouts, setWorkouts] = useState<Set<string>>(new Set(selectedWorkouts));
  const [steps, setSteps] = useState(expectedSteps ?? 10000);

  useEffect(() => {
    fetch("/api/nutrition/workout-calories")
      .then((r) => r.json())
      .then((d) => setRoutines(d.routines ?? []))
      .catch(() => {});
  }, []);

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
    save({ run_enabled: next, selected_workouts: [...workouts], expected_steps: steps });
  };

  const toggleWorkout = (title: string) => {
    const next = new Set(workouts);
    if (next.has(title)) next.delete(title);
    else next.add(title);
    setWorkouts(next);
    save({ run_enabled: run, selected_workouts: [...next], expected_steps: steps });
  };

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Activity</h3>
        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
          {DAY_TYPE_LABELS[trainingDayType] ?? trainingDayType}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {/* Run toggle */}
        <button
          onClick={toggleRun}
          disabled={disabled}
          className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
            run
              ? "bg-emerald-950 border-emerald-700 text-emerald-300"
              : "bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300"
          } disabled:opacity-50`}
        >
          Run {run ? "ON" : "OFF"}
        </button>

        {/* Gym workout chips */}
        {routines.map((r) => (
          <button
            key={r.hevy_title}
            onClick={() => toggleWorkout(r.hevy_title)}
            disabled={disabled}
            className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
              workouts.has(r.hevy_title)
                ? "bg-blue-950 border-blue-700 text-blue-300"
                : "bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300"
            } disabled:opacity-50`}
          >
            {r.hevy_title}
            <span className="text-[9px] ml-1 opacity-60">~{r.avg_calories}cal</span>
          </button>
        ))}

        {/* Step override */}
        <div className="flex items-center gap-1 ml-auto">
          <span className="text-[10px] text-slate-500">Steps:</span>
          <button
            onClick={() => { const n = steps - 1000; setSteps(n); save({ run_enabled: run, selected_workouts: [...workouts], expected_steps: n }); }}
            disabled={disabled}
            className="w-5 h-5 rounded bg-slate-800 text-slate-400 text-[10px] flex items-center justify-center disabled:opacity-50"
          >-</button>
          <span className="text-xs text-slate-300 w-12 text-center tabular-nums">{steps.toLocaleString()}</span>
          <button
            onClick={() => { const n = steps + 1000; setSteps(n); save({ run_enabled: run, selected_workouts: [...workouts], expected_steps: n }); }}
            disabled={disabled}
            className="w-5 h-5 rounded bg-slate-800 text-slate-400 text-[10px] flex items-center justify-center disabled:opacity-50"
          >+</button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { InfoTip } from "./info-tip";

interface WeekData {
  week: string;
  daysClosed: number;
  daysHit: number;
  adherencePct: number;
  avgCalories: number;
  avgTarget: number;
  avgActualDeficit: number;
  avgGoalDeficit: number;
  trainingDays: number;
  avgWeight: number | null;
  weighIns: number;
}

interface WeeklyData {
  weeks: WeekData[];
  weightChange: number | null;
}

function weekLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  if (isNaN(d.getTime())) return dateStr.substring(0, 10);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function adherenceColor(pct: number): string {
  if (pct >= 80) return "text-success";
  if (pct >= 50) return "text-warm";
  return "text-danger";
}

export function WeeklySummary() {
  const [data, setData] = useState<WeeklyData | null>(null);
  const [weeks, setWeeks] = useState(4);

  useEffect(() => {
    fetch(`/api/nutrition/weekly-summary?weeks=${weeks}`)
      .then((r) => r.json())
      .then((d) => { if (!d.error) setData(d); })
      .catch(() => {});
  }, [weeks]);

  if (!data || data.weeks.length === 0) {
    return (
      <div className="bg-surface rounded-2xl border border-border p-4">
        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Weekly Summary</h3>
        <p className="text-sm text-text-muted">No weekly data yet. Close more days to see your trends.</p>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-2xl border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex items-center">
          Weekly Summary
          <InfoTip text="Adherence shows % of closed days you hit your deficit goal. Training days include any run/gym activity." />
        </h3>
        <div className="flex gap-1">
          {[4, 8, 12].map((w) => (
            <button
              key={w}
              onClick={() => setWeeks(w)}
              className={`px-2 py-0.5 text-[10px] rounded ${weeks === w ? "bg-teal-dim text-white" : "bg-surface-elevated text-text-secondary"}`}
            >
              {w}w
            </button>
          ))}
        </div>
      </div>

      {/* Highlight: weight change */}
      {data.weightChange != null && (
        <div className="mb-3 text-xs">
          <span className="text-text-muted">Weight change ({weeks}w): </span>
          <span className={data.weightChange < 0 ? "text-success font-semibold" : data.weightChange > 0.3 ? "text-warm font-semibold" : "text-text-secondary"}>
            {data.weightChange > 0 ? "+" : ""}{data.weightChange} kg
          </span>
        </div>
      )}

      {/* Weeks table */}
      <div className="space-y-1">
        {/* Header */}
        <div className="grid grid-cols-6 gap-1.5 text-[10px] text-text-muted px-2">
          <span>Week</span>
          <span className="text-right">Adherence</span>
          <span className="text-right">Avg kcal</span>
          <span className="text-right">Deficit</span>
          <span className="text-right">Train</span>
          <span className="text-right">Weight</span>
        </div>

        {data.weeks.map((w) => (
          <div key={w.week} className="grid grid-cols-6 gap-1.5 text-xs px-2 py-1.5 rounded hover:bg-surface-elevated/40">
            <span className="text-text-secondary">
              {weekLabel(w.week)}
              <span className="text-[9px] text-text-faint ml-1">({w.daysClosed}d)</span>
            </span>
            <span className={`text-right ${adherenceColor(w.adherencePct)}`}>
              {w.adherencePct}%
            </span>
            <span className="text-right text-text">
              {w.avgCalories > 0 ? w.avgCalories.toLocaleString() : "-"}
            </span>
            <span className={`text-right ${w.avgActualDeficit >= w.avgGoalDeficit ? "text-success" : "text-warm"}`}>
              {w.avgActualDeficit > 0 ? w.avgActualDeficit : "-"}
            </span>
            <span className="text-right text-indigo">
              {w.trainingDays > 0 ? w.trainingDays : "-"}
            </span>
            <span className="text-right text-teal">
              {w.avgWeight != null ? `${w.avgWeight.toFixed(1)}` : "-"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

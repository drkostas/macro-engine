"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProgressionWindow } from "@/lib/progression";

type Window = 30 | 60 | 90;
const WINDOWS: readonly Window[] = [30, 60, 90] as const;

export function ProgressionCard() {
  const [window, setWindow] = useState<Window>(30);
  const [data, setData] = useState<ProgressionWindow | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchWindow = useCallback(async (w: Window) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/nutrition/progression?window=${w}`, { cache: "no-store" });
      if (r.ok) {
        const body = await r.json();
        if (!body.error) setData(body.progression);
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchWindow(window); }, [window, fetchWindow]);

  const deltaSign = (n: number | null): string => {
    if (n === null) return "—";
    if (n === 0) return "0";
    return (n > 0 ? "+" : "−") + Math.abs(n).toFixed(1);
  };

  return (
    <div
      data-testid="progression-card"
      className="border border-border-glow rounded-lg bg-surface-elevated p-3 space-y-3"
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-text">Progression</p>
          <p className="text-[11px] text-text-muted">
            {data ? `${data.daysClosed} / ${data.daysTotal} days closed` : loading ? "Loading…" : "—"}
          </p>
        </div>
        <div className="flex gap-1">
          {WINDOWS.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setWindow(w)}
              className={`text-[11px] font-semibold rounded px-2 py-1 border transition-colors ${
                w === window
                  ? "bg-teal-bg text-teal border-teal"
                  : "bg-surface-hover text-text-muted border-border-subtle hover:text-text"
              }`}
            >
              {w}d
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-surface-hover rounded border border-border-subtle p-2">
          <div className="text-[10px] uppercase tracking-wider text-text-faint">Weight</div>
          <div className="text-sm font-semibold text-text tnum">
            {data ? deltaSign(data.weightDeltaKg) : "—"}
            {data?.weightDeltaKg !== null && data?.weightDeltaKg !== undefined && (
              <span className="text-[10px] text-text-muted"> kg</span>
            )}
          </div>
          {data?.weightDeltaPerWeek !== null && data?.weightDeltaPerWeek !== undefined && (
            <div className="text-[10px] text-text-muted tnum">
              {deltaSign(data.weightDeltaPerWeek)} kg/wk
            </div>
          )}
        </div>
        <div className="bg-surface-hover rounded border border-border-subtle p-2">
          <div className="text-[10px] uppercase tracking-wider text-text-faint">Adherence</div>
          <div className="text-sm font-semibold text-text tnum">
            {data ? data.adherenceAvgPct : "—"}
            <span className="text-[10px] text-text-muted">%</span>
          </div>
        </div>
        <div className="bg-surface-hover rounded border border-border-subtle p-2">
          <div className="text-[10px] uppercase tracking-wider text-text-faint">Avg deficit</div>
          <div className="text-sm font-semibold text-text tnum">
            {data ? data.avgDailyDeficit : "—"}
            <span className="text-[10px] text-text-muted"> kcal</span>
          </div>
        </div>
        <div className="bg-surface-hover rounded border border-border-subtle p-2">
          <div className="text-[10px] uppercase tracking-wider text-text-faint">Training</div>
          <div className="text-sm font-semibold text-text tnum">
            {data ? data.trainingDays : "—"}
            <span className="text-[10px] text-text-muted"> days</span>
          </div>
        </div>
      </div>
    </div>
  );
}

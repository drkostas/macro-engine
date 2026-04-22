"use client";

import { useCallback, useEffect, useState } from "react";
import type { YearReview } from "@/lib/year-review";

function deltaSign(n: number | null): string {
  if (n === null) return "—";
  if (n === 0) return "0";
  return (n > 0 ? "+" : "−") + Math.abs(n).toFixed(1);
}

export function YearReviewCard() {
  const [data, setData] = useState<YearReview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch("/api/nutrition/year-review", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (alive && !d.error) setData(d.review);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, []);

  const downloadJson = useCallback(() => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `macroengine-year-review-${data.year}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [data]);

  if (loading || !data) {
    return (
      <div
        data-testid="year-review-card"
        className="border border-border-glow rounded-lg bg-surface-elevated p-3"
      >
        <p className="text-xs font-semibold text-text">Year in review</p>
        <p className="text-[11px] text-text-muted">Loading…</p>
      </div>
    );
  }

  return (
    <div
      data-testid="year-review-card"
      className="border border-border-glow rounded-lg bg-surface-elevated p-3 space-y-3"
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-text">
            Year in review · <span className="text-teal">{data.year}</span>
          </p>
          <p className="text-[11px] text-text-muted tnum">
            {data.daysClosed} / {data.totalDaysTracked} days closed
          </p>
        </div>
        <button
          type="button"
          onClick={downloadJson}
          className="text-[11px] font-semibold bg-surface-hover border border-border-subtle text-text rounded-lg px-3 py-1 hover:text-teal"
        >
          Download JSON
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-surface-hover rounded border border-border-subtle p-2">
          <div className="text-[10px] uppercase tracking-wider text-text-faint">Weight</div>
          <div className="text-sm font-semibold text-text tnum">
            {deltaSign(data.weightDeltaKg)}
            {data.weightDeltaKg !== null && (
              <span className="text-[10px] text-text-muted"> kg</span>
            )}
          </div>
        </div>
        <div className="bg-surface-hover rounded border border-border-subtle p-2">
          <div className="text-[10px] uppercase tracking-wider text-text-faint">Adherence</div>
          <div className="text-sm font-semibold text-text tnum">
            {data.overallAdherencePct}
            <span className="text-[10px] text-text-muted">%</span>
          </div>
        </div>
        <div className="bg-surface-hover rounded border border-border-subtle p-2">
          <div className="text-[10px] uppercase tracking-wider text-text-faint">Best streak</div>
          <div className="text-sm font-semibold text-text tnum">
            {data.bestStreak}
            <span className="text-[10px] text-text-muted"> days</span>
          </div>
        </div>
        <div className="bg-surface-hover rounded border border-border-subtle p-2">
          <div className="text-[10px] uppercase tracking-wider text-text-faint">Training</div>
          <div className="text-sm font-semibold text-text tnum">
            {data.trainingDaysTotal}
            <span className="text-[10px] text-text-muted"> days</span>
          </div>
        </div>
      </div>
    </div>
  );
}

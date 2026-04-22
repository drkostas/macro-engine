"use client";

import { useEffect, useState } from "react";
import type { WeeklyWrapup } from "@/lib/weekly-wrapup";

interface Payload {
  wrapup: WeeklyWrapup;
  takeaway: string;
}

const GRADE_TONE: Record<string, string> = {
  A: "bg-teal-bg text-teal border-teal",
  B: "bg-teal-bg text-teal border-teal",
  C: "bg-surface-hover text-warm border-border-subtle",
  D: "bg-surface-hover text-warm border-border-subtle",
  F: "bg-surface-hover text-warning border-border-subtle",
};

function ringColor(pct: number): string {
  if (pct >= 80) return "stroke-teal";
  if (pct >= 60) return "stroke-warm";
  return "stroke-warning";
}

function formatRange(start: string | null, end: string | null): string {
  if (!start || !end) return "This week";
  const s = new Date(start + "T00:00:00Z");
  const e = new Date(end + "T00:00:00Z");
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${fmt(s)} — ${fmt(e)}`;
}

export function WeeklyWrapupCard() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch("/api/nutrition/wrapup", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (alive && !d.error) setData(d);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (loading || !data) {
    return (
      <div
        data-testid="weekly-wrapup-card"
        className="border border-border-glow rounded-lg bg-surface-elevated p-3"
      >
        <p className="text-xs font-semibold text-text">Weekly wrap-up</p>
        <p className="text-[11px] text-text-muted">Loading…</p>
      </div>
    );
  }

  const w = data.wrapup;
  const pct = w.adherencePct;
  // Ring: 56×56 viewBox, circle r=24 → circumference ~150.8
  const dash = Math.max(0, Math.min(100, pct)) * 1.508;

  return (
    <div
      data-testid="weekly-wrapup-card"
      className="border border-border-glow rounded-lg bg-surface-elevated p-3 space-y-3"
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-text">Weekly wrap-up</p>
          <p className="text-[11px] text-text-muted">
            {formatRange(w.weekStart, w.weekEnd)}
          </p>
        </div>
        <span
          data-testid="wrapup-grade"
          className={`text-sm font-bold rounded-lg px-3 py-1 border ${GRADE_TONE[w.grade] ?? GRADE_TONE.F}`}
        >
          {w.grade}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative w-14 h-14">
          <svg viewBox="0 0 56 56" className="w-14 h-14 -rotate-90">
            <circle cx="28" cy="28" r="24" fill="none" strokeWidth="4" className="stroke-surface-hover" />
            <circle
              cx="28" cy="28" r="24" fill="none" strokeWidth="4"
              className={ringColor(pct)}
              strokeDasharray={`${dash} 150.8`}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold tnum text-text">
            {pct}%
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-text-muted">Adherence</p>
          <p className="text-[11px] text-text-secondary tnum">
            {w.daysClosed} / {w.daysTotal} days closed
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-surface-hover rounded border border-border-subtle p-2">
          <div className="text-[10px] uppercase tracking-wider text-text-faint">Avg kcal</div>
          <div className="text-sm font-semibold text-text tnum">{w.avgKcal}</div>
        </div>
        <div className="bg-surface-hover rounded border border-border-subtle p-2">
          <div className="text-[10px] uppercase tracking-wider text-text-faint">Protein</div>
          <div className="text-sm font-semibold text-text tnum">
            {w.avgProteinGPerKg.toFixed(1)}{" "}
            <span className="text-[10px] text-text-muted">g/kg</span>
          </div>
        </div>
        <div className="bg-surface-hover rounded border border-border-subtle p-2">
          <div className="text-[10px] uppercase tracking-wider text-text-faint">Training</div>
          <div className="text-sm font-semibold text-text tnum">{w.trainingDays}</div>
        </div>
        <div className="bg-surface-hover rounded border border-border-subtle p-2">
          <div className="text-[10px] uppercase tracking-wider text-text-faint">Weight</div>
          <div className="text-sm font-semibold text-text tnum">
            {w.weightDeltaKg === null
              ? "—"
              : `${w.weightDeltaKg < 0 ? "−" : w.weightDeltaKg > 0 ? "+" : ""}${Math.abs(w.weightDeltaKg).toFixed(1)}`}
            <span className="text-[10px] text-text-muted">
              {w.weightDeltaKg === null ? "" : " kg"}
            </span>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-text-secondary leading-snug">{data.takeaway}</p>
    </div>
  );
}

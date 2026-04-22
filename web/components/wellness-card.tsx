"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { computeHooperScore, type HooperQuality } from "@/lib/subjective";

type HooperKey = "fatigue" | "sleep" | "stress" | "soreness";

interface HooperValues {
  fatigue: number;
  sleep: number;
  stress: number;
  soreness: number;
}

interface Toast {
  tone: "success" | "error";
  text: string;
}

const LABELS: Record<HooperKey, string> = {
  fatigue: "Fatigue",
  sleep: "Sleep quality",
  stress: "Stress",
  soreness: "Muscle soreness",
};

const QUALITY_META: Record<HooperQuality, { label: string; tone: string }> = {
  good: { label: "Good", tone: "text-success bg-success/10 border-success/30" },
  moderate: { label: "Moderate", tone: "text-warm bg-warm/10 border-warm/30" },
  poor: { label: "Poor", tone: "text-danger bg-danger/10 border-danger/30" },
};

const DEFAULT_VALUES: HooperValues = { fatigue: 4, sleep: 4, stress: 4, soreness: 4 };

/**
 * Morning wellness logger — 4 Hooper sliders with live quality preview.
 * Pre-fills from today's stored row if present; saves via POST to
 * /api/nutrition/subjective.
 */
export function WellnessCard() {
  const [expanded, setExpanded] = useState(false);
  const [values, setValues] = useState<HooperValues>(DEFAULT_VALUES);
  const [savedToday, setSavedToday] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        const r = await fetch("/api/nutrition/subjective", {
          cache: "no-store", signal: ctrl.signal,
        });
        if (!r.ok) return;
        const body = await r.json();
        if (body.today?.morning_hooper) {
          setValues(body.today.morning_hooper);
          setSavedToday(true);
        }
      } catch {
        // aborts during unmount; safe to ignore
      }
    })();
    return () => ctrl.abort();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const score = useMemo(() => computeHooperScore(values), [values]);
  const qualityMeta = QUALITY_META[score.quality];

  const save = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/nutrition/subjective", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ morning_hooper: values }),
      });
      if (!r.ok) {
        const b = await r.json();
        setToast({ tone: "error", text: b.error ?? "Failed to save" });
        return;
      }
      setToast({ tone: "success", text: `Saved — ${qualityMeta.label.toLowerCase()}` });
      setSavedToday(true);
    } finally {
      setLoading(false);
    }
  }, [values, qualityMeta.label]);

  return (
    <div data-testid="wellness-card" className="border border-border-glow rounded-lg bg-surface-elevated">
      <button
        type="button"
        onClick={() => setExpanded((x) => !x)}
        aria-expanded={expanded}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-text hover:bg-surface-hover rounded-lg transition-colors"
      >
        <span className="flex items-center gap-2">
          Log morning check-in
          {savedToday && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-success/15 text-success">
              Saved
            </span>
          )}
        </span>
        <span className="text-text-muted">{expanded ? "−" : "+"}</span>
      </button>
      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-border-subtle space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-text-muted">
              Rate each 1 (low/best) to 7 (high/worst)
            </p>
            <span
              data-testid="wellness-quality-badge"
              className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${qualityMeta.tone}`}
            >
              {qualityMeta.label} · {score.total}
            </span>
          </div>
          {(Object.keys(LABELS) as HooperKey[]).map((k) => (
            <label key={k} className="block">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[11px] text-text-secondary">{LABELS[k]}</span>
                <span className="text-xs tnum text-text">{values[k]}</span>
              </div>
              <input
                type="range"
                min={1}
                max={7}
                step={1}
                value={values[k]}
                aria-label={LABELS[k]}
                onChange={(e) => setValues((prev) => ({ ...prev, [k]: Number(e.target.value) }))}
                className="w-full accent-teal"
              />
            </label>
          ))}
          <button
            type="button"
            onClick={() => void save()}
            disabled={loading}
            className="bg-teal text-base rounded-lg px-4 py-1.5 text-sm font-semibold disabled:opacity-50"
          >
            {loading ? "Saving…" : savedToday ? "Update check-in" : "Save check-in"}
          </button>
          {toast && (
            <div
              role="status"
              className={`text-xs px-3 py-2 rounded-lg border ${
                toast.tone === "success"
                  ? "bg-success/10 border-success/30 text-success"
                  : "bg-danger/10 border-danger/30 text-danger"
              }`}
            >
              {toast.text}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

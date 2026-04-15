"use client";

import { useState } from "react";
import { InfoTip } from "./info-tip";

interface QuickEstimateProps {
  date: string;
  currentEstimate?: number;
  targetCalories: number;
  onSaved: () => void;
}

const PRESETS = [
  { label: "Light", pct: 0.6, desc: "Skipped a meal or ate light" },
  { label: "Normal", pct: 1.0, desc: "Ate roughly on target" },
  { label: "Heavy", pct: 1.3, desc: "Social event or big meals" },
];

export function QuickEstimate({ date, currentEstimate, targetCalories, onSaved }: QuickEstimateProps) {
  const [calories, setCalories] = useState(currentEstimate ?? targetCalories);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(!!currentEstimate);

  const save = async (cals: number) => {
    setSaving(true);
    try {
      const resp = await fetch("/api/nutrition/quick-estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, estimated_calories: cals }),
      });
      if (resp.ok) {
        setSaved(true);
        onSaved();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-surface/60 rounded-2xl border border-warm-dim/30 p-4">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-xs font-semibold text-warm uppercase tracking-wider">
          No meals logged
        </h3>
        <InfoTip text="Set an estimated total for this day so your deficit and weight trend stay accurate. You can adjust this anytime." />
        {saved && <span className="text-[10px] text-success ml-auto">Saved</span>}
      </div>

      {/* Quick presets */}
      <div className="flex gap-2 mb-3">
        {PRESETS.map(({ label, pct, desc }) => {
          const val = Math.round(targetCalories * pct);
          const isActive = Math.abs(calories - val) < 50;
          return (
            <button
              key={label}
              onClick={() => { setCalories(val); save(val); }}
              className={`flex-1 py-2.5 text-xs rounded-lg border transition-colors min-h-[44px] ${
                isActive
                  ? "bg-warm-bg border-amber-700 text-amber-300"
                  : "bg-surface-elevated border-border-glow text-text-secondary hover:text-text"
              }`}
              title={desc}
            >
              {label}
              <span className="block text-[10px] opacity-60">{val}</span>
            </button>
          );
        })}
      </div>

      {/* Slider */}
      <div className="space-y-1">
        <input
          type="range"
          min={0}
          max={Math.round(targetCalories * 2)}
          step={50}
          value={calories}
          onChange={(e) => setCalories(Number(e.target.value))}
          className="w-full h-2 bg-surface-elevated rounded-lg appearance-none cursor-pointer accent-amber-500"
        />
        <div className="flex justify-between items-center">
          <span className="text-xs text-text-muted">0</span>
          <span className="text-sm font-semibold text-warm tabular-nums">{calories.toLocaleString()} kcal</span>
          <span className="text-xs text-text-muted">{(targetCalories * 2).toLocaleString()}</span>
        </div>
      </div>

      {/* Save button (for custom slider values) */}
      {!saved && (
        <button
          onClick={() => save(calories)}
          disabled={saving}
          className="w-full mt-2 py-2.5 text-xs font-medium rounded-lg bg-warm hover:bg-warm-light text-white transition-colors disabled:opacity-50 min-h-[44px]"
        >
          {saving ? "Saving..." : "Set estimate"}
        </button>
      )}
    </div>
  );
}

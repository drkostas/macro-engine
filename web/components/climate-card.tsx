"use client";

import { useCallback, useState } from "react";
import type { ClimateAdjustment, Environment } from "@/lib/climate";

export interface ClimateContext {
  env: Environment;
  adjustment: ClimateAdjustment;
}

interface Props {
  climate: ClimateContext | null;
  onChange: () => void;
}

const ENVS: Array<{ key: Environment; label: string }> = [
  { key: "normal", label: "Normal" },
  { key: "altitude", label: "Altitude" },
  { key: "heat", label: "Heat" },
  { key: "cold", label: "Cold" },
];

export function ClimateCard({ climate, onChange }: Props) {
  const [saving, setSaving] = useState(false);
  const activeEnv: Environment = climate?.env ?? "normal";

  const setEnv = useCallback(
    async (env: Environment) => {
      if (env === activeEnv) return;
      setSaving(true);
      try {
        await fetch("/api/nutrition/climate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ env }),
        });
        onChange();
      } finally {
        setSaving(false);
      }
    },
    [activeEnv, onChange],
  );

  const adj = climate?.adjustment;
  const showAdjustments = climate !== null && activeEnv !== "normal";

  return (
    <div
      data-testid="climate-card"
      className="border border-border-glow rounded-lg bg-surface-elevated p-3 space-y-3"
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-text">Climate</p>
          <p className="text-[11px] text-text-muted capitalize">
            {activeEnv} environment
          </p>
        </div>
      </div>
      <div className="flex gap-1">
        {ENVS.map((e) => {
          const active = e.key === activeEnv;
          return (
            <button
              key={e.key}
              type="button"
              onClick={() => void setEnv(e.key)}
              disabled={saving}
              className={`flex-1 text-[11px] font-semibold rounded px-2 py-1 border transition-colors ${
                active
                  ? "bg-teal-bg text-teal border-teal"
                  : "bg-surface-hover text-text-muted border-border-subtle hover:text-text"
              } disabled:opacity-50`}
            >
              {e.label}
            </button>
          );
        })}
      </div>
      {showAdjustments && adj && (
        <>
          <div
            data-testid="climate-adjustments"
            className="grid grid-cols-2 gap-2"
          >
            {adj.extraFluidMl > 0 && (
              <div className="bg-surface-hover rounded border border-border-subtle p-2">
                <div className="text-[10px] uppercase tracking-wider text-text-faint">Fluid</div>
                <div className="text-sm font-semibold text-text tnum">
                  +{adj.extraFluidMl}{" "}
                  <span className="text-[10px] text-text-muted">mL</span>
                </div>
              </div>
            )}
            {adj.extraSodiumMg > 0 && (
              <div className="bg-surface-hover rounded border border-border-subtle p-2">
                <div className="text-[10px] uppercase tracking-wider text-text-faint">Sodium</div>
                <div className="text-sm font-semibold text-text tnum">
                  +{adj.extraSodiumMg}{" "}
                  <span className="text-[10px] text-text-muted">mg</span>
                </div>
              </div>
            )}
            {adj.extraCarbG > 0 && (
              <div className="bg-surface-hover rounded border border-border-subtle p-2">
                <div className="text-[10px] uppercase tracking-wider text-text-faint">Carbs</div>
                <div className="text-sm font-semibold text-text tnum">
                  +{adj.extraCarbG}{" "}
                  <span className="text-[10px] text-text-muted">g</span>
                </div>
              </div>
            )}
            {adj.extraKcal > 0 && (
              <div className="bg-surface-hover rounded border border-border-subtle p-2">
                <div className="text-[10px] uppercase tracking-wider text-text-faint">Calories</div>
                <div className="text-sm font-semibold text-text tnum">
                  +{adj.extraKcal}{" "}
                  <span className="text-[10px] text-text-muted">kcal</span>
                </div>
              </div>
            )}
            {adj.ironTargetMg !== null && adj.ironTargetMg !== undefined && (
              <div className="bg-surface-hover rounded border border-border-subtle p-2">
                <div className="text-[10px] uppercase tracking-wider text-text-faint">Iron</div>
                <div className="text-sm font-semibold text-text tnum">
                  {adj.ironTargetMg}{" "}
                  <span className="text-[10px] text-text-muted">mg</span>
                </div>
              </div>
            )}
          </div>
          {adj.notes && (
            <p className="text-[11px] text-text-muted leading-snug">{adj.notes}</p>
          )}
        </>
      )}
    </div>
  );
}

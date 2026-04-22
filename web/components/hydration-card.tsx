"use client";

import { useCallback, useEffect, useState } from "react";

interface HydrationState {
  logs: Array<{ ts: string; volume_ml: number; ethanol_g: number; caffeine_mg: number }>;
  effectiveMl: number;
  sodiumMg: number;
  targets: {
    waterBeverageMl: number;
    waterTotalMl: number;
    sodiumMg: number;
  };
}

type Beverage = "water" | "coffee" | "tea" | "beer" | "wine" | "spirits";

const BEVERAGE_META: Record<
  Beverage,
  { label: string; defaultVolume: number; caffeineMg: number; ethanolG: (ml: number) => number }
> = {
  water:   { label: "Water",   defaultVolume: 500, caffeineMg:   0, ethanolG: () => 0 },
  coffee:  { label: "Coffee",  defaultVolume: 250, caffeineMg:  95, ethanolG: () => 0 },
  tea:     { label: "Tea",     defaultVolume: 250, caffeineMg:  47, ethanolG: () => 0 },
  beer:    { label: "Beer",    defaultVolume: 355, caffeineMg:   0, ethanolG: (ml) => Math.round(ml * 0.05 * 0.789) },
  wine:    { label: "Wine",    defaultVolume: 150, caffeineMg:   0, ethanolG: (ml) => Math.round(ml * 0.12 * 0.789) },
  spirits: { label: "Spirits", defaultVolume:  44, caffeineMg:   0, ethanolG: (ml) => Math.round(ml * 0.40 * 0.789) },
};

/**
 * Water + sodium tracker card. Ring shows current vs target; expandable
 * quick-log lets the user pick a beverage, tweak volume, and log it.
 */
export function HydrationCard() {
  const [state, setState] = useState<HydrationState | null>(null);
  const [open, setOpen] = useState(false);
  const [beverage, setBeverage] = useState<Beverage>("water");
  const [volumeMl, setVolumeMl] = useState<number>(BEVERAGE_META.water.defaultVolume);
  const [sodiumMg, setSodiumMg] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/nutrition/hydration", { cache: "no-store" });
      if (r.ok) setState(await r.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const meta = BEVERAGE_META[beverage];
  const ethanolG = meta.ethanolG(volumeMl);
  const caffeineMg = meta.caffeineMg;

  const logDrink = useCallback(async () => {
    setSaving(true);
    try {
      await fetch("/api/nutrition/hydration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ volume_ml: volumeMl, ethanol_g: ethanolG, caffeine_mg: caffeineMg, sodium_mg: sodiumMg }),
      });
      setOpen(false);
      setSodiumMg(0);
      await refresh();
    } finally {
      setSaving(false);
    }
  }, [volumeMl, ethanolG, caffeineMg, sodiumMg, refresh]);

  if (!state) return null;

  const pct = Math.min(100, Math.round((state.effectiveMl / Math.max(1, state.targets.waterBeverageMl)) * 100));
  const sodiumPct = Math.min(
    100,
    Math.round((state.sodiumMg / Math.max(1, state.targets.sodiumMg)) * 100),
  );

  return (
    <div
      data-testid="hydration-card"
      className="border border-border-glow rounded-lg bg-surface-elevated p-3"
    >
      <div className="flex items-center gap-3">
        <div className="relative w-14 h-14" data-testid="hydration-ring">
          <svg viewBox="0 0 56 56" className="w-14 h-14 -rotate-90">
            <circle cx="28" cy="28" r="24" fill="none" strokeWidth="4" className="stroke-surface-hover" />
            <circle
              cx="28" cy="28" r="24" fill="none" strokeWidth="4"
              className="stroke-teal"
              strokeDasharray={`${(pct / 100) * 150.8} 150.8`}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold tnum text-text">
            {pct}%
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-text">Hydration</p>
          <p className="text-[11px] text-text-muted tnum">
            {state.effectiveMl} / {state.targets.waterBeverageMl} mL
          </p>
          <p className="text-[10px] text-text-muted tnum">
            Na {state.sodiumMg} / {state.targets.sodiumMg} mg · {sodiumPct}%
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((x) => !x)}
          aria-label="Toggle drink logger"
          data-testid="hydration-toggle"
          className="text-[11px] font-semibold bg-teal text-base rounded-lg px-3 py-1"
        >
          {open ? "−" : "+ Log"}
        </button>
      </div>

      {open && (
        <div className="mt-3 pt-3 border-t border-border-subtle space-y-2">
          <div className="flex flex-wrap gap-1">
            {(Object.keys(BEVERAGE_META) as Beverage[]).map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => { setBeverage(b); setVolumeMl(BEVERAGE_META[b].defaultVolume); }}
                className={`text-[11px] px-2 py-1 rounded border ${
                  beverage === b
                    ? "bg-teal-bg border-teal text-teal"
                    : "border-border-subtle text-text-secondary hover:bg-surface-hover"
                }`}
              >
                {BEVERAGE_META[b].label}
              </button>
            ))}
          </div>
          <label className="block">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[11px] text-text-secondary">Volume</span>
              <span className="text-xs tnum text-text">{volumeMl} mL</span>
            </div>
            <input
              type="range"
              min={50}
              max={1000}
              step={25}
              value={volumeMl}
              aria-label="Volume"
              onChange={(e) => setVolumeMl(Number(e.target.value))}
              className="w-full accent-teal"
            />
          </label>
          <label className="block">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[11px] text-text-secondary">Added sodium</span>
              <span className="text-xs tnum text-text">{sodiumMg} mg</span>
            </div>
            <input
              type="range"
              min={0}
              max={800}
              step={100}
              value={sodiumMg}
              aria-label="Added sodium"
              onChange={(e) => setSodiumMg(Number(e.target.value))}
              className="w-full accent-warm"
            />
          </label>
          {(ethanolG > 0 || caffeineMg > 0) && (
            <p className="text-[10px] text-text-muted">
              {ethanolG > 0 && <>Ethanol ~{ethanolG}g </>}
              {caffeineMg > 0 && <>Caffeine ~{caffeineMg}mg</>}
            </p>
          )}
          <button
            type="button"
            onClick={() => void logDrink()}
            disabled={saving}
            data-testid="hydration-submit"
            className="bg-teal text-base rounded-lg px-4 py-1.5 text-xs font-semibold disabled:opacity-50"
          >
            {saving ? "Logging…" : "Submit drink"}
          </button>
        </div>
      )}
    </div>
  );
}

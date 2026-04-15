"use client";

import { useState, useEffect } from "react";
import { InfoTip } from "./info-tip";

interface DrinkType {
  name: string;
  calories_per_100ml: number;
  carbs_per_100ml: number;
  alcohol_pct: number;
  default_ml: number;
}

interface LoggedDrink {
  id: number;
  name: string;
  quantity_ml: number;
  calories: number;
  alcohol_grams: number;
  fat_oxidation_pause_hours: number;
}

interface DrinkLoggerProps {
  date: string;
  drinks: LoggedDrink[];
  totalDrinkCalories: number;
  disabled?: boolean;
  onChanged: () => void;
}

export function DrinkLogger({ date, drinks, totalDrinkCalories, disabled, onChanged }: DrinkLoggerProps) {
  const [expanded, setExpanded] = useState(false);
  const [drinkTypes, setDrinkTypes] = useState<Record<string, DrinkType>>({});
  const [selectedType, setSelectedType] = useState("beer_regular");
  const [quantity, setQuantity] = useState(1);
  const [logging, setLogging] = useState(false);

  useEffect(() => {
    fetch("/api/nutrition/log-drink")
      .then((r) => r.json())
      .then((d) => setDrinkTypes(d.drinks ?? {}))
      .catch(() => {});
  }, []);

  const totalPauseHours = drinks.reduce((s, d) => Math.max(s, d.fat_oxidation_pause_hours), 0);

  const logDrink = async () => {
    setLogging(true);
    try {
      const resp = await fetch("/api/nutrition/log-drink", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, drink_type: selectedType, quantity }),
      });
      if (resp.ok) onChanged();
    } finally {
      setLogging(false);
    }
  };

  const deleteDrink = async (id: number) => {
    await fetch(`/api/nutrition/log-drink?id=${id}`, { method: "DELETE" });
    onChanged();
  };

  return (
    <div className="bg-surface rounded-2xl border border-border overflow-hidden">
      <div className="w-full px-4 py-3 flex justify-between items-center min-h-[44px]">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center text-xs font-semibold text-text-secondary uppercase tracking-wider gap-1"
        >
          Drinks
          <span className="text-xs text-text-muted">{expanded ? "▲" : "▼"}</span>
        </button>
        <InfoTip text="Alcohol calories are offset from carbs and fat targets. Alcohol also pauses fat oxidation for several hours per drink." />
        <div className="flex items-center gap-2 ml-auto">
          {totalDrinkCalories > 0 && (
            <span className="text-xs text-warm">{totalDrinkCalories} kcal</span>
          )}
          {totalPauseHours > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-warm-bg text-warm border border-warm-dim">
              Fat burn paused ~{totalPauseHours}h
            </span>
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Logged drinks */}
          {drinks.map((d) => (
            <div key={d.id} className="flex items-center justify-between bg-base/50 rounded-md px-3 py-2.5 min-h-[44px]">
              <span className="text-sm text-text">{d.name} ({d.quantity_ml}ml)</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-text-secondary">{d.calories} kcal</span>
                {!disabled && (
                  <button
                    onClick={() => deleteDrink(d.id)}
                    className="w-8 h-8 flex items-center justify-center text-sm text-text-faint hover:text-danger rounded"
                  >
                    x
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Add drink */}
          {!disabled && (
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-[10px] text-text-muted block mb-1">Type</label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full bg-surface-elevated border border-border-glow rounded-lg px-3 py-2.5 text-xs text-text min-h-[44px]"
                >
                  {Object.entries(drinkTypes).map(([key, dt]) => (
                    <option key={key} value={key}>{dt.name} ({dt.default_ml}ml)</option>
                  ))}
                </select>
              </div>
              <div className="w-20">
                <label className="text-[10px] text-text-muted block mb-1">Qty</label>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-9 h-9 bg-surface-elevated rounded-lg text-text-secondary text-sm hover:bg-surface-hover"
                  >-</button>
                  <span className="text-xs text-text w-5 text-center">{quantity}</span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-9 h-9 bg-surface-elevated rounded-lg text-text-secondary text-sm hover:bg-surface-hover"
                  >+</button>
                </div>
              </div>
              <button
                onClick={logDrink}
                disabled={logging}
                className="px-4 py-2.5 bg-warm hover:bg-warm-light text-white text-xs rounded-lg font-medium disabled:opacity-50 min-h-[44px]"
              >
                Log
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

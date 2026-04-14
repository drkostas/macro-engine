"use client";

import { useState, useEffect } from "react";

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
    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2.5 flex justify-between items-center"
      >
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Drinks</span>
        <div className="flex items-center gap-2">
          {totalDrinkCalories > 0 && (
            <span className="text-xs text-amber-400">{totalDrinkCalories} kcal</span>
          )}
          {totalPauseHours > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950 text-amber-400 border border-amber-800">
              Fat oxidation paused ~{totalPauseHours}h
            </span>
          )}
          <span className="text-xs text-slate-500">{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Logged drinks */}
          {drinks.map((d) => (
            <div key={d.id} className="flex items-center justify-between bg-slate-950/40 rounded-md px-3 py-1.5">
              <span className="text-sm text-slate-200">{d.name} ({d.quantity_ml}ml)</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">{d.calories} kcal</span>
                {!disabled && (
                  <button onClick={() => deleteDrink(d.id)} className="text-xs text-slate-600 hover:text-red-400">x</button>
                )}
              </div>
            </div>
          ))}

          {/* Add drink */}
          {!disabled && (
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-[10px] text-slate-500 block mb-1">Type</label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200"
                >
                  {Object.entries(drinkTypes).map(([key, dt]) => (
                    <option key={key} value={key}>{dt.name} ({dt.default_ml}ml)</option>
                  ))}
                </select>
              </div>
              <div className="w-16">
                <label className="text-[10px] text-slate-500 block mb-1">Qty</label>
                <div className="flex items-center gap-0.5">
                  <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-5 h-7 bg-slate-800 rounded text-slate-400 text-xs">-</button>
                  <span className="text-xs text-slate-200 w-4 text-center">{quantity}</span>
                  <button onClick={() => setQuantity(quantity + 1)} className="w-5 h-7 bg-slate-800 rounded text-slate-400 text-xs">+</button>
                </div>
              </div>
              <button
                onClick={logDrink}
                disabled={logging}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs rounded-lg font-medium disabled:opacity-50"
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

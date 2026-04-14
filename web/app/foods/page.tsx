"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";

interface FoodResult {
  id: number;
  name: string;
  brand: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
  serving_size_g: number | null;
  db_source: "usda" | "custom";
}

const SLOT_LABELS: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  pre_sleep: "Pre-Sleep",
};

const SLOTS = ["breakfast", "lunch", "dinner", "pre_sleep"];

export default function LogPage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-500">Loading...</div>}>
      <LogPageInner />
    </Suspense>
  );
}

function LogPageInner() {
  const searchParams = useSearchParams();
  const [activeSlot, setActiveSlot] = useState(searchParams.get("slot") || autoSlot());
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedFood, setSelectedFood] = useState<FoodResult | null>(null);
  const [grams, setGrams] = useState(100);
  const [logging, setLogging] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Quick-add state
  const [quickMode, setQuickMode] = useState(false);
  const [quickName, setQuickName] = useState("");
  const [quickCal, setQuickCal] = useState("");
  const [quickP, setQuickP] = useState("");
  const [quickC, setQuickC] = useState("");
  const [quickF, setQuickF] = useState("");

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  function autoSlot(): string {
    const hour = new Date().getHours();
    if (hour < 10) return "breakfast";
    if (hour < 14) return "lunch";
    if (hour < 21) return "dinner";
    return "pre_sleep";
  }

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const resp = await fetch(`/api/food/search?q=${encodeURIComponent(query)}&limit=15`);
        const data = await resp.json();
        setResults(data.results ?? []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  // Scale macros by portion
  function scaled(food: FoodResult, g: number) {
    const factor = g / 100;
    return {
      calories: Math.round(food.calories * factor),
      protein: Math.round(food.protein * factor * 10) / 10,
      carbs: Math.round(food.carbs * factor * 10) / 10,
      fat: Math.round(food.fat * factor * 10) / 10,
    };
  }

  async function logFood() {
    if (!selectedFood) return;
    setLogging(true);

    const s = scaled(selectedFood, grams);
    const today = new Date().toISOString().split("T")[0];

    try {
      const resp = await fetch("/api/nutrition/log-meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: today,
          meal_slot: activeSlot,
          items: [{
            name: selectedFood.name,
            grams,
            calories: s.calories,
            protein: s.protein,
            carbs: s.carbs,
            fat: s.fat,
          }],
        }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Server error ${resp.status}`);
      }
      setToast(`Logged: ${selectedFood.name} ${grams}g (${s.calories} kcal)`);
      setSelectedFood(null);
      setQuery("");
      setGrams(100);
      setTimeout(() => setToast(null), 3000);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Failed to log. Try again.");
      setTimeout(() => setToast(null), 5000);
    } finally {
      setLogging(false);
    }
  }

  async function logQuickAdd() {
    if (!quickName || !quickCal) return;
    setLogging(true);
    const today = new Date().toISOString().split("T")[0];

    try {
      const resp = await fetch("/api/nutrition/log-meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: today,
          meal_slot: activeSlot,
          items: [{
            name: quickName,
            grams: null,
            calories: parseInt(quickCal),
            protein: parseFloat(quickP) || 0,
            carbs: parseFloat(quickC) || 0,
            fat: parseFloat(quickF) || 0,
          }],
        }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Server error ${resp.status}`);
      }
      setToast(`Logged: ${quickName} (${quickCal} kcal)`);
      setQuickName(""); setQuickCal(""); setQuickP(""); setQuickC(""); setQuickF("");
      setTimeout(() => setToast(null), 3000);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Failed to log.");
      setTimeout(() => setToast(null), 5000);
    } finally {
      setLogging(false);
    }
  }

  return (
    <main className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
      <h1 className="text-lg font-bold">Food Library</h1>

      <p className="text-sm text-slate-400">Browse ingredients, search USDA foods, and manage your custom foods.</p>

      {/* Mode toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setQuickMode(false)}
          className={`text-xs px-3 py-1.5 rounded-lg ${!quickMode ? "bg-slate-700 text-white" : "text-slate-400"}`}
        >
          Search Foods
        </button>
        <button
          onClick={() => setQuickMode(true)}
          className={`text-xs px-3 py-1.5 rounded-lg ${quickMode ? "bg-slate-700 text-white" : "text-slate-400"}`}
        >
          Create Custom
        </button>
      </div>

      {!quickMode ? (
        <>
          {/* Search bar */}
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search foods (e.g. chicken breast, banana, rice)..."
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-600"
            autoFocus
          />

          {/* Results */}
          {searching && <p className="text-xs text-slate-500">Searching...</p>}

          <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
            {results.map((food) => (
              <button
                key={`${food.db_source}-${food.id}`}
                onClick={() => {
                  setSelectedFood(food);
                  setGrams(food.serving_size_g ?? 100);
                }}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  selectedFood?.id === food.id && selectedFood?.db_source === food.db_source
                    ? "bg-blue-950 border border-blue-700"
                    : "bg-slate-800/60 hover:bg-slate-800"
                }`}
              >
                <div className="flex justify-between">
                  <div>
                    <p className="text-sm text-slate-200">{food.name}</p>
                    {food.brand && (
                      <p className="text-[11px] text-slate-500">{food.brand}</p>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-600 uppercase">{food.db_source}</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Per 100g: {food.calories} kcal | {food.protein}g P | {food.carbs}g C | {food.fat}g F
                </p>
              </button>
            ))}

            {query.length >= 2 && !searching && results.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-4">
                No results. Try a different search or use Quick Add.
              </p>
            )}
          </div>

          {/* Food Detail / Portion Picker */}
          {selectedFood && (
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-slate-200">{selectedFood.name}</h3>

              <div className="flex items-center gap-3">
                <label className="text-xs text-slate-400">Portion:</label>
                <input
                  type="number"
                  value={grams}
                  onChange={(e) => setGrams(Math.max(1, parseInt(e.target.value) || 0))}
                  className="w-20 bg-slate-900 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-center"
                />
                <span className="text-xs text-slate-400">grams</span>
                <input
                  type="range"
                  min={10}
                  max={500}
                  step={5}
                  value={grams}
                  onChange={(e) => setGrams(parseInt(e.target.value))}
                  className="flex-1"
                />
              </div>

              {/* Scaled macros */}
              {(() => {
                const s = scaled(selectedFood, grams);
                return (
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="bg-slate-900 rounded-lg p-2">
                      <p className="text-sm font-bold text-blue-400">{s.calories}</p>
                      <p className="text-[10px] text-slate-500">kcal</p>
                    </div>
                    <div className="bg-slate-900 rounded-lg p-2">
                      <p className="text-sm font-bold text-red-400">{s.protein}g</p>
                      <p className="text-[10px] text-slate-500">Protein</p>
                    </div>
                    <div className="bg-slate-900 rounded-lg p-2">
                      <p className="text-sm font-bold text-amber-400">{s.carbs}g</p>
                      <p className="text-[10px] text-slate-500">Carbs</p>
                    </div>
                    <div className="bg-slate-900 rounded-lg p-2">
                      <p className="text-sm font-bold text-emerald-400">{s.fat}g</p>
                      <p className="text-[10px] text-slate-500">Fat</p>
                    </div>
                  </div>
                );
              })()}

              <button
                onClick={logFood}
                disabled={logging}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {logging ? "Logging..." : `Add to ${SLOT_LABELS[activeSlot]}`}
              </button>
            </div>
          )}
        </>
      ) : (
        /* Quick Add mode */
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-200">Quick Add</h3>
          <input
            type="text"
            value={quickName}
            onChange={(e) => setQuickName(e.target.value)}
            placeholder="Food name (e.g. Protein Bar)"
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm"
          />
          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className="text-[10px] text-slate-500">Calories*</label>
              <input
                type="number"
                value={quickCal}
                onChange={(e) => setQuickCal(e.target.value)}
                placeholder="200"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-center"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500">Protein (g)</label>
              <input
                type="number"
                value={quickP}
                onChange={(e) => setQuickP(e.target.value)}
                placeholder="20"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-center"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500">Carbs (g)</label>
              <input
                type="number"
                value={quickC}
                onChange={(e) => setQuickC(e.target.value)}
                placeholder="25"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-center"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500">Fat (g)</label>
              <input
                type="number"
                value={quickF}
                onChange={(e) => setQuickF(e.target.value)}
                placeholder="8"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-center"
              />
            </div>
          </div>
          <button
            onClick={logQuickAdd}
            disabled={logging || !quickName || !quickCal}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {logging ? "Logging..." : `Add to ${SLOT_LABELS[activeSlot]}`}
          </button>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-emerald-900/90 border border-emerald-700 text-emerald-200 px-4 py-2.5 rounded-xl text-sm shadow-lg">
          {toast}
        </div>
      )}
    </main>
  );
}

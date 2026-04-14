"use client";

import { useState, useEffect, useRef } from "react";
import { autoCategorizeFood, type FoodCategory } from "@/lib/auto-categorize";
import type { Ingredient } from "@/lib/portion-solver";

interface IngredientPickerProps {
  /** User's curated ingredients from DB */
  ingredients: Ingredient[];
  /** Currently selected ingredient IDs */
  selected: Set<string>;
  /** Toggle ingredient selection */
  onToggle: (ing: Ingredient) => void;
  /** Add a USDA food as a one-time ingredient */
  onAddUsda: (food: UsdaFood) => void;
  /** Presets for the preset tab */
  presets: PresetMeal[];
  /** Load a preset */
  onLoadPreset: (preset: PresetMeal) => void;
}

interface UsdaFood {
  id: number;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
  serving_size_g: number | null;
  db_source: string;
}

export interface PresetMeal {
  id: string;
  name: string;
  total_calories: number;
  total_protein: number;
  items: Record<string, unknown>;
  tags?: string[];
}

const CATEGORY_ORDER: FoodCategory[] = [
  "protein", "carbs", "vegetable", "fat", "dairy", "fruit", "sauce", "supplement", "other",
];

const CATEGORY_LABELS: Record<string, string> = {
  protein: "Protein", carbs: "Carbs", fat: "Fats", dairy: "Dairy",
  vegetable: "Vegetables", fruit: "Fruit", sauce: "Sauces", supplement: "Supplements", other: "Other",
};

export function IngredientPicker({
  ingredients, selected, onToggle, onAddUsda, presets, onLoadPreset,
}: IngredientPickerProps) {
  const [tab, setTab] = useState<"mine" | "search" | "presets">("mine");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UsdaFood[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Debounced USDA search
  useEffect(() => {
    if (tab !== "search" || query.length < 2) {
      setSearchResults([]);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const resp = await fetch(`/api/food/search?q=${encodeURIComponent(query)}&limit=15`);
        const data = await resp.json();
        setSearchResults(data.results ?? []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, tab]);

  // Group ingredients by category
  const grouped = new Map<string, Ingredient[]>();
  for (const ing of ingredients) {
    const cat = ing.category || "other";
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(ing);
  }

  return (
    <div className="space-y-3">
      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800 rounded-lg p-0.5">
        {(["mine", "search", "presets"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
              tab === t ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {t === "mine" ? "My Ingredients" : t === "search" ? "Search USDA" : "Presets"}
          </button>
        ))}
      </div>

      {/* My Ingredients tab */}
      {tab === "mine" && (
        <div className="space-y-3 max-h-[300px] overflow-y-auto">
          {CATEGORY_ORDER.map((cat) => {
            const items = grouped.get(cat);
            if (!items?.length) return null;
            return (
              <div key={cat}>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  {CATEGORY_LABELS[cat]}
                </p>
                <div className="space-y-0.5">
                  {items.map((ing) => {
                    const isSelected = selected.has(ing.id);
                    return (
                      <button
                        key={ing.id}
                        onClick={(e) => {
                          e.preventDefault();
                          onToggle(ing);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-left transition-colors ${
                          isSelected
                            ? "bg-blue-950 border border-blue-700"
                            : "hover:bg-slate-800 border border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-3 h-3 rounded-sm border shrink-0 ${isSelected ? "bg-blue-500 border-blue-500" : "border-slate-600"}`} />
                          <span className="text-sm text-slate-200">{ing.name}</span>
                        </div>
                        <span className="text-[10px] text-slate-500">
                          {Math.round(ing.calories_per_100g)} | {Math.round(ing.protein_per_100g)}P
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Search USDA tab */}
      {tab === "search" && (
        <div className="space-y-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search USDA foods..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-600"
            autoFocus
          />
          {searching && <p className="text-[10px] text-slate-500">Searching...</p>}
          <div className="space-y-1 max-h-[250px] overflow-y-auto">
            {searchResults.map((food) => {
              const category = autoCategorizeFood({
                calories: food.calories, protein: food.protein,
                carbs: food.carbs, fat: food.fat, fiber: food.fiber ?? 0,
              });
              return (
                <button
                  key={food.id}
                  onClick={() => onAddUsda(food)}
                  className="w-full text-left px-2.5 py-2 rounded-md hover:bg-slate-800 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-200 truncate">{food.name}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-400 shrink-0 ml-2">
                      {category}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Per 100g: {food.calories} kcal | {food.protein}P | {food.carbs}C | {food.fat}F
                  </p>
                </button>
              );
            })}
            {query.length >= 2 && !searching && searchResults.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-3">No results found.</p>
            )}
          </div>
        </div>
      )}

      {/* Presets tab */}
      {tab === "presets" && (
        <div className="space-y-1 max-h-[300px] overflow-y-auto">
          {presets.length === 0 && (
            <p className="text-xs text-slate-500 text-center py-3">No saved presets yet.</p>
          )}
          {presets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => onLoadPreset(preset)}
              className="w-full text-left px-2.5 py-2 rounded-md hover:bg-slate-800 transition-colors"
            >
              <p className="text-sm text-slate-200">{preset.name}</p>
              <p className="text-[10px] text-slate-500">
                {Math.round(preset.total_calories)} kcal | {Math.round(preset.total_protein)}P
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { autoCategorizeFood, type FoodCategory } from "@/lib/auto-categorize";
import type { Ingredient } from "@/lib/portion-solver";

interface IngredientPickerProps {
  ingredients: Ingredient[];
  selected: Set<string>;
  onToggle: (ing: Ingredient) => void;
  onAddUsda: (food: UsdaFood) => void;
  presets: PresetMeal[];
  onLoadPreset: (preset: PresetMeal) => void;
  /** Recently used ingredient IDs (most recent first) */
  recentIds?: string[];
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
  ingredients, selected, onToggle, onAddUsda, presets, onLoadPreset, recentIds = [],
}: IngredientPickerProps) {
  const [tab, setTab] = useState<"mine" | "search" | "presets">("mine");
  const [query, setQuery] = useState("");
  const [myFilter, setMyFilter] = useState("");
  const [fetchedResults, setSearchResults] = useState<UsdaFood[]>([]);
  const searchResults = tab !== "search" || query.length < 2 ? [] : fetchedResults;
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Debounced USDA search
  // Outside the search tab, or under two characters, there are no results (derived below).
  useEffect(() => {
    if (tab !== "search" || query.length < 2) return;
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
  const grouped = useMemo(() => {
    const g = new Map<string, Ingredient[]>();
    for (const ing of ingredients) {
      const cat = ing.category || "other";
      if (!g.has(cat)) g.set(cat, []);
      g.get(cat)!.push(ing);
    }
    return g;
  }, [ingredients]);

  // Favorites override — persists locally until the parent refetches
  const [favOverrides, setFavOverrides] = useState<Record<string, boolean>>({});
  const isFav = (ing: Ingredient) => favOverrides[ing.id] ?? Boolean(ing.is_favorite);

  const toggleFavorite = async (ing: Ingredient, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const next = !isFav(ing);
    setFavOverrides((prev) => ({ ...prev, [ing.id]: next }));
    try {
      const resp = await fetch(`/api/nutrition/ingredient/${ing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_favorite: next }),
      });
      if (!resp.ok) {
        // Rollback on failure
        setFavOverrides((prev) => ({ ...prev, [ing.id]: !next }));
      }
    } catch {
      setFavOverrides((prev) => ({ ...prev, [ing.id]: !next }));
    }
  };

  // Recently used ingredients
  const recentIngredients = useMemo(() => {
    if (recentIds.length === 0) return [];
    const byId = new Map(ingredients.map((i) => [i.id, i]));
    return recentIds.slice(0, 8).map((id) => byId.get(id)).filter(Boolean) as Ingredient[];
  }, [recentIds, ingredients]);

  const favoriteIngredients = useMemo(() => {
    const favs = ingredients.filter((i) => isFav(i));
    return favs.sort((a, b) => a.name.localeCompare(b.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ingredients, favOverrides]);

  // Filter My Ingredients by search
  const filteredGrouped = useMemo(() => {
    if (!myFilter.trim()) return grouped;
    const q = myFilter.toLowerCase();
    const filtered = new Map<string, Ingredient[]>();
    for (const [cat, items] of grouped) {
      const matching = items.filter((i) => i.name.toLowerCase().includes(q));
      if (matching.length > 0) filtered.set(cat, matching);
    }
    return filtered;
  }, [grouped, myFilter]);

  const renderIngredientRow = (ing: Ingredient) => {
    const isSelected = selected.has(ing.id);
    const fav = isFav(ing);
    return (
      <div
        key={ing.id}
        className={`w-full flex items-center gap-1 rounded-lg transition-colors min-h-[44px] ${
          isSelected
            ? "bg-teal-bg border border-teal-dim"
            : "hover:bg-surface-elevated border border-transparent"
        }`}
      >
        <button
          onClick={(e) => toggleFavorite(ing, e)}
          className={`w-8 h-8 shrink-0 flex items-center justify-center rounded-md transition-colors ${
            fav ? "text-warm hover:text-warm-light" : "text-text-faint hover:text-warm-dim"
          }`}
          aria-label={fav ? `Unfavorite ${ing.name}` : `Favorite ${ing.name}`}
          title={fav ? "Unfavorite" : "Favorite"}
        >
          {fav ? "★" : "☆"}
        </button>
        <button
          onClick={(e) => { e.preventDefault(); onToggle(ing); }}
          className="flex-1 flex items-center justify-between pr-3 py-2 text-left"
        >
          <div className="flex items-center gap-2.5">
            <span className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
              isSelected ? "bg-teal border-teal text-white" : "border-border-glow"
            }`}>
              {isSelected && <span className="text-[10px]">&#10003;</span>}
            </span>
            <span className="text-sm text-text">{ing.name}</span>
          </div>
          <span className="text-[11px] text-text-muted">
            {Math.round(ing.calories_per_100g)} | {Math.round(ing.protein_per_100g)}P
          </span>
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Tabs */}
      <div className="flex gap-1 bg-surface-elevated rounded-lg p-0.5">
        {(["mine", "search", "presets"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-xs font-medium rounded-md transition-colors min-h-[44px] ${
              tab === t ? "bg-surface-hover text-white" : "text-text-secondary hover:text-text"
            }`}
          >
            {t === "mine" ? "My Ingredients" : t === "search" ? "Search USDA" : "Presets"}
          </button>
        ))}
      </div>

      {/* My Ingredients tab */}
      {tab === "mine" && (
        <div className="space-y-2">
          {/* Search filter */}
          <input
            type="text"
            value={myFilter}
            onChange={(e) => setMyFilter(e.target.value)}
            placeholder="Filter ingredients..."
            className="w-full bg-surface-elevated border border-border-glow rounded-lg px-3 py-2.5 text-sm placeholder-text-faint focus:outline-none focus:border-teal-dim"
          />

          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {/* Favorites section */}
            {!myFilter && favoriteIngredients.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-warm uppercase tracking-wider mb-1">
                  ★ Favorites
                </p>
                <div className="space-y-0.5">
                  {favoriteIngredients.map(renderIngredientRow)}
                </div>
              </div>
            )}

            {/* Recently used section */}
            {!myFilter && recentIngredients.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-teal uppercase tracking-wider mb-1">
                  Recently Used
                </p>
                <div className="space-y-0.5">
                  {recentIngredients.map(renderIngredientRow)}
                </div>
              </div>
            )}

            {/* Category groups */}
            {CATEGORY_ORDER.map((cat) => {
              const items = filteredGrouped.get(cat);
              if (!items?.length) return null;
              return (
                <div key={cat}>
                  <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1">
                    {CATEGORY_LABELS[cat]}
                  </p>
                  <div className="space-y-0.5">
                    {items.map(renderIngredientRow)}
                  </div>
                </div>
              );
            })}

            {myFilter && filteredGrouped.size === 0 && (
              <p className="text-xs text-text-muted text-center py-3">No matching ingredients.</p>
            )}
          </div>
        </div>
      )}

      {/* Search USDA tab */}
      {tab === "search" && (
        <div className="space-y-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search foods... (type to search)"
            className="w-full bg-surface-elevated border border-border-glow rounded-lg px-3 py-2.5 text-sm placeholder-text-faint focus:outline-none focus:border-teal-dim"
            autoFocus
          />
          {searching && <p className="text-[10px] text-text-muted">Searching...</p>}

          {/* Show recent ingredients as suggestions when search is empty */}
          {query.length < 2 && recentIngredients.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] text-text-muted uppercase tracking-wider">Frequently used</p>
              {recentIngredients.map((ing) => (
                <button
                  key={ing.id}
                  onClick={() => onToggle(ing)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors min-h-[44px] ${
                    selected.has(ing.id) ? "bg-teal-bg border border-teal-dim" : "hover:bg-surface-elevated border border-transparent"
                  }`}
                >
                  <span className="text-sm text-text">{ing.name}</span>
                  <span className="text-[11px] text-text-muted">{Math.round(ing.calories_per_100g)} cal/100g</span>
                </button>
              ))}
            </div>
          )}

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
                  className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-surface-elevated transition-colors min-h-[44px]"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text truncate">{food.name}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-surface-hover text-text-secondary shrink-0 ml-2">
                      {category}
                    </span>
                  </div>
                  <p className="text-[10px] text-text-muted mt-0.5">
                    Per 100g: {food.calories} kcal | {food.protein}P | {food.carbs}C | {food.fat}F
                  </p>
                </button>
              );
            })}
            {query.length >= 2 && !searching && searchResults.length === 0 && (
              <p className="text-xs text-text-muted text-center py-3">No results found.</p>
            )}
          </div>
        </div>
      )}

      {/* Presets tab */}
      {tab === "presets" && (
        <div className="space-y-1 max-h-[300px] overflow-y-auto">
          {presets.length === 0 && (
            <p className="text-xs text-text-muted text-center py-3">No saved presets yet.</p>
          )}
          {presets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => onLoadPreset(preset)}
              className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-surface-elevated transition-colors min-h-[44px]"
            >
              <p className="text-sm text-text">{preset.name}</p>
              <p className="text-[10px] text-text-muted">
                {Math.round(preset.total_calories)} kcal | {Math.round(preset.total_protein)}P
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

import { describe, it, expect, vi } from "vitest";
import { sanityFlags, num, proposalFromOff, searchOpenFoodFacts, CATEGORIES, SHRINK_BY_CATEGORY } from "../src/ingredient-research";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("sanityFlags", () => {
  it("clean macros: no flags", () => {
    expect(sanityFlags({ calories_per_100g: 165, protein_per_100g: 31, carbs_per_100g: 0, fat_per_100g: 3.6, fiber_per_100g: 0 })).toEqual([]);
  });
  it("names each missing macro; unknown stays null, never 0", () => {
    expect(sanityFlags({ calories_per_100g: 100, protein_per_100g: null, carbs_per_100g: 10, fat_per_100g: null, fiber_per_100g: null })).toEqual(["missing:protein", "missing:fat", "missing:fiber"]);
  });
  it("flags kcal that disagree with 4/4/9 by more than 20%", () => {
    expect(sanityFlags({ calories_per_100g: 500, protein_per_100g: 10, carbs_per_100g: 10, fat_per_100g: 5, fiber_per_100g: 1 })).toEqual(["kcal_macro_mismatch"]);
    expect(sanityFlags({ calories_per_100g: 125, protein_per_100g: 10, carbs_per_100g: 10, fat_per_100g: 5, fiber_per_100g: 1 })).toEqual([]);
  });
  it("tiny kcal use a 20 kcal floor for the tolerance", () => {
    expect(sanityFlags({ calories_per_100g: 2, protein_per_100g: 0, carbs_per_100g: 1, fat_per_100g: 0, fiber_per_100g: 0 })).toEqual([]);
  });
});

describe("num", () => {
  it("parses strings, rounds to 2 decimals, null for junk", () => {
    expect(num("12.345")).toBe(12.35); expect(num(7)).toBe(7); expect(num("x")).toBeNull(); expect(num(undefined)).toBeNull(); expect(num(Infinity)).toBeNull();
  });
});

describe("proposalFromOff", () => {
  it("builds a proposal with per-100 g values, url and confidence 0.6 when complete", () => {
    const p = proposalFromOff({ code: "123", product_name: " Greek Yogurt ", brands: ["Fage", ""], nutriments: { "energy-kcal_100g": "97", proteins_100g: 9, carbohydrates_100g: 3.8, fat_100g: 5, fiber_100g: 0 } })!;
    expect(p.name).toBe("Greek Yogurt"); expect(p.brand).toBe("Fage"); expect(p.calories_per_100g).toBe(97);
    expect(p.source).toBe("off"); expect(p.source_id).toBe("123"); expect(p.source_url).toBe("https://world.openfoodfacts.org/product/123");
    expect(p.confidence).toBe(0.6); expect(p.flags).toEqual([]); expect(p.rationale).toContain("(Fage)");
  });
  it("confidence 0.45 when a macro is missing", () => {
    const p = proposalFromOff({ code: "1", product_name: "Thing", nutriments: { "energy-kcal_100g": 100, proteins_100g: 5 } })!;
    expect(p.confidence).toBe(0.45); expect(p.flags).toContain("missing:carbs");
  });
  it("not a candidate without a name, a code or kcal", () => {
    expect(proposalFromOff({ code: "1", product_name: "", nutriments: { "energy-kcal_100g": 1 } })).toBeNull();
    expect(proposalFromOff({ product_name: "x", nutriments: { "energy-kcal_100g": 1 } })).toBeNull();
    expect(proposalFromOff({ code: "1", product_name: "x", nutriments: {} })).toBeNull();
  });
});

describe("searchOpenFoodFacts", () => {
  const hit = { code: "9", product_name: "Oats", brands: "Quaker", nutriments: { "energy-kcal_100g": 379, proteins_100g: 13, carbohydrates_100g: 68, fat_100g: 6.5, fiber_100g: 10 } };
  it("uses search-a-licious when it has hits", async () => {
    const fetchImpl = vi.fn(async (url: string) => url.includes("search.openfoodfacts.org") ? json({ hits: [hit] }) : json({ products: [] })) as unknown as typeof fetch;
    const out = await searchOpenFoodFacts("oats", { fetchImpl });
    expect(out.map((p) => p.name)).toEqual(["Oats"]); expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = (fetchImpl as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0];
    expect(url).toContain("page_size=6"); expect((init.headers as Record<string, string>)["User-Agent"]).toContain("macro-engine-core");
  });
  it("falls back to the legacy cgi search when the first has no hits or fails", async () => {
    const fetchImpl = vi.fn(async (url: string) => url.includes("search.openfoodfacts.org") ? json({ hits: [] }) : json({ products: [hit, { code: "x" }] })) as unknown as typeof fetch;
    const out = await searchOpenFoodFacts("oats", { fetchImpl, limit: 3 });
    expect(out).toHaveLength(1); expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect((fetchImpl as unknown as { mock: { calls: [string][] } }).mock.calls[1][0]).toContain("cgi/search.pl");
  });
  it("throws when both sources fail", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 503 })) as unknown as typeof fetch;
    await expect(searchOpenFoodFacts("oats", { fetchImpl })).rejects.toThrow("Open Food Facts HTTP 503");
  });
});

describe("categories", () => {
  it("every category has a shrink priority", () => {
    for (const c of CATEGORIES) expect(SHRINK_BY_CATEGORY[c], c).toBeGreaterThan(0);
  });
});

import { slugify, guessCategory, canQuickAdd, quickAddDefaults, rankIngredients, recentlyUsed, isEstimated, ESTIMATE_SOURCE } from "../src/ingredient-research";

describe("slugify + guessCategory", () => {
  it("ascii lower-case ids, underscores, 60 chars", () => {
    expect(slugify("Peppers, sweet, green, raw")).toBe("peppers_sweet_green_raw");
    expect(slugify("  Σκορδαλιά  (Greek) ")).toBe("greek");
    expect(slugify("x".repeat(80))).toHaveLength(60);
  });
  it("names a category from the food, snack when nothing matches", () => {
    expect(guessCategory("Peppers, sweet, green, raw")).toBe("vegetable");
    expect(guessCategory("Cottage cheese with peppers")).toBe("dairy");
    expect(guessCategory("Halloumi (Aldi)")).toBe("dairy");
    expect(guessCategory("Spanakopita")).toBe("snack"); expect(guessCategory("Eggplant, grilled")).toBe("vegetable"); expect(guessCategory("Pita bread")).toBe("carbs");
    expect(guessCategory("Extra virgin olive oil")).toBe("fat");
  });
});

describe("quick add", () => {
  const full = { calories_per_100g: 20, protein_per_100g: 0.9, carbs_per_100g: 4.6, fat_per_100g: 0.2, fiber_per_100g: 1.7 };
  it("only when all five macros are known: an unknown is not 0", () => {
    expect(canQuickAdd(full)).toBe(true);
    expect(canQuickAdd({ ...full, fiber_per_100g: null })).toBe(false);
  });
  it("defaults: source name (brand in parentheses), id from the name, guessed category, weighed as eaten, grams", () => {
    expect(quickAddDefaults({ name: "Peppers, sweet, green, raw", brand: null })).toEqual({ id: "peppers_sweet_green_raw", name: "Peppers, sweet, green, raw", category: "vegetable", is_raw: false, unit: "g", grams_per_unit: null });
    expect(quickAddDefaults({ name: " Halloumi ", brand: "Aldi" })).toMatchObject({ id: "halloumi", name: "Halloumi (Aldi)", category: "dairy" });
    expect(quickAddDefaults({ name: "…" }).id).toBe("ingredient");
  });
  it("an estimated ingredient is the one whose source is the model", () => {
    expect(isEstimated({ source: ESTIMATE_SOURCE })).toBe(true);
    expect(isEstimated({ source: "usda" })).toBe(false);
    expect(isEstimated({})).toBe(false);
  });
});

describe("rankIngredients", () => {
  const cat = [
    { id: "cherry_tomatoes", name: "Cherry tomatoes", last_used: "2026-09-01", use_count: 3 },
    { id: "eggs_whole", name: "Eggs, whole", last_used: "2026-09-01", use_count: 3 },
    { id: "olive_oil", name: "Olive oil", last_used: "2026-08-20", use_count: 2 },
    { id: "kefir", name: "Kefir", in_presets: 2 },
    { id: "halloumi", name: "Halloumi (Aldi)", is_favorite: true },
    { id: "peppers_green", name: "Peppers, sweet, green, raw" },
    { id: "red_pepper_flakes", name: "Red pepper flakes" },
    { id: "pepperoni", name: "Pepperoni" },
  ];
  it("empty query: used first by recency, then presets and favourites, then the rest by name", () => {
    expect(rankIngredients(cat, "").map((i) => i.id)).toEqual(["cherry_tomatoes", "eggs_whole", "olive_oil", "kefir", "halloumi", "pepperoni", "peppers_green", "red_pepper_flakes"]);
  });
  it("a query filters by name and, inside a tier, a match at the start of the name wins", () => {
    expect(rankIngredients(cat, "pepper").map((i) => i.id)).toEqual(["pepperoni", "peppers_green", "red_pepper_flakes"]);
    expect(rankIngredients(cat, "EGG").map((i) => i.id)).toEqual(["eggs_whole"]);
    expect(rankIngredients(cat, "zzz")).toEqual([]);
  });
  it("a used ingredient outranks a better textual match", () => {
    const list = [{ id: "a", name: "Pepper, black" }, { id: "b", name: "Green pepper", last_used: "2026-09-10", use_count: 1 }];
    expect(rankIngredients(list, "pepper").map((i) => i.id)).toEqual(["b", "a"]);
  });
  it("recentlyUsed: the used ones, most recent first, capped", () => {
    expect(recentlyUsed(cat, 2).map((i) => i.id)).toEqual(["cherry_tomatoes", "eggs_whole"]);
    expect(recentlyUsed(cat).map((i) => i.id)).toEqual(["cherry_tomatoes", "eggs_whole", "olive_oil"]);
  });
  it("does not mutate the input", () => {
    const copy = [...cat]; rankIngredients(cat, ""); expect(cat).toEqual(copy);
  });
});

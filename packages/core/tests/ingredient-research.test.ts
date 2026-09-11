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

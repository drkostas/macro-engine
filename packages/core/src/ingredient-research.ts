/**
 * Ingredient research: candidates for a food the user typed, one shape, no
 * LLM. This module holds the source-independent parts (the proposal shape,
 * the picker categories and their shrink priority, the macro sanity flags)
 * and the Open Food Facts search. A consumer with its own local food table
 * (soma's USDA rows) adds that source on its side and merges the lists.
 * An unknown macro stays null, never 0.
 */

/** The picker's categories; shrink priority for auto-rebalance (carb 1, fat 2, protein 3, vegetable 999). */
export const CATEGORIES = ["carbs", "condiment", "dairy", "dessert", "drink", "fat", "fruit", "grain", "protein", "restaurant", "sauce", "snack", "supplement", "treat", "vegetable"] as const;
export type Category = (typeof CATEGORIES)[number];
export const SHRINK_BY_CATEGORY: Record<string, number> = {
  carbs: 1, grain: 1, fruit: 1, fat: 2, condiment: 2, sauce: 2, dairy: 2, dessert: 2, drink: 2, snack: 2, treat: 2, restaurant: 2,
  protein: 3, supplement: 3, vegetable: 999,
};

export interface Proposal {
  name: string;
  brand?: string | null;
  calories_per_100g: number | null;
  protein_per_100g: number | null;
  carbs_per_100g: number | null;
  fat_per_100g: number | null;
  fiber_per_100g: number | null;
  source: string;
  source_id: string;
  source_url: string;
  confidence: number;
  rationale: string;
  flags: string[];
}

export type Macros = Pick<Proposal, "calories_per_100g" | "protein_per_100g" | "carbs_per_100g" | "fat_per_100g" | "fiber_per_100g">;

/** Parse a number from a source's loose value; two decimals; null when absent or not finite. */
export function num(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return typeof n === "number" && Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

/** Flags a candidate whose macros don't add up: holes, or per-serving values filed as per-100 g. */
export function sanityFlags(p: Macros): string[] {
  const flags: string[] = [];
  for (const k of ["calories_per_100g", "protein_per_100g", "carbs_per_100g", "fat_per_100g", "fiber_per_100g"] as const) {
    if (p[k] == null) flags.push(`missing:${k.replace("_per_100g", "")}`);
  }
  if (p.calories_per_100g != null && p.protein_per_100g != null && p.carbs_per_100g != null && p.fat_per_100g != null) {
    const est = 4 * p.protein_per_100g + 4 * p.carbs_per_100g + 9 * p.fat_per_100g;
    if (Math.abs(est - p.calories_per_100g) > 0.2 * Math.max(p.calories_per_100g, 20)) flags.push("kcal_macro_mismatch");
  }
  return flags;
}

export interface OffProduct { code?: string; product_name?: string; brands?: string | string[]; nutriments?: Record<string, unknown> }

export interface OpenFoodFactsOptions {
  /** Max results. Default 6. */
  limit?: number;
  /** Per-request timeout. Default 8000 ms. */
  timeoutMs?: number;
  /** Identifies the caller to Open Food Facts (they ask for it). */
  userAgent?: string;
  fetchImpl?: typeof fetch;
}

const DEFAULT_UA = "macro-engine-core (https://github.com/drkostas/macro-engine; ingredient research)";

function withTimeout(ms: number): AbortSignal {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  (t as unknown as { unref?: () => void }).unref?.(); // Node: do not keep the process alive for the timeout
  return c.signal;
}

/** Open Food Facts: the search-a-licious service first (fast, reliable), the legacy cgi search as fallback (it 503s under load). */
export async function offProducts(query: string, o: Required<OpenFoodFactsOptions>): Promise<OffProduct[]> {
  const fields = "code,product_name,brands,nutriments";
  const headers = { "User-Agent": o.userAgent };
  try {
    const r = await o.fetchImpl(`https://search.openfoodfacts.org/search?q=${encodeURIComponent(query)}&page_size=${o.limit}&fields=${fields}`, { headers, signal: withTimeout(o.timeoutMs) });
    if (r.ok) { const d = (await r.json()) as { hits?: OffProduct[] }; if (d.hits?.length) return d.hits; }
  } catch { /* fall through to the legacy search */ }
  const r = await o.fetchImpl(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=${o.limit}&fields=${fields}`, { headers, signal: withTimeout(o.timeoutMs) });
  if (!r.ok) throw new Error(`Open Food Facts HTTP ${r.status}`);
  return ((await r.json()) as { products?: OffProduct[] }).products ?? [];
}

/** Turn one Open Food Facts product into a proposal, or null when it is not a candidate (no name, no code, no kcal). */
export function proposalFromOff(pr: OffProduct): Proposal | null {
  const n = pr.nutriments ?? {};
  const name = (pr.product_name ?? "").trim();
  const kcal = num(n["energy-kcal_100g"]);
  if (!name || !pr.code || kcal == null) return null;
  const brand = Array.isArray(pr.brands) ? pr.brands.filter(Boolean).join(", ") : pr.brands ? String(pr.brands) : null;
  const p: Macros & { name: string; brand: string | null } = {
    name, brand: brand || null,
    calories_per_100g: kcal, protein_per_100g: num(n["proteins_100g"]), carbs_per_100g: num(n["carbohydrates_100g"]),
    fat_per_100g: num(n["fat_100g"]), fiber_per_100g: num(n["fiber_100g"]),
  };
  const flags = sanityFlags(p);
  const complete = !flags.some((f) => f.startsWith("missing:"));
  return {
    ...p,
    source: "off",
    source_id: String(pr.code),
    source_url: `https://world.openfoodfacts.org/product/${pr.code}`,
    confidence: complete ? 0.6 : 0.45,
    rationale: `Open Food Facts${p.brand ? ` (${p.brand})` : ""}, community-entered label data per 100 g`,
    flags,
  };
}

export async function searchOpenFoodFacts(query: string, options: OpenFoodFactsOptions = {}): Promise<Proposal[]> {
  const o: Required<OpenFoodFactsOptions> = { limit: options.limit ?? 6, timeoutMs: options.timeoutMs ?? 8000, userAgent: options.userAgent ?? DEFAULT_UA, fetchImpl: options.fetchImpl ?? fetch };
  const out: Proposal[] = [];
  for (const pr of await offProducts(query, o)) { const p = proposalFromOff(pr); if (p) out.push(p); }
  return out;
}

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

/* ── The client half: naming a candidate, one-tap defaults, and the order the picker shows the
 *    catalog in. Shared so soma's app and web (and any other consumer) judge a candidate and
 *    rank the list the same way (soma#932, macro-engine#251). ─────────────────────────────── */

/** The source name of an ingredient whose macros were estimated by a model rather than read
 *  from a food table. Consumers mark these ("est.") wherever the ingredient is shown. */
export const ESTIMATE_SOURCE = "claude";

/** A catalog row as a picker sees it: identity plus, when the API supplies them, how it has been used. */
export interface CatalogIngredient {
  id: string;
  name: string;
  category?: string | null;
  /** Times the ingredient appears in the meal log. */
  use_count?: number | null;
  /** ISO date (YYYY-MM-DD) of the last meal that used it. */
  last_used?: string | null;
  /** Preset meals that name it. */
  in_presets?: number | null;
  is_favorite?: boolean | null;
  source?: string | null;
  confidence?: number | null;
}

/** True when the ingredient's macros came from an estimate (see ESTIMATE_SOURCE). */
export function isEstimated(ing: Pick<CatalogIngredient, "source">): boolean {
  return ing.source === ESTIMATE_SOURCE;
}

/** A catalog id from a food name: ASCII, lower case, a-z 0-9 and underscore, at most 60 chars. */
export function slugify(name: string): string {
  return name.toLowerCase().normalize("NFKD").replace(/[^\x00-\x7f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60);
}

/** The picker category a food name suggests; "snack" when nothing matches. Dairy and protein are
 *  tested before vegetable so "cottage cheese with peppers" stays dairy. */
export function guessCategory(name: string): Category {
  const n = name.toLowerCase();
  if (/\b(?:kefir|yog|milk|cheese|skyr|quark|cottage|feta|halloumi)/.test(n)) return "dairy";
  if (/\b(?:chicken|beef|pork|turkey|fish|salmon|tuna|egg(?!plant)|tofu|whey|shrimp|lamb|sardine|cod\b)/.test(n)) return "protein";
  if (/\b(?:rice|pasta|bread|oat|potato|quinoa|noodle|tortilla|cereal|pita\b|couscous|bulgur)/.test(n)) return "carbs";
  if (/\b(?:apple|banana|berr|orange|grape|mango|melon|kiwi|pear|peach|fig\b|date\b|cherr|plum|apricot)/.test(n)) return "fruit";
  if (/\b(?:oil|butter|nut|walnut|hazelnut|cashew|pistachio|almond|peanut|avocado|seed|tahini|olive)/.test(n)) return "fat";
  if (/\b(?:broccoli|spinach|tomato|lettuce|pepper|onion|carrot|cucumber|zucchini|salad|vegetable|cabbage|kale|leek|mushroom|eggplant|aubergine|courgette)/.test(n)) return "vegetable";
  if (/\b(?:sauce|dressing|ketchup|mayo|mustard|tzatziki)/.test(n)) return "sauce";
  if (/\b(?:juice|coffee|tea\b|soda|cola|beer|wine|drink)/.test(n)) return "drink";
  if (/\b(?:chocolate|cake|cookie|biscuit|ice cream|pastry|baklava)/.test(n)) return "dessert";
  return "snack";
}

/** True only when all five per-100 g macros are known: an unknown is not 0, and a one-tap confirm
 *  must not invent one. A candidate that fails this goes through the edit form instead. */
export function canQuickAdd(p: Macros): boolean {
  return p.calories_per_100g != null && p.protein_per_100g != null && p.carbs_per_100g != null && p.fat_per_100g != null && p.fiber_per_100g != null;
}

export interface QuickAddDefaults {
  id: string;
  name: string;
  category: Category;
  is_raw: boolean;
  unit: string;
  grams_per_unit: number | null;
}

/** The defaults a one-tap confirm sends: the source's name (brand in parentheses), an id from the
 *  name, a guessed category, weighed as eaten (is_raw false), in grams. Owner edits win over these
 *  in the edit form; the catalog can be corrected later. */
export function quickAddDefaults(p: Pick<Proposal, "name" | "brand">): QuickAddDefaults {
  const base = p.name.trim();
  const name = (p.brand ? `${base} (${p.brand.trim()})` : base).slice(0, 120);
  const id = slugify(base) || "ingredient";
  return { id, name, category: guessCategory(base), is_raw: false, unit: "g", grams_per_unit: null };
}

const matchPos = (name: string, q: string): number => {
  const i = name.toLowerCase().indexOf(q);
  return i < 0 ? Number.POSITIVE_INFINITY : i;
};
/** 0 = used before (meal log), 1 = in a preset or a favourite, 2 = the rest. */
const tier = (ing: CatalogIngredient): number => {
  if (ing.last_used || (ing.use_count ?? 0) > 0) return 0;
  if ((ing.in_presets ?? 0) > 0 || ing.is_favorite) return 1;
  return 2;
};

/** The ingredients that have been used before, most recent first (for a "Recently used" group). */
export function recentlyUsed<T extends CatalogIngredient>(list: T[], limit = 8): T[] {
  return list.filter((i) => tier(i) === 0).sort(byRecency).slice(0, limit);
}

const byRecency = (a: CatalogIngredient, b: CatalogIngredient): number =>
  (b.last_used ?? "").localeCompare(a.last_used ?? "") || (b.use_count ?? 0) - (a.use_count ?? 0) || a.name.localeCompare(b.name);

/**
 * The picker's order for a typed query (or for the whole catalog when the query is empty):
 * the ones already used first (most recent first), then the ones a preset or a favourite names,
 * then the rest; inside a tier a match at the start of the name beats one in the middle, then the
 * name. Filters by the query as a case-insensitive substring of the name.
 */
export function rankIngredients<T extends CatalogIngredient>(list: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  const hits = q ? list.filter((i) => i.name.toLowerCase().includes(q)) : [...list];
  return hits.sort((a, b) => {
    const t = tier(a) - tier(b);
    if (t) return t;
    if (tier(a) === 0) return byRecency(a, b);
    if (tier(a) === 1) { const d = (b.in_presets ?? 0) - (a.in_presets ?? 0); if (d) return d; }
    if (q) { const d = matchPos(a.name, q) - matchPos(b.name, q); if (d) return d; }
    return a.name.localeCompare(b.name);
  });
}

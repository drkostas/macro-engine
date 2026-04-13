/**
 * Import USDA FoodData Central into Neon Postgres.
 *
 * Uses the USDA search API to fetch Foundation + SR Legacy foods
 * with nutrient data. Processes them in pages and bulk-inserts.
 *
 * Usage: npx tsx scripts/import-usda.ts
 * Requires: DATABASE_URL in .env.local
 */

import { readFileSync } from "fs";
import { join } from "path";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: join(__dirname, "../.env.local") });

const sql = neon(process.env.DATABASE_URL!);
const API_KEY = process.env.USDA_API_KEY || "DEMO_KEY";
const BASE = "https://api.nal.usda.gov/fdc/v1";

// Nutrient IDs we care about
const NUTRIENT_MAP: Record<number, string> = {
  1008: "calories",
  1003: "protein",
  1005: "carbs",
  1004: "fat",
  1079: "fiber",
  2000: "sugar",
  1093: "sodium",
};

interface FoodRow {
  fdc_id: number;
  description: string;
  brand_owner: string | null;
  data_type: string;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  sugar: number | null;
  sodium: number | null;
  serving_size_g: number | null;
  serving_description: string | null;
}

function esc(v: string | null): string {
  if (v === null || v === undefined || v === "") return "NULL";
  return `'${v.replace(/'/g, "''")}'`;
}

function n(v: number | null): string {
  if (v === null || v === undefined || isNaN(v as number)) return "NULL";
  return String(v);
}

async function searchUSDA(
  query: string,
  dataType: string[],
  pageSize: number,
  pageNumber: number,
): Promise<{ foods: FoodRow[]; totalPages: number }> {
  const resp = await fetch(`${BASE}/foods/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": API_KEY,
    },
    body: JSON.stringify({
      query,
      dataType,
      pageSize,
      pageNumber,
      sortBy: "dataType.keyword",
      sortOrder: "asc",
    }),
  });

  if (resp.status === 429) {
    console.log("  Rate limited. Waiting 60s...");
    await new Promise((r) => setTimeout(r, 60000));
    return searchUSDA(query, dataType, pageSize, pageNumber);
  }

  if (!resp.ok) {
    throw new Error(`USDA API ${resp.status}: ${await resp.text()}`);
  }

  const data = await resp.json();
  const foods: FoodRow[] = [];

  for (const item of data.foods || []) {
    const food: FoodRow = {
      fdc_id: item.fdcId,
      description: item.description || "",
      brand_owner: item.brandOwner || null,
      data_type: (item.dataType || "").toLowerCase().replace(/ /g, "_"),
      calories: null,
      protein: null,
      carbs: null,
      fat: null,
      fiber: null,
      sugar: null,
      sodium: null,
      serving_size_g: item.servingSize || null,
      serving_description: item.servingSizeUnit || null,
    };

    for (const fn of item.foodNutrients || []) {
      const macro = NUTRIENT_MAP[fn.nutrientId];
      if (macro && fn.value != null) {
        (food as unknown as Record<string, number | null>)[macro] = fn.value;
      }
    }

    if (food.calories != null && food.calories > 0) {
      foods.push(food);
    }
  }

  return { foods, totalPages: data.totalPages || 1 };
}

async function insertBatch(foods: FoodRow[]): Promise<void> {
  if (foods.length === 0) return;

  const values = foods
    .map(
      (f) =>
        `(${f.fdc_id}, ${esc(f.description)}, ${esc(f.brand_owner)}, ${esc(f.data_type)}, ` +
        `${n(f.calories)}, ${n(f.protein)}, ${n(f.carbs)}, ${n(f.fat)}, ` +
        `${n(f.fiber)}, ${n(f.sugar)}, ${n(f.sodium)}, ` +
        `${n(f.serving_size_g)}, ${esc(f.serving_description)})`,
    )
    .join(",\n");

  await sql(`
    INSERT INTO usda_foods (fdc_id, description, brand_owner, data_type,
      calories, protein, carbs, fat, fiber, sugar, sodium,
      serving_size_g, serving_description)
    VALUES ${values}
    ON CONFLICT (fdc_id) DO UPDATE SET
      description = EXCLUDED.description,
      calories = EXCLUDED.calories,
      protein = EXCLUDED.protein,
      carbs = EXCLUDED.carbs,
      fat = EXCLUDED.fat,
      fiber = EXCLUDED.fiber
  `);
}

async function main() {
  console.log("=== USDA FoodData Central Import ===\n");

  // Apply schema first
  const schema = readFileSync(join(__dirname, "schema.sql"), "utf-8");
  const stmts = schema
    .split("\n")
    .map((line) => (line.trimStart().startsWith("--") ? "" : line))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const stmt of stmts) await sql(stmt + ";");
  console.log("Schema OK\n");

  // Search with a wildcard to get ALL Foundation + SR Legacy foods
  // The USDA API allows "*" as a query to match everything
  const dataTypes = ["Foundation", "SR Legacy"];
  let totalInserted = 0;

  for (const dt of dataTypes) {
    console.log(`Importing ${dt}...`);
    let page = 1;
    let totalPages = 999;

    while (page <= totalPages) {
      const result = await searchUSDA("*", [dt], 200, page);
      totalPages = result.totalPages;

      if (result.foods.length === 0) break;

      await insertBatch(result.foods);
      totalInserted += result.foods.length;

      console.log(
        `  Page ${page}/${totalPages}: +${result.foods.length} (total: ${totalInserted})`,
      );

      page++;
      // Small delay to be respectful
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  // Verify
  const [r] = await sql`SELECT COUNT(*) as count FROM usda_foods`;
  console.log(`\nDone! ${r.count} foods in database.`);
}

main().catch((e) => {
  console.error("Import failed:", e);
  process.exit(1);
});

import { neon } from "@neondatabase/serverless";
import { join } from "path";
import { config } from "dotenv";

config({ path: join(__dirname, "../.env.local") });

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const [r] = await sql`SELECT COUNT(*) as count FROM usda_foods`;
  console.log(`usda_foods: ${r.count} rows`);

  if (Number(r.count) > 0) {
    const samples = await sql`SELECT fdc_id, description, calories, protein, carbs, fat, data_type FROM usda_foods LIMIT 5`;
    console.log("\nSample foods:");
    for (const s of samples) {
      console.log(`  ${s.description} (${s.data_type}) - ${s.calories} kcal, ${s.protein}g P, ${s.carbs}g C, ${s.fat}g F`);
    }
  }

  // Test search
  if (Number(r.count) > 0) {
    const results = await sql`
      SELECT fdc_id, description, calories, protein, data_type,
        ts_rank(search_vector, plainto_tsquery('english', 'chicken breast')) as rank
      FROM usda_foods
      WHERE search_vector @@ plainto_tsquery('english', 'chicken breast')
      ORDER BY rank DESC
      LIMIT 5
    `;
    console.log("\nSearch 'chicken breast':");
    for (const r of results) {
      console.log(`  ${r.description} - ${r.calories} kcal, ${r.protein}g P`);
    }
  }
}

main().catch((e) => console.error(e.message));

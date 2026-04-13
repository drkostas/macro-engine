import { neon } from "@neondatabase/serverless";
import { join } from "path";
import { config } from "dotenv";

config({ path: join(__dirname, "../.env.local") });

const QUERIES = [
  "chicken breast", "rice", "banana", "egg", "milk",
  "salmon", "broccoli", "sweet potato", "oatmeal", "yogurt",
  "pasta", "bread", "apple", "almonds", "olive oil",
  "beef", "tuna", "avocado", "peanut butter", "cheese",
];

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  console.log("Search quality test:\n");
  let found = 0;

  for (const q of QUERIES) {
    const results = await sql(`
      SELECT description, calories, protein
      FROM usda_foods
      WHERE search_vector @@ plainto_tsquery('english', $1)
         OR description ILIKE $2
      ORDER BY ts_rank(search_vector, plainto_tsquery('english', $1)) DESC
      LIMIT 1
    `, [q, `%${q}%`]);

    if (results.length > 0) {
      const r = results[0];
      console.log(`  "${q}" -> ${r.description} (${r.calories} kcal, ${r.protein}g P)`);
      found++;
    } else {
      console.log(`  "${q}" -> NOT FOUND`);
    }
  }

  console.log(`\n${found}/${QUERIES.length} common foods found`);
}

main().catch((e) => console.error(e.message));

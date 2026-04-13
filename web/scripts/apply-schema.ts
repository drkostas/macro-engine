import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { join } from "path";
import { config } from "dotenv";

config({ path: join(__dirname, "../.env.local") });

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const schema = readFileSync(join(__dirname, "schema.sql"), "utf-8");

  // Neon serverless driver doesn't support multi-statement queries.
  // Strip comments, split on semicolons, execute each individually.
  const cleaned = schema
    .split("\n")
    .map((line) => (line.trimStart().startsWith("--") ? "" : line))
    .join("\n");
  const statements = cleaned
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    await sql(stmt + ";");
  }
  console.log(`Schema applied! (${statements.length} statements)`);

  const [r] = await sql`SELECT COUNT(*) as count FROM usda_foods`;
  console.log(`usda_foods: ${r.count} rows`);

  const [r2] = await sql`SELECT COUNT(*) as count FROM user_foods`;
  console.log(`user_foods: ${r2.count} rows`);
}

main().catch((e) => {
  console.error("Failed:", e.message);
  process.exit(1);
});

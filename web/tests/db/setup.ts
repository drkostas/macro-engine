import { neon } from "@neondatabase/serverless";

/**
 * Test DB accessor. Uses DATABASE_URL_TEST so tests don't pollute dev data.
 * Recommended: a Neon branch of the main DB (copy-on-write schema + data).
 */
export function getTestDb() {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) {
    throw new Error(
      "DATABASE_URL_TEST not set. Create a Neon branch and add the connection string to .env.local.",
    );
  }
  return neon(url);
}

/** Assert the test DB has the expected schema. */
export async function ensureSchema() {
  const sql = getTestDb();
  const rows = await sql`SELECT to_regclass('public.nutrition_profile') AS exists`;
  if (!rows[0]?.exists) {
    throw new Error(
      "Test DB missing schema. Use Neon branching (which copies schema+data from main).",
    );
  }
}

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import postgres from "postgres";

type Sql = NeonQueryFunction<false, false>;

let cached: Sql | null = null;

export function getDb(): Sql {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL not set");
  }
  if (url.includes("neon.tech")) {
    cached = neon(url);
  } else {
    // Local / standard Postgres — postgres.js exposes a tagged template that
    // returns an array-like of row objects, matching the Neon call shape.
    const client = postgres(url, { prepare: false });
    const tag = (strings: TemplateStringsArray, ...values: unknown[]) =>
      (client as unknown as (s: TemplateStringsArray, ...v: unknown[]) => Promise<unknown[]>)(strings, ...values)
        .then((rows) => Array.from(rows) as Record<string, unknown>[]);
    cached = tag as unknown as Sql;
  }
  return cached;
}

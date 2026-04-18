/** Throws in production if any required env var is missing or too short. */
export function assertProdEnv(): void {
  if (process.env.NODE_ENV !== "production") return;

  const missing: string[] = [];
  if (!process.env.DATABASE_URL) missing.push("DATABASE_URL");
  if (!process.env.MACROENGINE_PASSWORD || process.env.MACROENGINE_PASSWORD.length < 12) {
    missing.push("MACROENGINE_PASSWORD (required, min 12 chars)");
  }
  if (!process.env.MACROENGINE_SECRET || process.env.MACROENGINE_SECRET.length < 32) {
    missing.push("MACROENGINE_SECRET (required, min 32 chars; generate with: openssl rand -base64 32)");
  }
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }
}

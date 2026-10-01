import postgres from "postgres";

/**
 * Tagged-template SQL function matching the @neondatabase/serverless shape
 * the codebase was originally written against: `sql` returns Promise<rows[]>.
 *
 * Exposes `.json(x)` as a passthrough helper to mark values that must be sent
 * as a JSONB payload. Do NOT JSON.stringify values before `sql.json(x)` — that
 * produces a double-encoded string in the column.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

type SqlTag = {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<Row[]>;
  json: <T>(value: T) => unknown;
  /** Close the connection. A no-op over the gateway, where each query is its own request. */
  end: () => Promise<void>;
};

let cached: SqlTag | null = null;

/**
 * ⛔ THE HOST IN A GATEWAY CONNECTION STRING IS NOT A REAL HOST. The database moved onto a machine
 * at home, which a function here cannot open a socket to, and putting a Postgres port on the
 * internet is not an option. It is reached over HTTPS instead, at the endpoint derived from the
 * connection host the way Neon's own driver derives it: the first label becomes `api.`.
 *
 * `postgres.js` holds a real socket, so pointed at `pg.gkos.dev` it tries to RESOLVE it and the
 * app reports `db: disconnected` while every page still renders. That is what this fixes.
 */
function gatewayTag(url: string): SqlTag {
  const endpoint = `https://${new URL(url).hostname.replace(/^[^.]+\./, "api.")}/sql`;
  const tag = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = "";
    strings.forEach((part, i) => {
      text += part;
      if (i < values.length) text += `$${i + 1}`;
    });
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Neon-Connection-String": url },
      body: JSON.stringify({ query: text, params: values }),
    });
    const body = await res.json().catch(() => ({}) as Record<string, unknown>);
    if (!res.ok) throw new Error(String(body?.message ?? `gateway HTTP ${res.status}`));
    return (body.rows ?? []) as Row[];
  }) as SqlTag;
  // A JSONB payload goes over the wire as an object; the gateway hands it to pg unchanged.
  tag.json = <T,>(value: T) => value as unknown;
  tag.end = async () => {};
  return tag;
}

/**
 * The SQL tag for any connection string: the gateway over HTTPS for a `pg.` host, a
 * `postgres.js` socket otherwise. NOT cached, so each caller decides how long to keep it.
 *
 * Exists for connections other than DATABASE_URL. The Garmin sync opened SOMA_DATABASE_URL
 * with `postgres(url)` itself, so when that moved to the gateway the route failed with
 * `ENOTFOUND pg.gkos.dev` while `getDb()` kept working (#270). `name` only labels the error.
 */
export function sqlFor(
  url: string,
  name = "connection string",
  opts: { idle_timeout?: number } = {},
): SqlTag {
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    // Fail where the mistake is, rather than as a confusing connection error later.
    throw new Error(`${name} is not a valid connection string`);
  }
  if (host.startsWith("pg.")) return gatewayTag(url);

  const client = postgres(url, { prepare: false, ...opts });

  const tag = ((strings: TemplateStringsArray, ...values: unknown[]) =>
    (client as unknown as (s: TemplateStringsArray, ...v: unknown[]) => Promise<unknown[]>)(strings, ...values)
      .then((rows) => Array.from(rows) as Row[])) as SqlTag;

  tag.json = <T,>(value: T) => (client as unknown as { json: (v: T) => unknown }).json(value);
  tag.end = () => client.end();

  return tag;
}

export function getDb(): SqlTag {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL not set");
  }
  cached = sqlFor(url, "DATABASE_URL");
  return cached;
}

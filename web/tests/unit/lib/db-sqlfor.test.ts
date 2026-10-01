import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// #270: the Garmin sync opened SOMA_DATABASE_URL with postgres.js itself, so once that string named
// the home gateway (pg.gkos.dev, not a real host) the route failed with ENOTFOUND.
const postgresMock = vi.fn(() => {
  const client = Object.assign(vi.fn(async () => []), { end: vi.fn(async () => {}), json: (v: unknown) => v });
  return client;
});
vi.mock("postgres", () => ({ default: postgresMock }));

const GATEWAY_SOMA = "postgresql://soma_ro:pw@pg.gkos.dev/soma?sslmode=require";
const GATEWAY_ME = "postgresql://macroengine_app:pw@pg.gkos.dev/macroengine?sslmode=require";

describe("sqlFor", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    postgresMock.mockClear();
    fetchMock = vi.fn(async () => new Response(JSON.stringify({ rows: [{ n: 1 }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("sends a gateway connection string over HTTPS and never opens a socket", async () => {
    const { sqlFor } = await import("@/lib/db");
    const sql = sqlFor(GATEWAY_SOMA, "SOMA_DATABASE_URL");
    const rows = await sql`SELECT ${1} AS n`;

    expect(rows).toEqual([{ n: 1 }]);
    expect(postgresMock).not.toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.gkos.dev/sql");
    expect((init.headers as Record<string, string>)["Neon-Connection-String"]).toBe(GATEWAY_SOMA);
    expect(JSON.parse(String(init.body))).toEqual({ query: "SELECT $1 AS n", params: [1] });
    await expect(sql.end()).resolves.toBeUndefined();
  });

  it("opens an ordinary Postgres URL with postgres.js and closes it with end()", async () => {
    const { sqlFor } = await import("@/lib/db");
    const sql = sqlFor("postgresql://u:p@127.0.0.1:5432/soma", "SOMA_DATABASE_URL", { idle_timeout: 5 });

    expect(postgresMock).toHaveBeenCalledWith("postgresql://u:p@127.0.0.1:5432/soma", { prepare: false, idle_timeout: 5 });
    await sql.end();
    const client = postgresMock.mock.results[0].value as { end: ReturnType<typeof vi.fn> };
    expect(client.end).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not hand back getDb()'s cached DATABASE_URL connection", async () => {
    vi.stubEnv("DATABASE_URL", GATEWAY_ME);
    const { getDb, sqlFor } = await import("@/lib/db");
    await getDb()`SELECT 1`;
    await sqlFor(GATEWAY_SOMA)`SELECT 1`;

    const sent = fetchMock.mock.calls.map(
      ([, init]) => ((init as RequestInit).headers as Record<string, string>)["Neon-Connection-String"],
    );
    expect(sent).toEqual([GATEWAY_ME, GATEWAY_SOMA]);
  });

  it("names the variable when the string is not a URL", async () => {
    const { sqlFor } = await import("@/lib/db");
    expect(() => sqlFor("not a url", "SOMA_DATABASE_URL")).toThrow(/SOMA_DATABASE_URL is not a valid/);
  });
});

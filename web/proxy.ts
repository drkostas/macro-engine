import { NextResponse, type NextRequest } from "next/server";

/* Session verify is inlined here (rather than imported from @/lib/auth) because
   Vercel's Edge middleware bundler rejects a cross-module reference from the
   middleware even when the module is edge-safe. The logic is identical to
   lib/auth.ts (pure Web Crypto: HMAC-SHA256 via crypto.subtle). The API routes
   still import from @/lib/auth — they run on the Node serverless runtime. */
const SESSION_COOKIE = "me_session";
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const CLOCK_SKEW_SECONDS = 300;

function b64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

let cachedKey: { secret: string; key: CryptoKey } | null = null;

async function getKey(): Promise<CryptoKey> {
  const secret = process.env.MACROENGINE_SECRET;
  if (!secret) throw new Error("MACROENGINE_SECRET not set");
  if (secret.length < 32) throw new Error("MACROENGINE_SECRET must be at least 32 chars");
  if (cachedKey && cachedKey.secret === secret) return cachedKey.key;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  cachedKey = { secret, key };
  return key;
}

async function hmac(data: string): Promise<string> {
  const key = await getKey();
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return b64url(sig);
}

async function verifySession(cookie: string | null): Promise<boolean> {
  if (!cookie) return false;
  const m = cookie.match(/^v1\.(\d+)\.([A-Za-z0-9_-]+)$/);
  if (!m) return false;
  const ts = Number(m[1]);
  const sig = m[2];
  const now = Math.floor(Date.now() / 1000);
  if (now - ts > SESSION_TTL_SECONDS) return false;
  if (ts > now + CLOCK_SKEW_SECONDS) return false;
  try {
    const expected = await hmac(`v1.${ts}`);
    if (sig.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
    return diff === 0;
  } catch {
    return false;
  }
}

const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/health",
];

const STATIC_PREFIX = /^\/(_next|favicon|manifest|icons|sw\.js|robots|sitemap)/;

const isDev = process.env.NODE_ENV !== "production";

/** Dev-only CORS so the universal Expo app (localhost:8093) can consume this API. */
function withDevCors(res: NextResponse, isApi: boolean): NextResponse {
  if (isDev && isApi) {
    res.headers.set("Access-Control-Allow-Origin", "*");
    res.headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }
  return res;
}

/** Permissive CORS applied when a request authenticates via the personal API
    token (the native app + iOS widgets). */
function withTokenCors(res: NextResponse): NextResponse {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return res;
}

/** Does the request carry the valid personal API token? Lets native clients
    (Expo app, widgets) reach /api/* without a browser session. */
function hasApiToken(req: NextRequest): boolean {
  const token = process.env.MACROENGINE_API_TOKEN?.trim();
  if (!token) return false;
  return req.headers.get("authorization") === `Bearer ${token}`;
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");
  if (STATIC_PREFIX.test(pathname)) return NextResponse.next();

  // Dev CORS preflight
  if (isDev && isApi && req.method === "OPTIONS") {
    return withDevCors(new NextResponse(null, { status: 204 }), true);
  }

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return withDevCors(NextResponse.next(), isApi);
  }

  // Personal API token: native app + widgets reach /api/* without a session.
  if (isApi && hasApiToken(req)) return withTokenCors(NextResponse.next());

  // Dev bypass: no password set + dev mode = unauthenticated access (localhost convenience)
  if (isDev && !process.env.MACROENGINE_PASSWORD) {
    return withDevCors(NextResponse.next(), isApi);
  }

  const cookie = req.cookies.get(SESSION_COOKIE)?.value ?? null;
  if (await verifySession(cookie)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

/* Next 16: `proxy` (formerly `middleware`) always runs on the Node.js runtime —
   which is exactly what we need, since the deprecated edge middleware runtime
   injected a Node-only `__dirname` here and 500'd every request. `runtime` is not
   configurable in a proxy file (it throws), so it's omitted. */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

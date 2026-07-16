import { NextResponse, type NextRequest } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/auth";

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
    res.headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }
  return res;
}

export async function middleware(req: NextRequest) {
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

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

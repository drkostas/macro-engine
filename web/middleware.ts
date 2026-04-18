import { NextResponse, type NextRequest } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/auth";

const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/health",
];

const STATIC_PREFIX = /^\/(_next|favicon|manifest|icons|sw\.js|robots|sitemap)/;

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (STATIC_PREFIX.test(pathname)) return NextResponse.next();
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  // Dev bypass: no password set + dev mode = unauthenticated access (localhost convenience)
  if (process.env.NODE_ENV !== "production" && !process.env.MACROENGINE_PASSWORD) {
    return NextResponse.next();
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

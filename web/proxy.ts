import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const secret = process.env.MACROENGINE_SECRET;
  const path = request.nextUrl.pathname;

  // No secret configured (local dev): allow everything
  if (!secret) {
    return NextResponse.next();
  }

  // POST /api/* (except webhooks and cron): require auth
  if (
    request.method === "POST" &&
    path.startsWith("/api/") &&
    !path.startsWith("/api/webhooks/") &&
    !path.startsWith("/api/cron/")
  ) {
    const token =
      request.cookies.get("me_auth")?.value ||
      request.headers.get("x-api-key");
    if (token !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Auto-set auth cookie on GET if not present
  if (request.method === "GET" && !request.cookies.get("me_auth")) {
    const response = NextResponse.next();
    response.cookies.set("me_auth", secret, {
      httpOnly: true,
      sameSite: "strict",
      maxAge: 365 * 86400,
      path: "/",
    });
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

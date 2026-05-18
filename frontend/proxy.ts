import { NextRequest, NextResponse } from "next/server";

const BACKEND_BASE = (
  process.env.SSUAI_API_PROXY_TARGET ||
  process.env.NEXT_PUBLIC_SSUAI_API_BASE ||
  "http://localhost:8080"
).replace(/\/$/, "");

// Intercept the SmartID SSO callback before the /api/* rewrite runs.
// Vercel strips Set-Cookie from rewrite proxy responses that come from a
// different domain, so the backend can never set the refresh cookie through
// a rewrite. Middleware runs first and re-issues the cookie itself, which
// makes it land on ssuai.vercel.app rather than ssumcp.duckdns.org.
export async function proxy(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  let backendRes: Response;
  try {
    backendRes = await fetch(
      `${BACKEND_BASE}/api/auth/saint/sso-callback?${searchParams.toString()}`,
      { redirect: "manual" },
    );
  } catch {
    return NextResponse.redirect(new URL("/auth/return?error=unknown", request.url));
  }

  const setCookie = backendRes.headers.get("set-cookie");

  if (backendRes.status === 200 && setCookie) {
    const response = NextResponse.redirect(new URL("/auth/return?ok=1", request.url));
    response.headers.set("Set-Cookie", setCookie);
    return response;
  }

  if (backendRes.status === 302 || backendRes.status === 301) {
    const location = backendRes.headers.get("location") ?? "";
    try {
      const search = new URL(location).search;
      return NextResponse.redirect(new URL(`/auth/return${search}`, request.url));
    } catch {
      // ignore malformed location
    }
  }

  return NextResponse.redirect(new URL("/auth/return?error=unknown", request.url));
}

export const config = {
  matcher: ["/api/auth/saint/sso-callback"],
};

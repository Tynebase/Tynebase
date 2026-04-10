import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { extractSubdomain } from "@/lib/utils";

const BASE_DOMAIN = process.env.NEXT_PUBLIC_BASE_DOMAIN || "tynebase.com";

const PUBLIC_ROUTES = [
  "/",
  "/pricing",
  "/login",
  "/signup",
  "/auth/callback",
  "/auth/verify",
  "/auth/reset-password",
  "/auth/oauth-login",
  "/auth/accept-invite",
  "/auth/complete-signup",
  "/docs",
  "/community",
  "/public-documents",
];

const RESERVED_SUBDOMAINS = [
  "www", "api", "app", "admin", "auth", "login", "signup",
  "mail", "support", "help", "docs", "blog", "status",
  "cdn", "static"
];

/**
 * Check if user is authenticated by validating JWT token presence
 */
function isAuthenticated(request: NextRequest): boolean {
  const accessToken = request.cookies.get("access_token")?.value;
  return !!accessToken;
}

export async function proxy(request: NextRequest) {
  const hostname = request.headers.get("host") || "";
  const subdomain = extractSubdomain(hostname, BASE_DOMAIN);
  const pathname = request.nextUrl.pathname;
  const isAuth = isAuthenticated(request);

  // If it's a file or static asset, let it through
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Root domain (marketing site)
  if (!subdomain || subdomain === "www") {
    // Standard dashboard protection on main site
    if (pathname.startsWith("/dashboard")) {
      if (!isAuth) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("redirect", pathname);
        return NextResponse.redirect(loginUrl);
      }
    }
    return NextResponse.next();
  }

  // Check for reserved subdomains
  if (RESERVED_SUBDOMAINS.includes(subdomain.toLowerCase())) {
    // If it's a reserved subdomain but not www, we let it through
    // because it might have its own logic or we might want a 404 handled elsewhere
    return NextResponse.next();
  }

  // Tenant subdomain logic
  
  // 1. Rewrite root to portal
  if (pathname === "/") {
    return NextResponse.rewrite(new URL(`/portal?domain=${hostname}`, request.url));
  }

  // 2. Rewrite community to tenant community
  if (pathname === "/community") {
    return NextResponse.rewrite(new URL(`/community?domain=${hostname}`, request.url));
  }

  // 3. Handle protected routes on subdomains
  if (pathname.startsWith("/dashboard")) {
    if (!isAuth) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Add tenant context to response headers
  const response = NextResponse.next();
  response.headers.set("x-tenant-subdomain", subdomain);
  
  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};

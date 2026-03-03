import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js Middleware for Custom Domain & Subdomain Handling
 * 
 * Architecture:
 * 
 * 1. acme.tynebase.com (subdomain)
 *    → Pass through normally. TenantContext extracts "acme" from hostname
 *      and applies branding across the ENTIRE app (dashboard, docs, everything).
 * 
 * 2. app.acme.com (truly custom domain — Pro feature)
 *    → Set a `x-custom-domain` cookie so TenantContext can resolve the tenant.
 *    → All app pages work normally with the tenant's branding.
 *    → Root path (/) on custom domain shows branded portal landing for visitors.
 * 
 * 3. tynebase.com / localhost (main site)
 *    → Normal app, no tenant context from URL.
 */

const BASE_DOMAIN = process.env.NEXT_PUBLIC_BASE_DOMAIN || 'tynebase.com';

const KNOWN_HOSTS = [
  'localhost',
  '127.0.0.1',
  BASE_DOMAIN,
];

function isKnownHost(hostname: string): boolean {
  const host = hostname.split(':')[0];
  return KNOWN_HOSTS.some(known => host === known);
}

function isSubdomain(hostname: string): boolean {
  const host = hostname.split(':')[0];
  // e.g. acme.tynebase.com → is a subdomain of tynebase.com
  return host.endsWith(`.${BASE_DOMAIN}`) && host !== `www.${BASE_DOMAIN}`;
}

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const host = hostname.split(':')[0];
  const { pathname } = request.nextUrl;

  // Skip static assets and Next.js internals always
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // === CASE 1: Main site (tynebase.com, localhost) ===
  if (isKnownHost(hostname)) {
    return NextResponse.next();
  }

  // === CASE 2: Subdomain (acme.tynebase.com) ===
  // Pass through — TenantContext already handles subdomain extraction & branding
  if (isSubdomain(hostname)) {
    return NextResponse.next();
  }

  // === CASE 3: Truly custom domain (app.acme.com) ===
  // Set cookie so TenantContext can resolve tenant, then pass through
  const response = NextResponse.next();
  response.cookies.set('x-custom-domain', host, {
    path: '/',
    httpOnly: false, // Needs to be readable by client-side JS
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60, // 1 hour
  });

  // Root path on custom domain → show branded portal landing for visitors
  // (authenticated users on /dashboard etc. get the full app)
  if (pathname === '/' || pathname === '') {
    const url = request.nextUrl.clone();
    url.pathname = '/portal';
    url.searchParams.set('domain', host);
    return NextResponse.rewrite(url);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

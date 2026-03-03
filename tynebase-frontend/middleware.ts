import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js Middleware for Custom Domain Detection
 * 
 * When a request comes in on a custom domain (e.g., docs.acme.com):
 * - Root path → rewrite to /portal?domain=docs.acme.com (branded docs listing)
 * - /docs/[id] → pass through (the doc reader page works for any domain)
 * - Everything else on custom domain → rewrite to /portal
 * 
 * Known hosts (tynebase.com, localhost, vercel.app) are passed through normally.
 */

const KNOWN_HOSTS = [
  'localhost',
  '127.0.0.1',
  'tynebase.com',
  'tynebase.vercel.app',
];

function isKnownHost(hostname: string): boolean {
  const host = hostname.split(':')[0];
  return KNOWN_HOSTS.some(known => {
    if (host === known) return true;
    if (host.endsWith(`.${known}`)) return true;
    return false;
  });
}

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const host = hostname.split(':')[0];

  // Skip for known hosts — serve the normal app
  if (isKnownHost(hostname)) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  const { pathname } = url;

  // Never rewrite static assets, API routes, or Next.js internals
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Let /docs/[id] pass through — the document reader works on any domain
  if (pathname.startsWith('/docs/')) {
    return NextResponse.next();
  }

  // Everything else on the custom domain → branded portal
  url.pathname = '/portal';
  url.searchParams.set('domain', host);
  
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js Middleware for Custom Domain Detection
 * 
 * When a request comes in on a custom domain (e.g., docs.acme.com),
 * we rewrite the URL to /portal/[domain] so the branded docs page is served.
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
  // Remove port if present
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

  // This is a custom domain request — rewrite to the portal page
  // which will look up the tenant by domain and serve branded public docs
  const url = request.nextUrl.clone();
  
  // Only rewrite the root and common paths — don't rewrite API calls or assets
  if (
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/_next') ||
    url.pathname.startsWith('/favicon') ||
    url.pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Rewrite to /portal with the domain as a search param
  url.pathname = '/portal';
  url.searchParams.set('domain', host);
  
  return NextResponse.rewrite(url);
}

export const config = {
  // Match all paths except static files and API routes
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js Middleware for Subdomain Routing
 * 
 * All tenant branding works via *.tynebase.com subdomains:
 *   acme.tynebase.com → full app with Acme branding (dashboard, docs, everything)
 *   tynebase.com      → main marketing site + shared app
 * 
 * TenantContext handles subdomain extraction from hostname and applies
 * branding across the entire app. This middleware just passes everything through.
 */

export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

# Next.js Proxy Convention (Next.js 15+)

**Last Updated**: 2026-01-26  
**Migration Status**: ✅ Completed

## Overview

As of Next.js 15/16, the `middleware.ts` file convention has been renamed to `proxy.ts`. This change clarifies the purpose of the feature and aligns better with its actual behavior as a network boundary layer.

## Why the Change?

1. **Clarity**: The term "middleware" was often confused with Express.js middleware, leading to misuse
2. **Purpose**: "Proxy" better describes the feature's role as a network boundary in front of the app
3. **Edge Runtime**: The feature runs at the Edge Runtime by default, separated from the app's region
4. **Direction**: Next.js is moving away from overloaded middleware features toward more specific APIs

## Migration Applied

### File Rename
- **Old**: `tynebase-frontend/middleware.ts`
- **New**: `tynebase-frontend/proxy.ts`

### Function Rename
```typescript
// OLD (middleware.ts)
export async function middleware(request: NextRequest) {
  // ...
}

// NEW (proxy.ts)
export async function proxy(request: NextRequest) {
  // ...
}
```

### Migration Command Used
```bash
npx @next/codemod@canary middleware-to-proxy .
```

## Current Implementation

Our `proxy.ts` file handles:

1. **JWT Token Authentication**
   - Validates `access_token` cookie presence
   - Redirects unauthenticated users to `/login`

2. **Subdomain Routing**
   - Root domain (www/no subdomain) → Marketing site
   - Tenant subdomains → Tenant-specific app
   - Reserved subdomains → 404 (tenant-not-found)

3. **Route Protection**
   - Public routes: `/`, `/pricing`, `/login`, `/signup`, `/auth/*`
   - Protected routes: `/dashboard/*` (requires authentication)

4. **Tenant Context**
   - Extracts subdomain from hostname
   - Adds `x-tenant-subdomain` header to responses

## Convention for Future Development

### ✅ DO Use proxy.ts for:
- Authentication checks (JWT validation)
- Route protection and redirects
- Subdomain routing logic
- Adding request/response headers
- URL rewrites and redirects

### ❌ DON'T Use proxy.ts for:
- Complex business logic (use API routes instead)
- Database queries (use server components or API routes)
- Heavy computations (Edge Runtime has limitations)
- Features that can be achieved with other Next.js APIs

### Best Practices

1. **Keep it Lightweight**: Proxy runs on every request, so keep logic minimal
2. **Edge Runtime Aware**: Remember it runs at the Edge, not in your main region
3. **Cookie-Based Auth**: Use cookies for server-side authentication checks (localStorage not available)
4. **Clear Redirects**: Always preserve intended destination in redirect URLs
5. **Matcher Configuration**: Use the `config.matcher` to exclude static assets

## File Location

```
tynebase-frontend/
├── proxy.ts              ← Main proxy file (NEW CONVENTION)
├── lib/
│   └── supabase/
│       └── middleware.ts ← Supabase helper (not a proxy file)
```

**Note**: `lib/supabase/middleware.ts` is a helper function, not the Next.js proxy. It's named "middleware" as part of Supabase's API, not Next.js convention.

## Integration Tasks Using Proxy

All future integration tasks should reference `proxy.ts` instead of `middleware.ts`:

- **I2.4**: ✅ Implemented Protected Route Middleware (migrated to proxy)
- **I2.5**: Token Refresh Logic (will use proxy.ts)
- **I3.6**: Real-Time Collaboration (may need proxy updates)
- **I8.3**: CORS Configuration (backend, not proxy)

## References

- [Next.js Proxy Documentation](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)
- [Migration Guide](https://nextjs.org/docs/messages/middleware-to-proxy)
- [Upgrading to Next.js 16](https://nextjs.org/docs/app/guides/upgrading/version-16)

## Rollback (If Needed)

If you need to rollback to the old convention for compatibility:

```bash
# Rename file back
mv proxy.ts middleware.ts

# Update function name
# Change: export async function proxy(request: NextRequest)
# To:     export async function middleware(request: NextRequest)
```

**Note**: This is NOT recommended as Next.js is deprecating the middleware convention.

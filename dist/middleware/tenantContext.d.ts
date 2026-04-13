import { FastifyRequest, FastifyReply } from 'fastify';
interface TenantCacheEntry {
    id: string;
    subdomain: string;
    name: string;
    tier: string;
    settings: Record<string, any>;
    storage_limit: number | null;
    timestamp: number;
}
declare class LRUCache {
    private cache;
    private maxSize;
    private ttl;
    constructor(maxSize?: number, ttlMs?: number);
    get(key: string): TenantCacheEntry | undefined;
    set(key: string, value: TenantCacheEntry): void;
    invalidate(key: string): void;
    clear(): void;
}
declare const tenantCache: LRUCache;
/**
 * Tenant Context Middleware
 *
 * Resolves the tenant from the `x-tenant-subdomain` header and populates
 * `request.tenant`.  If the header is absent the middleware exits silently
 * so that `authMiddleware` can resolve the tenant from the user's profile.
 *
 * Special subdomains `www`, `main`, and `app` are treated as "no subdomain"
 * and skipped — these represent bare-domain access where the user should be
 * routed to their primary workspace.
 */
export declare function tenantContextMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<undefined>;
export { tenantCache };
//# sourceMappingURL=tenantContext.d.ts.map
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
    clear(): void;
}
declare const tenantCache: LRUCache;
export declare function tenantContextMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<undefined>;
export { tenantCache };
//# sourceMappingURL=tenantContext.d.ts.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tenantCache = void 0;
exports.tenantContextMiddleware = tenantContextMiddleware;
const supabase_1 = require("../lib/supabase");
class LRUCache {
    cache;
    maxSize;
    ttl;
    constructor(maxSize = 1000, ttlMs = 300000) {
        this.cache = new Map();
        this.maxSize = maxSize;
        this.ttl = ttlMs;
    }
    get(key) {
        const entry = this.cache.get(key);
        if (!entry)
            return undefined;
        if (Date.now() - entry.timestamp > this.ttl) {
            this.cache.delete(key);
            return undefined;
        }
        this.cache.delete(key);
        this.cache.set(key, entry);
        return entry;
    }
    set(key, value) {
        if (this.cache.has(key)) {
            this.cache.delete(key);
        }
        else if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey) {
                this.cache.delete(firstKey);
            }
        }
        this.cache.set(key, value);
    }
    clear() {
        this.cache.clear();
    }
}
const tenantCache = new LRUCache(1000, 300000);
exports.tenantCache = tenantCache;
function sanitizeSubdomain(subdomain) {
    return subdomain.toLowerCase().replace(/[^a-z0-9-]/g, '');
}
async function tenantContextMiddleware(request, reply) {
    const subdomainHeader = request.headers['x-tenant-subdomain'];
    // If no subdomain header is provided, skip tenant resolution here.
    // The authMiddleware will handle tenant resolution from the user's profile.
    // This allows endpoints to work on localhost without subdomain setup.
    if (!subdomainHeader) {
        request.log.debug('No x-tenant-subdomain header provided, skipping tenant context resolution');
        return;
    }
    const sanitizedSubdomain = sanitizeSubdomain(subdomainHeader);
    if (!sanitizedSubdomain || sanitizedSubdomain.length < 2) {
        return reply.status(400).send({
            error: {
                code: 'INVALID_SUBDOMAIN',
                message: 'Invalid subdomain format',
            },
        });
    }
    let tenant = tenantCache.get(sanitizedSubdomain);
    if (!tenant) {
        const { data, error } = await supabase_1.supabaseAdmin
            .from('tenants')
            .select('id, subdomain, name, tier, settings, storage_limit')
            .eq('subdomain', sanitizedSubdomain)
            .single();
        if (error || !data) {
            request.log.warn({ subdomain: sanitizedSubdomain, error }, 'Tenant not found');
            return reply.status(404).send({
                error: {
                    code: 'TENANT_NOT_FOUND',
                    message: 'Tenant not found',
                },
            });
        }
        tenant = {
            id: data.id,
            subdomain: data.subdomain,
            name: data.name,
            tier: data.tier,
            settings: data.settings || {},
            storage_limit: data.storage_limit,
            timestamp: Date.now(),
        };
        tenantCache.set(sanitizedSubdomain, tenant);
        request.log.info({ tenantId: tenant.id }, 'Tenant resolved and cached');
    }
    else {
        request.log.debug({ tenantId: tenant.id }, 'Tenant resolved from cache');
    }
    request.tenant = {
        id: tenant.id,
        subdomain: tenant.subdomain,
        name: tenant.name,
        tier: tenant.tier,
        settings: tenant.settings,
        storage_limit: tenant.storage_limit,
    };
}
//# sourceMappingURL=tenantContext.js.map
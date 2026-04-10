import { FastifyRequest, FastifyReply } from 'fastify';
import { supabaseAdmin } from '../lib/supabase';

interface TenantCacheEntry {
  id: string;
  subdomain: string;
  name: string;
  tier: string;
  settings: Record<string, any>;
  storage_limit: number | null;
  timestamp: number;
}

class LRUCache {
  private cache: Map<string, TenantCacheEntry>;
  private maxSize: number;
  private ttl: number;

  constructor(maxSize: number = 1000, ttlMs: number = 300000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttlMs;
  }

  get(key: string): TenantCacheEntry | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry;
  }

  set(key: string, value: TenantCacheEntry): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }
}

const tenantCache = new LRUCache(1000, 300000); // 5 min TTL

/**
 * Sanitize subdomain input to prevent injection.
 */
function sanitizeSubdomain(subdomain: string): string {
  return subdomain.toLowerCase().replace(/[^a-z0-9-]/g, '');
}

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
export async function tenantContextMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const subdomainHeader = request.headers['x-tenant-subdomain'] as string;

  // Skip tenant resolution if no header or it's a generic subdomain
  if (!subdomainHeader) {
    request.log.debug(
      'No x-tenant-subdomain header provided, skipping tenant context resolution'
    );
    return;
  }

  const sanitizedSubdomain = sanitizeSubdomain(subdomainHeader);

  // Skip generic/bare-domain subdomains
  if (
    !sanitizedSubdomain ||
    sanitizedSubdomain.length < 2 ||
    sanitizedSubdomain === 'www' ||
    sanitizedSubdomain === 'main' ||
    sanitizedSubdomain === 'app'
  ) {
    request.log.debug(
      { subdomain: sanitizedSubdomain },
      'Generic subdomain, skipping tenant resolution'
    );
    return;
  }

  // Check cache first
  let tenant = tenantCache.get(sanitizedSubdomain);

  if (!tenant) {
    const { data, error } = await supabaseAdmin
      .from('tenants')
      .select('id, subdomain, name, tier, settings, storage_limit')
      .eq('subdomain', sanitizedSubdomain)
      .single();

    if (error || !data) {
      request.log.warn(
        { subdomain: sanitizedSubdomain, error },
        'Tenant not found'
      );
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
    request.log.debug({ tenantId: tenant.id }, 'Tenant resolved and cached');
  } else {
    request.log.debug({ tenantId: tenant.id }, 'Tenant resolved from cache');
  }

  (request as any).tenant = {
    id: tenant.id,
    subdomain: tenant.subdomain,
    name: tenant.name,
    tier: tenant.tier,
    settings: tenant.settings,
    storage_limit: tenant.storage_limit,
  };
}

export { tenantCache };

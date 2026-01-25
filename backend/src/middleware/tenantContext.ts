import { FastifyRequest, FastifyReply } from 'fastify';
import { supabaseAdmin } from '../lib/supabase';

interface TenantCacheEntry {
  id: string;
  subdomain: string;
  name: string;
  tier: string;
  settings: Record<string, any>;
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

  clear(): void {
    this.cache.clear();
  }
}

const tenantCache = new LRUCache(1000, 300000);

function sanitizeSubdomain(subdomain: string): string {
  return subdomain.toLowerCase().replace(/[^a-z0-9-]/g, '');
}

export async function tenantContextMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const subdomainHeader = request.headers['x-tenant-subdomain'] as string;

  if (!subdomainHeader) {
    return reply.status(400).send({
      error: {
        code: 'MISSING_TENANT_HEADER',
        message: 'x-tenant-subdomain header is required',
      },
    });
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
    const { data, error } = await supabaseAdmin
      .from('tenants')
      .select('id, subdomain, name, tier, settings')
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
      timestamp: Date.now(),
    };

    tenantCache.set(sanitizedSubdomain, tenant);
    request.log.info({ tenantId: tenant.id }, 'Tenant resolved and cached');
  } else {
    request.log.debug({ tenantId: tenant.id }, 'Tenant resolved from cache');
  }

  (request as any).tenant = {
    id: tenant.id,
    subdomain: tenant.subdomain,
    name: tenant.name,
    tier: tenant.tier,
    settings: tenant.settings,
  };
}

export { tenantCache };

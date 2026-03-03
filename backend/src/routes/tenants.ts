import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase';
import { authMiddleware } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { writeAuditLog, getClientIp } from '../lib/auditLog';
import { addDomainToVercel, removeDomainFromVercel, getDomainConfig, isVercelConfigured } from '../lib/vercelDomains';

/**
 * Zod schema for tenant settings validation
 * Validates JSONB structure to prevent injection and ensure data integrity
 */
const settingsSchema = z.object({
  branding: z.object({
    logo_url: z.string().url().optional(),
    logo_dark_url: z.string().url().optional(),
    favicon_url: z.string().url().optional(),
    primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    secondary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    company_name: z.string().max(100).optional(),
  }).optional(),
  ai_preferences: z.object({
    default_provider: z.enum(['openai', 'anthropic', 'cohere']).optional(),
    default_model: z.string().max(50).optional(),
    temperature: z.number().min(0).max(2).optional(),
  }).optional(),
  notifications: z.object({
    email_enabled: z.boolean().optional(),
    digest_frequency: z.enum(['daily', 'weekly', 'never']).optional(),
  }).optional(),
  features: z.object({
    collaboration_enabled: z.boolean().optional(),
    ai_generation_enabled: z.boolean().optional(),
    rag_chat_enabled: z.boolean().optional(),
    document_export_enabled: z.boolean().optional(),
  }).optional(),
}).strict();

/**
 * Zod schema for PATCH /api/tenants/:id request body
 */
const updateTenantSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  custom_domain: z.string().max(253).regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/, 'Invalid domain format').optional().nullable(),
  settings: settingsSchema.optional(),
});

export default async function tenantRoutes(fastify: FastifyInstance) {
  /**
   * PATCH /api/tenants/:id
   * Updates tenant settings (name, branding, preferences)
   * 
   * Authorization:
   * - Requires valid JWT
   * - User must be admin role in the tenant
   * - User can only update their own tenant (unless super_admin)
   * 
   * Security:
   * - Validates JSONB structure with Zod schema
   * - Prevents SQL injection via parameterized queries
   * - Enforces strict schema validation on settings object
   * - Logs all update operations with user context
   */
  fastify.patch('/api/tenants/:id', {
    preHandler: authMiddleware,
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = (request as any).user;

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        return reply.code(400).send({
          error: {
            code: 'INVALID_TENANT_ID',
            message: 'Invalid tenant ID format',
            details: {},
          },
        });
      }

      // Validate request body
      const body = updateTenantSchema.parse(request.body);

      // Check if body is empty
      if (!body.name && !body.settings && body.custom_domain === undefined) {
        return reply.code(400).send({
          error: {
            code: 'EMPTY_UPDATE',
            message: 'At least one field must be provided for update',
            details: {},
          },
        });
      }

      // Authorization check: user must be admin of the tenant or super_admin
      if (!user.is_super_admin && user.tenant_id !== id) {
        fastify.log.warn(
          { userId: user.id, requestedTenantId: id, userTenantId: user.tenant_id },
          'Unauthorized tenant update attempt - tenant mismatch'
        );
        return reply.code(403).send({
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to update this tenant',
            details: {},
          },
        });
      }

      if (!user.is_super_admin && user.role !== 'admin') {
        fastify.log.warn(
          { userId: user.id, role: user.role, tenantId: id },
          'Unauthorized tenant update attempt - insufficient role'
        );
        return reply.code(403).send({
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Only admins can update tenant settings',
            details: {},
          },
        });
      }

      // Verify tenant exists
      const { data: existingTenant, error: fetchError } = await supabaseAdmin
        .from('tenants')
        .select('id, name, settings, tier, custom_domain')
        .eq('id', id)
        .single();

      if (fetchError || !existingTenant) {
        fastify.log.error({ error: fetchError, tenantId: id }, 'Tenant not found');
        return reply.code(404).send({
          error: {
            code: 'TENANT_NOT_FOUND',
            message: 'Tenant not found',
            details: {},
          },
        });
      }

      // Build update object
      const updateData: any = {};
      if (body.name !== undefined) {
        updateData.name = body.name;
      }
      if (body.custom_domain !== undefined) {
        // Check tier allows custom domain (pro or enterprise)
        const tier = existingTenant.tier || 'free';
        if (!user.is_super_admin && tier !== 'pro' && tier !== 'enterprise') {
          return reply.code(403).send({
            error: {
              code: 'TIER_RESTRICTION',
              message: 'Custom domains require Pro or Enterprise plan',
              details: {},
            },
          });
        }

        if (body.custom_domain === null || body.custom_domain === '') {
          // Remove custom domain — also remove from Vercel
          if (existingTenant.custom_domain && isVercelConfigured()) {
            const removeResult = await removeDomainFromVercel(existingTenant.custom_domain);
            fastify.log.info({ domain: existingTenant.custom_domain, result: removeResult }, 'Removed domain from Vercel');
          }
          updateData.custom_domain = null;
          updateData.custom_domain_verified = false;
        } else {
          // Check uniqueness
          const { data: existing } = await supabaseAdmin
            .from('tenants')
            .select('id')
            .eq('custom_domain', body.custom_domain)
            .neq('id', id)
            .single();

          if (existing) {
            return reply.code(409).send({
              error: {
                code: 'DOMAIN_TAKEN',
                message: 'This domain is already in use by another workspace',
                details: {},
              },
            });
          }

          // Auto-provision on Vercel
          if (isVercelConfigured()) {
            // Remove old domain if changing
            if (existingTenant.custom_domain && existingTenant.custom_domain !== body.custom_domain) {
              await removeDomainFromVercel(existingTenant.custom_domain);
            }
            const addResult = await addDomainToVercel(body.custom_domain);
            fastify.log.info({ domain: body.custom_domain, result: addResult }, 'Added domain to Vercel');

            if (addResult.error) {
              fastify.log.warn({ domain: body.custom_domain, error: addResult.error }, 'Vercel domain add warning');
              // Don't block save — domain is stored, Vercel provisioning can be retried
            }
          }

          updateData.custom_domain = body.custom_domain;
          updateData.custom_domain_verified = false; // Will be verified once DNS propagates
        }
      }
      if (body.settings !== undefined) {
        // Deep merge branding to preserve unmodified fields
        const existingSettings = existingTenant.settings || {};
        updateData.settings = { ...existingSettings };
        for (const [key, value] of Object.entries(body.settings)) {
          if (value && typeof value === 'object' && !Array.isArray(value)) {
            updateData.settings[key] = { ...(existingSettings[key] || {}), ...value };
          } else {
            updateData.settings[key] = value;
          }
        }
      }

      // Perform update
      const { data: updatedTenant, error: updateError } = await supabaseAdmin
        .from('tenants')
        .update(updateData)
        .eq('id', id)
        .select('id, subdomain, name, tier, settings, storage_limit, custom_domain, custom_domain_verified, created_at, updated_at')
        .single();

      if (updateError || !updatedTenant) {
        fastify.log.error({ error: updateError, tenantId: id }, 'Failed to update tenant');
        return reply.code(500).send({
          error: {
            code: 'UPDATE_FAILED',
            message: 'Failed to update tenant',
            details: {},
          },
        });
      }

      fastify.log.info(
        {
          userId: user.id,
          tenantId: id,
          updatedFields: Object.keys(updateData),
        },
        'Tenant updated successfully'
      );

      writeAuditLog({
        tenantId: id,
        actorId: user.id,
        action: 'settings.tenant_updated',
        actionType: 'settings',
        targetName: updatedTenant.name,
        ipAddress: getClientIp(request),
        metadata: { fields_updated: Object.keys(updateData) },
      });

      return reply.code(200).send({
        success: true,
        data: {
          tenant: updatedTenant,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input data',
            details: error.errors,
          },
        });
      }

      fastify.log.error({ error }, 'Unexpected error in PATCH /api/tenants/:id');
      return reply.code(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
          details: {},
        },
      });
    }
  });

  /**
   * GET /api/public/tenant-by-domain
   * Look up a tenant by custom domain (no auth required)
   * Returns tenant info + branding for white-label public docs pages
   */
  fastify.get('/api/public/tenant-by-domain', {
    preHandler: [rateLimitMiddleware],
  }, async (request, reply) => {
    try {
      const { domain } = request.query as { domain?: string };

      if (!domain) {
        return reply.code(400).send({
          error: { code: 'MISSING_DOMAIN', message: 'domain query parameter is required' },
        });
      }

      const sanitized = domain.toLowerCase().trim();

      const { data: tenant, error } = await supabaseAdmin
        .from('tenants')
        .select('id, subdomain, name, tier, settings, custom_domain, custom_domain_verified')
        .eq('custom_domain', sanitized)
        .single();

      if (error || !tenant) {
        return reply.code(404).send({
          error: { code: 'TENANT_NOT_FOUND', message: 'No workspace found for this domain' },
        });
      }

      return reply.code(200).send({
        success: true,
        data: {
          tenant: {
            id: tenant.id,
            subdomain: tenant.subdomain,
            name: tenant.name,
            custom_domain: tenant.custom_domain,
            custom_domain_verified: tenant.custom_domain_verified,
            branding: tenant.settings?.branding || {},
          },
        },
      });
    } catch (error) {
      fastify.log.error({ error }, 'Error in GET /api/public/tenant-by-domain');
      return reply.code(500).send({
        error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
      });
    }
  });

  /**
   * POST /api/tenants/:id/verify-domain
   * Verify custom domain — checks Vercel config status (preferred) or falls back to DNS
   */
  fastify.post('/api/tenants/:id/verify-domain', {
    preHandler: authMiddleware,
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = (request as any).user;

      if (!user.is_super_admin && user.tenant_id !== id) {
        return reply.code(403).send({
          error: { code: 'FORBIDDEN', message: 'Cannot verify domain for another tenant' },
        });
      }
      if (!user.is_super_admin && user.role !== 'admin') {
        return reply.code(403).send({
          error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Only admins can verify domains' },
        });
      }

      const { data: tenant, error: fetchError } = await supabaseAdmin
        .from('tenants')
        .select('id, custom_domain, custom_domain_verified')
        .eq('id', id)
        .single();

      if (fetchError || !tenant || !tenant.custom_domain) {
        return reply.code(400).send({
          error: { code: 'NO_CUSTOM_DOMAIN', message: 'No custom domain configured for this workspace' },
        });
      }

      if (tenant.custom_domain_verified) {
        return reply.code(200).send({
          success: true,
          data: { verified: true, configured: true, domain: tenant.custom_domain, message: 'Domain is verified and active' },
        });
      }

      let verified = false;
      let configured = false;
      let message = '';

      if (isVercelConfigured()) {
        // Use Vercel API for comprehensive status
        const config = await getDomainConfig(tenant.custom_domain);
        verified = config.configured;
        configured = config.configured;

        if (config.error === 'Domain not found on Vercel project') {
          // Domain was saved but not added to Vercel — try adding now
          const addResult = await addDomainToVercel(tenant.custom_domain);
          fastify.log.info({ domain: tenant.custom_domain, result: addResult }, 'Re-added domain to Vercel during verify');
          message = 'Domain added to Vercel. Point your CNAME to cname.vercel-dns.com and check again in a few minutes.';
        } else if (!configured) {
          message = 'DNS not yet pointing to Vercel. Add a CNAME record pointing to cname.vercel-dns.com — it can take up to 24h to propagate.';
        } else {
          message = 'Domain verified and active! SSL certificate has been provisioned automatically.';
        }
      } else {
        // Fallback: direct DNS check
        try {
          const dns = await import('dns/promises');
          const records = await dns.resolveCname(tenant.custom_domain);
          verified = records.some((r: string) =>
            r.endsWith('.vercel-dns.com') ||
            r.endsWith('.vercel.app') ||
            r === 'app.tynebase.com'
          );
        } catch {
          verified = false;
        }
        message = verified
          ? 'Domain verified successfully'
          : 'CNAME not found. Point your domain to cname.vercel-dns.com';
      }

      if (verified) {
        await supabaseAdmin
          .from('tenants')
          .update({ custom_domain_verified: true })
          .eq('id', id);
      }

      return reply.code(200).send({
        success: true,
        data: { verified, configured, domain: tenant.custom_domain, message },
      });
    } catch (error) {
      fastify.log.error({ error }, 'Error verifying domain');
      return reply.code(500).send({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to verify domain' },
      });
    }
  });

  /**
   * GET /api/public/tenant/:subdomain
   * Get public tenant info by subdomain (no auth, for branded pages)
   */
  fastify.get('/api/public/tenant/:subdomain', {
    preHandler: [rateLimitMiddleware],
  }, async (request, reply) => {
    try {
      const { subdomain } = request.params as { subdomain: string };

      const { data: tenant, error } = await supabaseAdmin
        .from('tenants')
        .select('id, subdomain, name, tier, settings, custom_domain, custom_domain_verified')
        .eq('subdomain', subdomain.toLowerCase())
        .single();

      if (error || !tenant) {
        return reply.code(404).send({
          error: { code: 'TENANT_NOT_FOUND', message: 'Workspace not found' },
        });
      }

      return reply.code(200).send({
        success: true,
        data: {
          tenant: {
            id: tenant.id,
            subdomain: tenant.subdomain,
            name: tenant.name,
            custom_domain: tenant.custom_domain,
            branding: tenant.settings?.branding || {},
          },
        },
      });
    } catch (error) {
      fastify.log.error({ error }, 'Error in GET /api/public/tenant/:subdomain');
      return reply.code(500).send({
        error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
      });
    }
  });
}

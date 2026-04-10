import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase';
import { authMiddleware } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { writeAuditLog, getClientIp } from '../lib/auditLog';

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
      if (!body.name && !body.settings) {
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
        .select('id, name, settings')
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
        .select('id, subdomain, name, tier, settings, storage_limit, created_at, updated_at')
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
   * Resolves a tenant by its subdomain or verified custom domain.
   */
  fastify.get('/api/public/tenant-by-domain', {
    preHandler: [rateLimitMiddleware],
  }, async (request, reply) => {
    try {
      const { domain } = request.query as { domain: string };

      if (!domain) {
        return reply.code(400).send({
          error: { code: 'MISSING_DOMAIN', message: 'Domain query parameter is required' },
        });
      }

      // 1. Determine if it's a subdomain or a custom domain
      const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || 'tynebase.com';
      let tenant;

      if (domain.toLowerCase().endsWith(`.${baseDomain}`)) {
        // Subdomain case: ennersmai.tynebase.com
        const subdomain = domain.slice(0, -(baseDomain.length + 1)).toLowerCase();
        
        // Skip for reserved/main subdomains
        if (['www', 'api', 'app', 'admin'].includes(subdomain)) {
           return reply.code(404).send({
             error: { code: 'TENANT_NOT_FOUND', message: 'Primary domain used' },
           });
        }

        const { data, error } = await supabaseAdmin
          .from('tenants')
          .select('id, subdomain, name, tier, settings')
          .eq('subdomain', subdomain)
          .single();
        
        tenant = data;
        if (error || !data) {
          return reply.code(404).send({
            error: { code: 'TENANT_NOT_FOUND', message: 'Workspace not found for this subdomain' },
          });
        }
      } else {
        // Custom domain case: docs.acme.com
        const { data, error } = await supabaseAdmin
          .from('tenants')
          .select('id, subdomain, name, tier, settings')
          .eq('custom_domain', domain.toLowerCase())
          .eq('custom_domain_verified', true)
          .single();
        
        tenant = data;
        if (error || !data) {
          return reply.code(404).send({
            error: { code: 'TENANT_NOT_FOUND', message: 'Workspace not found for this custom domain' },
          });
        }
      }

      if (!tenant) {
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
        .select('id, subdomain, name, tier, settings')
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

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase';
import { authMiddleware } from '../middleware/auth';

/**
 * Zod schema for tenant settings validation
 * Validates JSONB structure to prevent injection and ensure data integrity
 */
const settingsSchema = z.object({
  branding: z.object({
    logo_url: z.string().url().optional(),
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
}).strict();

/**
 * Zod schema for PATCH /api/tenants/:id request body
 */
const updateTenantSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  settings: settingsSchema.optional(),
}).strict();

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
        // Merge with existing settings to preserve unmodified fields
        updateData.settings = {
          ...(existingTenant.settings || {}),
          ...body.settings,
        };
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
}

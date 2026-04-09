import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth';
import { superAdminGuard } from '../middleware/superAdminGuard';
import { supabaseAdmin } from '../lib/supabase';
import { z } from 'zod';

/**
 * Tenant ID Parameter Schema
 */
const paramsSchema = z.object({
  tenantId: z.string().uuid(),
});

/**
 * Super Admin Tenant Suspension Routes
 * 
 * Allows super admins to suspend/unsuspend tenants
 */
export default async function superAdminSuspendRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/superadmin/tenants/:tenantId/suspend
   * 
   * Suspends a tenant, blocking all API access for users of that tenant.
   * 
   * Security:
   * - Super admin only
   * - Logs suspension events for audit trail
   * - Validates tenant exists before suspension
   * 
   * @param tenantId - UUID of tenant to suspend
   * @returns Success confirmation with updated tenant data
   */
  fastify.post(
    '/api/superadmin/tenants/:tenantId/suspend',
    {
      preHandler: [authMiddleware, superAdminGuard],
    },
    async (request, reply) => {
      try {
        const params = paramsSchema.parse(request.params);
        const { tenantId } = params;

        const superAdminId = request.user?.id;
        const superAdminEmail = request.user?.email;

        // Verify tenant exists
        const { data: tenant, error: tenantError } = await supabaseAdmin
          .from('tenants')
          .select('id, subdomain, name, tier, status')
          .eq('id', tenantId)
          .single();

        if (tenantError || !tenant) {
          request.log.warn(
            {
              superAdminId,
              tenantId,
              error: tenantError,
            },
            'Tenant not found for suspension'
          );
          return reply.status(404).send({
            error: {
              code: 'TENANT_NOT_FOUND',
              message: 'Tenant not found',
            },
          });
        }

        // Check if already archived
        if (tenant.status === 'archived') {
          request.log.info(
            {
              superAdminId,
              tenantId,
              tenantSubdomain: tenant.subdomain,
            },
            'Tenant already archived'
          );
          return {
            success: true,
            data: {
              tenant: {
                id: tenant.id,
                subdomain: tenant.subdomain,
                name: tenant.name,
                tier: tenant.tier,
                status: tenant.status,
              },
              message: 'Tenant is already archived',
            },
          };
        }

        // Update tenant status to archived
        const { data: updatedTenant, error: updateError } = await supabaseAdmin
          .from('tenants')
          .update({ status: 'archived' })
          .eq('id', tenantId)
          .select('id, subdomain, name, tier, status')
          .single();

        if (updateError || !updatedTenant) {
          request.log.error(
            {
              superAdminId,
              tenantId,
              error: updateError,
            },
            'Failed to archive tenant'
          );
          return reply.status(500).send({
            error: {
              code: 'ARCHIVE_FAILED',
              message: 'Failed to archive tenant',
            },
          });
        }

        // Log suspension event for audit trail
        request.log.warn(
          {
            superAdminId,
            superAdminEmail,
            tenantId,
            tenantSubdomain: tenant.subdomain,
            tenantName: tenant.name,
            previousStatus: tenant.status,
            newStatus: 'archived',
          },
          'Tenant archived by super admin'
        );

        return {
          success: true,
          data: {
            tenant: {
              id: updatedTenant.id,
              subdomain: updatedTenant.subdomain,
              name: updatedTenant.name,
              tier: updatedTenant.tier,
              status: updatedTenant.status,
            },
            message: 'Tenant archived successfully',
          },
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: {
              code: 'INVALID_TENANT_ID',
              message: 'Invalid tenant ID format',
              details: error.errors,
            },
          });
        }

        request.log.error({ error }, 'Error archiving tenant');
        return reply.status(500).send({
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to archive tenant',
          },
        });
      }
    }
  );

  /**
   * POST /api/superadmin/tenants/:tenantId/unsuspend
   * 
   * Unsuspends a tenant, restoring API access for users of that tenant.
   * 
   * Security:
   * - Super admin only
   * - Logs unsuspension events for audit trail
   * - Validates tenant exists before unsuspension
   * 
   * @param tenantId - UUID of tenant to unsuspend
   * @returns Success confirmation with updated tenant data
   */
  fastify.post(
    '/api/superadmin/tenants/:tenantId/unsuspend',
    {
      preHandler: [authMiddleware, superAdminGuard],
    },
    async (request, reply) => {
      try {
        const params = paramsSchema.parse(request.params);
        const { tenantId } = params;

        const superAdminId = request.user?.id;
        const superAdminEmail = request.user?.email;

        // Verify tenant exists
        const { data: tenant, error: tenantError } = await supabaseAdmin
          .from('tenants')
          .select('id, subdomain, name, tier, status')
          .eq('id', tenantId)
          .single();

        if (tenantError || !tenant) {
          request.log.warn(
            {
              superAdminId,
              tenantId,
              error: tenantError,
            },
            'Tenant not found for unsuspension'
          );
          return reply.status(404).send({
            error: {
              code: 'TENANT_NOT_FOUND',
              message: 'Tenant not found',
            },
          });
        }

        // Check if already active
        if (tenant.status === 'active') {
          request.log.info(
            {
              superAdminId,
              tenantId,
              tenantSubdomain: tenant.subdomain,
            },
            'Tenant already active'
          );
          return {
            success: true,
            data: {
              tenant: {
                id: tenant.id,
                subdomain: tenant.subdomain,
                name: tenant.name,
                tier: tenant.tier,
                status: tenant.status,
              },
              message: 'Tenant is already active',
            },
          };
        }

        // Update tenant status to active
        const { data: updatedTenant, error: updateError } = await supabaseAdmin
          .from('tenants')
          .update({ status: 'active' })
          .eq('id', tenantId)
          .select('id, subdomain, name, tier, status')
          .single();

        if (updateError || !updatedTenant) {
          request.log.error(
            {
              superAdminId,
              tenantId,
              error: updateError,
            },
            'Failed to reactivate tenant'
          );
          return reply.status(500).send({
            error: {
              code: 'REACTIVATION_FAILED',
              message: 'Failed to reactivate tenant',
            },
          });
        }

        // Log unsuspension event for audit trail
        request.log.warn(
          {
            superAdminId,
            superAdminEmail,
            tenantId,
            tenantSubdomain: tenant.subdomain,
            tenantName: tenant.name,
            previousStatus: tenant.status,
            newStatus: 'active',
          },
          'Tenant reactivated by super admin'
        );

        return {
          success: true,
          data: {
            tenant: {
              id: updatedTenant.id,
              subdomain: updatedTenant.subdomain,
              name: updatedTenant.name,
              tier: updatedTenant.tier,
              status: updatedTenant.status,
            },
            message: 'Tenant reactivated successfully',
          },
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: {
              code: 'INVALID_TENANT_ID',
              message: 'Invalid tenant ID format',
              details: error.errors,
            },
          });
        }

        request.log.error({ error }, 'Error reactivating tenant');
        return reply.status(500).send({
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to reactivate tenant',
          },
        });
      }
    }
  );
}

import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth';
import { superAdminGuard } from '../middleware/superAdminGuard';
import { supabaseAdmin } from '../lib/supabase';
import { z } from 'zod';

/**
 * Tier credit allocations based on pricing model
 */
const TIER_CREDITS: Record<string, number> = {
  free: 10,
  base: 100,
  pro: 500,
  enterprise: 1000, // Default for enterprise, can be customized
};

/**
 * Request body schema for tier change
 */
const changeTierBodySchema = z.object({
  tier: z.enum(['free', 'base', 'pro', 'enterprise']),
  customCredits: z.number().int().positive().optional(),
});

/**
 * Tenant ID Parameter Schema
 */
const paramsSchema = z.object({
  tenantId: z.string().uuid(),
});

/**
 * Super Admin Change Tier Routes
 * 
 * Allows super admins to change tenant subscription tier and recalculate credits
 */
export default async function superAdminChangeTierRoutes(fastify: FastifyInstance) {
  /**
   * PATCH /api/superadmin/tenants/:tenantId/tier
   * 
   * Changes a tenant's subscription tier and recalculates credit pool allocations.
   * 
   * Security:
   * - Super admin only
   * - Validates tier value
   * - Prevents downgrade if tenant has overdrawn credits
   * - Logs tier changes for audit trail
   * 
   * @param tenantId - UUID of tenant to update
   * @param tier - New tier (free, base, pro, enterprise)
   * @param customCredits - Optional custom credit amount (enterprise only)
   * @returns Success confirmation with updated tenant and credit data
   */
  fastify.patch(
    '/api/superadmin/tenants/:tenantId/tier',
    {
      preHandler: [authMiddleware, superAdminGuard],
    },
    async (request, reply) => {
      try {
        const params = paramsSchema.parse(request.params);
        const body = changeTierBodySchema.parse(request.body);
        const { tenantId } = params;
        const { tier, customCredits } = body;

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
            'Tenant not found for tier change'
          );
          return reply.status(404).send({
            error: {
              code: 'TENANT_NOT_FOUND',
              message: 'Tenant not found',
            },
          });
        }

        // Check if tier is already set
        if (tenant.tier === tier) {
          request.log.info(
            {
              superAdminId,
              tenantId,
              tenantSubdomain: tenant.subdomain,
              tier,
            },
            'Tenant already on requested tier'
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
              message: 'Tenant is already on this tier',
            },
          };
        }

        // Determine new credit allocation
        let newTotalCredits: number;
        if (tier === 'enterprise' && customCredits) {
          newTotalCredits = customCredits;
        } else {
          newTotalCredits = TIER_CREDITS[tier];
        }

        // Get current month-year
        const now = new Date();
        const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        // Get current credit pool for this month
        const { data: currentPool, error: poolError } = await supabaseAdmin
          .from('credit_pools')
          .select('id, total_credits, used_credits')
          .eq('tenant_id', tenantId)
          .eq('month_year', monthYear)
          .single();

        // Check if downgrade would cause overdraft
        if (currentPool && !poolError) {
          const currentUsed = currentPool.used_credits || 0;
          
          if (currentUsed > newTotalCredits) {
            request.log.warn(
              {
                superAdminId,
                tenantId,
                tenantSubdomain: tenant.subdomain,
                currentTier: tenant.tier,
                newTier: tier,
                currentUsed,
                newTotalCredits,
              },
              'Tier downgrade blocked: tenant has overdrawn credits'
            );
            return reply.status(400).send({
              error: {
                code: 'OVERDRAFT_PREVENTION',
                message: `Cannot downgrade tier: tenant has already used ${currentUsed} credits this month, which exceeds the ${tier} tier limit of ${newTotalCredits} credits`,
                details: {
                  currentUsed,
                  newLimit: newTotalCredits,
                  overage: currentUsed - newTotalCredits,
                },
              },
            });
          }
        }

        // Update tenant tier
        const { data: updatedTenant, error: updateError } = await supabaseAdmin
          .from('tenants')
          .update({ tier })
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
            'Failed to update tenant tier'
          );
          return reply.status(500).send({
            error: {
              code: 'TIER_UPDATE_FAILED',
              message: 'Failed to update tenant tier',
            },
          });
        }

        // Update or create credit pool for current month
        let updatedPool;
        if (currentPool && !poolError) {
          // Update existing pool
          const { data: pool, error: updatePoolError } = await supabaseAdmin
            .from('credit_pools')
            .update({ total_credits: newTotalCredits })
            .eq('id', currentPool.id)
            .select('id, tenant_id, month_year, total_credits, used_credits')
            .single();

          if (updatePoolError || !pool) {
            request.log.error(
              {
                superAdminId,
                tenantId,
                poolId: currentPool.id,
                error: updatePoolError,
              },
              'Failed to update credit pool'
            );
            return reply.status(500).send({
              error: {
                code: 'CREDIT_POOL_UPDATE_FAILED',
                message: 'Tenant tier updated but failed to update credit pool',
              },
            });
          }
          updatedPool = pool;
        } else {
          // Create new pool for current month
          const { data: pool, error: createPoolError } = await supabaseAdmin
            .from('credit_pools')
            .insert({
              tenant_id: tenantId,
              month_year: monthYear,
              total_credits: newTotalCredits,
              used_credits: 0,
            })
            .select('id, tenant_id, month_year, total_credits, used_credits')
            .single();

          if (createPoolError || !pool) {
            request.log.error(
              {
                superAdminId,
                tenantId,
                error: createPoolError,
              },
              'Failed to create credit pool'
            );
            return reply.status(500).send({
              error: {
                code: 'CREDIT_POOL_CREATE_FAILED',
                message: 'Tenant tier updated but failed to create credit pool',
              },
            });
          }
          updatedPool = pool;
        }

        // Log tier change event for audit trail
        request.log.warn(
          {
            superAdminId,
            superAdminEmail,
            tenantId,
            tenantSubdomain: tenant.subdomain,
            tenantName: tenant.name,
            previousTier: tenant.tier,
            newTier: tier,
            previousCredits: currentPool?.total_credits || 0,
            newCredits: newTotalCredits,
            monthYear,
          },
          'Tenant tier changed by super admin'
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
            creditPool: {
              monthYear: updatedPool.month_year,
              totalCredits: updatedPool.total_credits,
              usedCredits: updatedPool.used_credits,
              remainingCredits: updatedPool.total_credits - updatedPool.used_credits,
            },
            message: `Tenant tier changed from ${tenant.tier} to ${tier} successfully`,
          },
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: {
              code: 'INVALID_REQUEST',
              message: 'Invalid request parameters',
              details: error.errors,
            },
          });
        }

        request.log.error({ error }, 'Error changing tenant tier');
        return reply.status(500).send({
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to change tenant tier',
          },
        });
      }
    }
  );
}

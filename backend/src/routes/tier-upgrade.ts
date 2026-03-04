import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase';
import { tenantContextMiddleware } from '../middleware/tenantContext';
import { authMiddleware } from '../middleware/auth';
import { membershipGuard } from '../middleware/membershipGuard';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { writeAuditLog, getClientIp } from '../lib/auditLog';

const VALID_TIERS = ['free', 'base', 'pro', 'enterprise'] as const;

const upgradeSchema = z.object({
  target_tier: z.enum(VALID_TIERS),
});

/**
 * Mock tier upgrade route.
 * Allows upgrading a tenant's tier without real payment processing.
 * In production this would integrate with Stripe or similar.
 */
export default async function tierUpgradeRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/tenants/upgrade
   * Mock upgrade - changes the tenant tier immediately.
   * Only admins can upgrade.
   */
  fastify.post(
    '/api/tenants/upgrade',
    {
      preHandler: [rateLimitMiddleware, tenantContextMiddleware, authMiddleware, membershipGuard],
    },
    async (request, reply) => {
      try {
        const tenant = (request as any).tenant;
        const user = (request as any).user;

        // Only admins can upgrade
        if (user.role !== 'admin' && !user.is_super_admin) {
          return reply.code(403).send({
            error: { code: 'FORBIDDEN', message: 'Only admins can upgrade the plan' },
          });
        }

        const body = upgradeSchema.parse(request.body);
        const { target_tier } = body;

        // Prevent downgrade via this endpoint (only upgrade or same)
        const tierOrder: Record<string, number> = { free: 0, base: 1, pro: 2, enterprise: 3 };
        const currentOrder = tierOrder[tenant.tier] ?? 0;
        const targetOrder = tierOrder[target_tier] ?? 0;

        if (targetOrder < currentOrder) {
          return reply.code(400).send({
            error: { code: 'DOWNGRADE_NOT_ALLOWED', message: 'Use the billing page to downgrade' },
          });
        }

        if (target_tier === tenant.tier) {
          return reply.code(400).send({
            error: { code: 'SAME_TIER', message: `Already on the ${target_tier} plan` },
          });
        }

        // Perform the upgrade
        const { data: updatedTenant, error: updateError } = await supabaseAdmin
          .from('tenants')
          .update({ tier: target_tier })
          .eq('id', tenant.id)
          .select('id, subdomain, name, tier, settings')
          .single();

        if (updateError || !updatedTenant) {
          fastify.log.error({ error: updateError }, 'Failed to upgrade tenant tier');
          return reply.code(500).send({
            error: { code: 'UPGRADE_FAILED', message: 'Failed to upgrade plan' },
          });
        }

        fastify.log.info(
          { tenantId: tenant.id, from: tenant.tier, to: target_tier, userId: user.id },
          'Tenant tier upgraded (mock)'
        );

        writeAuditLog({
          tenantId: tenant.id,
          actorId: user.id,
          action: 'settings.tier_upgraded',
          actionType: 'settings',
          targetName: `${tenant.tier} → ${target_tier}`,
          ipAddress: getClientIp(request),
          metadata: { from_tier: tenant.tier, to_tier: target_tier, mock: true },
        });

        return reply.code(200).send({
          success: true,
          data: {
            message: `Successfully upgraded to ${target_tier}`,
            tenant: updatedTenant,
          },
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: error.errors },
          });
        }
        fastify.log.error({ error }, 'Unexpected error in POST /api/tenants/upgrade');
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
        });
      }
    }
  );
}

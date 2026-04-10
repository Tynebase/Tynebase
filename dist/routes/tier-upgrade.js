"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = tierUpgradeRoutes;
const zod_1 = require("zod");
const supabase_1 = require("../lib/supabase");
const tenantContext_1 = require("../middleware/tenantContext");
const auth_1 = require("../middleware/auth");
const membershipGuard_1 = require("../middleware/membershipGuard");
const rateLimit_1 = require("../middleware/rateLimit");
const auditLog_1 = require("../lib/auditLog");
const VALID_TIERS = ['free', 'base', 'pro', 'enterprise'];
const upgradeSchema = zod_1.z.object({
    target_tier: zod_1.z.enum(VALID_TIERS),
});
/**
 * Mock tier upgrade route.
 * Allows upgrading a tenant's tier without real payment processing.
 * In production this would integrate with Stripe or similar.
 */
async function tierUpgradeRoutes(fastify) {
    /**
     * POST /api/tenants/upgrade
     * Mock upgrade - changes the tenant tier immediately.
     * Only admins can upgrade.
     */
    fastify.post('/api/tenants/upgrade', {
        preHandler: [rateLimit_1.rateLimitMiddleware, tenantContext_1.tenantContextMiddleware, auth_1.authMiddleware, membershipGuard_1.membershipGuard],
    }, async (request, reply) => {
        try {
            const tenant = request.tenant;
            const user = request.user;
            // Only admins can upgrade
            if (user.role !== 'admin' && !user.is_super_admin) {
                return reply.code(403).send({
                    error: { code: 'FORBIDDEN', message: 'Only admins can upgrade the plan' },
                });
            }
            const body = upgradeSchema.parse(request.body);
            const { target_tier } = body;
            // Prevent downgrade via this endpoint (only upgrade or same)
            const tierOrder = { free: 0, base: 1, pro: 2, enterprise: 3 };
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
            const { data: updatedTenant, error: updateError } = await supabase_1.supabaseAdmin
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
            fastify.log.info({ tenantId: tenant.id, from: tenant.tier, to: target_tier, userId: user.id }, 'Tenant tier upgraded (mock)');
            (0, auditLog_1.writeAuditLog)({
                tenantId: tenant.id,
                actorId: user.id,
                action: 'settings.tier_upgraded',
                actionType: 'settings',
                targetName: `${tenant.tier} → ${target_tier}`,
                ipAddress: (0, auditLog_1.getClientIp)(request),
                metadata: { from_tier: tenant.tier, to_tier: target_tier, mock: true },
            });
            return reply.code(200).send({
                success: true,
                data: {
                    message: `Successfully upgraded to ${target_tier}`,
                    tenant: updatedTenant,
                },
            });
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return reply.code(400).send({
                    error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: error.errors },
                });
            }
            fastify.log.error({ error }, 'Unexpected error in POST /api/tenants/upgrade');
            return reply.code(500).send({
                error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
            });
        }
    });
}
//# sourceMappingURL=tier-upgrade.js.map
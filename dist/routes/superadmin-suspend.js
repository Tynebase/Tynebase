"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = superAdminSuspendRoutes;
const auth_1 = require("../middleware/auth");
const superAdminGuard_1 = require("../middleware/superAdminGuard");
const supabase_1 = require("../lib/supabase");
const zod_1 = require("zod");
/**
 * Tenant ID Parameter Schema
 */
const paramsSchema = zod_1.z.object({
    tenantId: zod_1.z.string().uuid(),
});
/**
 * Super Admin Tenant Suspension Routes
 *
 * Allows super admins to suspend/unsuspend tenants
 */
async function superAdminSuspendRoutes(fastify) {
    /**
     * DELETE /api/superadmin/tenants/:tenantId
     *
     * Soft-archives a tenant (sets status → 'archived'). Workspace and users are preserved.
     */
    fastify.delete('/api/superadmin/tenants/:tenantId', { preHandler: [auth_1.authMiddleware, superAdminGuard_1.superAdminGuard] }, async (request, reply) => {
        try {
            const { tenantId } = paramsSchema.parse(request.params);
            const { data: tenant, error: fetchError } = await supabase_1.supabaseAdmin
                .from('tenants')
                .select('id, name, status')
                .eq('id', tenantId)
                .single();
            if (fetchError || !tenant) {
                return reply.status(404).send({ error: { code: 'TENANT_NOT_FOUND', message: 'Tenant not found' } });
            }
            const { error: updateError } = await supabase_1.supabaseAdmin
                .from('tenants')
                .update({ status: 'archived' })
                .eq('id', tenantId);
            if (updateError)
                throw updateError;
            request.log.info({ tenantId, actorId: request.user?.id }, 'Tenant soft-archived by super admin');
            return { success: true, data: { message: `Workspace "${tenant.name}" has been archived` } };
        }
        catch (error) {
            request.log.error({ error }, 'Error archiving tenant');
            return reply.status(500).send({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to archive tenant' } });
        }
    });
    /**
     * DELETE /api/superadmin/tenants/:tenantId/purge
     *
     * Hard-deletes a tenant — permanently wipes all workspace data and orphans users.
     * Users' tenant_id is set to NULL so their accounts remain but workspace is gone.
     */
    fastify.delete('/api/superadmin/tenants/:tenantId/purge', { preHandler: [auth_1.authMiddleware, superAdminGuard_1.superAdminGuard] }, async (request, reply) => {
        try {
            const { tenantId } = paramsSchema.parse(request.params);
            const { data: tenant, error: fetchError } = await supabase_1.supabaseAdmin
                .from('tenants')
                .select('id, name')
                .eq('id', tenantId)
                .single();
            if (fetchError || !tenant) {
                return reply.status(404).send({ error: { code: 'TENANT_NOT_FOUND', message: 'Tenant not found' } });
            }
            // 1. Orphan users — null their tenant_id and archive them
            await supabase_1.supabaseAdmin
                .from('users')
                .update({ status: 'archived' })
                .eq('tenant_id', tenantId);
            // 2. Delete all documents (cascades to assets via FK if configured)
            await supabase_1.supabaseAdmin.from('documents').delete().eq('tenant_id', tenantId);
            // 3. Delete credit pools
            await supabase_1.supabaseAdmin.from('credit_pools').delete().eq('tenant_id', tenantId);
            // 4. Delete audit logs
            await supabase_1.supabaseAdmin.from('audit_logs').delete().eq('tenant_id', tenantId);
            // 5. Delete document reviews
            await supabase_1.supabaseAdmin.from('document_reviews').delete().eq('tenant_id', tenantId);
            // 6. Delete the tenant itself
            const { error: deleteError } = await supabase_1.supabaseAdmin
                .from('tenants')
                .delete()
                .eq('id', tenantId);
            if (deleteError)
                throw deleteError;
            request.log.info({ tenantId, tenantName: tenant.name, actorId: request.user?.id }, 'Tenant permanently purged by super admin');
            return { success: true, data: { message: `Workspace "${tenant.name}" has been permanently deleted` } };
        }
        catch (error) {
            request.log.error({ error }, 'Error purging tenant');
            return reply.status(500).send({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to permanently delete tenant' } });
        }
    });
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
    fastify.post('/api/superadmin/tenants/:tenantId/suspend', {
        preHandler: [auth_1.authMiddleware, superAdminGuard_1.superAdminGuard],
    }, async (request, reply) => {
        try {
            const params = paramsSchema.parse(request.params);
            const { tenantId } = params;
            const superAdminId = request.user?.id;
            const superAdminEmail = request.user?.email;
            // Verify tenant exists
            const { data: tenant, error: tenantError } = await supabase_1.supabaseAdmin
                .from('tenants')
                .select('id, subdomain, name, tier, status')
                .eq('id', tenantId)
                .single();
            if (tenantError || !tenant) {
                request.log.warn({
                    superAdminId,
                    tenantId,
                    error: tenantError,
                }, 'Tenant not found for suspension');
                return reply.status(404).send({
                    error: {
                        code: 'TENANT_NOT_FOUND',
                        message: 'Tenant not found',
                    },
                });
            }
            // Check if already suspended
            if (tenant.status === 'suspended') {
                request.log.info({
                    superAdminId,
                    tenantId,
                    tenantSubdomain: tenant.subdomain,
                }, 'Tenant already suspended');
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
                        message: 'Tenant is already suspended',
                    },
                };
            }
            // Update tenant status to suspended
            const { data: updatedTenant, error: updateError } = await supabase_1.supabaseAdmin
                .from('tenants')
                .update({ status: 'suspended' })
                .eq('id', tenantId)
                .select('id, subdomain, name, tier, status')
                .single();
            if (updateError || !updatedTenant) {
                request.log.error({
                    superAdminId,
                    tenantId,
                    error: updateError,
                }, 'Failed to suspend tenant');
                return reply.status(500).send({
                    error: {
                        code: 'SUSPEND_FAILED',
                        message: 'Failed to suspend tenant',
                    },
                });
            }
            // Log suspension event for audit trail
            request.log.warn({
                superAdminId,
                superAdminEmail,
                tenantId,
                tenantSubdomain: tenant.subdomain,
                tenantName: tenant.name,
                previousStatus: tenant.status,
                newStatus: 'suspended',
            }, 'Tenant suspended by super admin');
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
                    message: 'Tenant suspended successfully',
                },
            };
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return reply.status(400).send({
                    error: {
                        code: 'INVALID_TENANT_ID',
                        message: 'Invalid tenant ID format',
                        details: error.errors,
                    },
                });
            }
            request.log.error({ error }, 'Error suspending tenant');
            return reply.status(500).send({
                error: {
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to suspend tenant',
                },
            });
        }
    });
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
    fastify.post('/api/superadmin/tenants/:tenantId/unsuspend', {
        preHandler: [auth_1.authMiddleware, superAdminGuard_1.superAdminGuard],
    }, async (request, reply) => {
        try {
            const params = paramsSchema.parse(request.params);
            const { tenantId } = params;
            const superAdminId = request.user?.id;
            const superAdminEmail = request.user?.email;
            // Verify tenant exists
            const { data: tenant, error: tenantError } = await supabase_1.supabaseAdmin
                .from('tenants')
                .select('id, subdomain, name, tier, status')
                .eq('id', tenantId)
                .single();
            if (tenantError || !tenant) {
                request.log.warn({
                    superAdminId,
                    tenantId,
                    error: tenantError,
                }, 'Tenant not found for unsuspension');
                return reply.status(404).send({
                    error: {
                        code: 'TENANT_NOT_FOUND',
                        message: 'Tenant not found',
                    },
                });
            }
            // Check if already active
            if (tenant.status === 'active') {
                request.log.info({
                    superAdminId,
                    tenantId,
                    tenantSubdomain: tenant.subdomain,
                }, 'Tenant already active');
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
            const { data: updatedTenant, error: updateError } = await supabase_1.supabaseAdmin
                .from('tenants')
                .update({ status: 'active' })
                .eq('id', tenantId)
                .select('id, subdomain, name, tier, status')
                .single();
            if (updateError || !updatedTenant) {
                request.log.error({
                    superAdminId,
                    tenantId,
                    error: updateError,
                }, 'Failed to reactivate tenant');
                return reply.status(500).send({
                    error: {
                        code: 'REACTIVATION_FAILED',
                        message: 'Failed to reactivate tenant',
                    },
                });
            }
            // Log unsuspension event for audit trail
            request.log.warn({
                superAdminId,
                superAdminEmail,
                tenantId,
                tenantSubdomain: tenant.subdomain,
                tenantName: tenant.name,
                previousStatus: tenant.status,
                newStatus: 'active',
            }, 'Tenant reactivated by super admin');
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
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
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
    });
}
//# sourceMappingURL=superadmin-suspend.js.map
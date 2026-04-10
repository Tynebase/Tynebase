"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = tenantRoutes;
const zod_1 = require("zod");
const supabase_1 = require("../lib/supabase");
const auth_1 = require("../middleware/auth");
const rateLimit_1 = require("../middleware/rateLimit");
const auditLog_1 = require("../lib/auditLog");
/**
 * Zod schema for tenant settings validation
 * Validates JSONB structure to prevent injection and ensure data integrity
 */
const settingsSchema = zod_1.z.object({
    branding: zod_1.z.object({
        logo_url: zod_1.z.string().url().optional(),
        logo_dark_url: zod_1.z.string().url().optional(),
        favicon_url: zod_1.z.string().url().optional(),
        primary_color: zod_1.z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
        secondary_color: zod_1.z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
        company_name: zod_1.z.string().max(100).optional(),
    }).optional(),
    ai_preferences: zod_1.z.object({
        default_provider: zod_1.z.enum(['openai', 'anthropic', 'cohere']).optional(),
        default_model: zod_1.z.string().max(50).optional(),
        temperature: zod_1.z.number().min(0).max(2).optional(),
    }).optional(),
    notifications: zod_1.z.object({
        email_enabled: zod_1.z.boolean().optional(),
        digest_frequency: zod_1.z.enum(['daily', 'weekly', 'never']).optional(),
    }).optional(),
    features: zod_1.z.object({
        collaboration_enabled: zod_1.z.boolean().optional(),
        ai_generation_enabled: zod_1.z.boolean().optional(),
        rag_chat_enabled: zod_1.z.boolean().optional(),
        document_export_enabled: zod_1.z.boolean().optional(),
    }).optional(),
}).strict();
/**
 * Zod schema for PATCH /api/tenants/:id request body
 */
const updateTenantSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100).optional(),
    settings: settingsSchema.optional(),
});
async function tenantRoutes(fastify) {
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
        preHandler: auth_1.authMiddleware,
    }, async (request, reply) => {
        try {
            const { id } = request.params;
            const user = request.user;
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
                fastify.log.warn({ userId: user.id, requestedTenantId: id, userTenantId: user.tenant_id }, 'Unauthorized tenant update attempt - tenant mismatch');
                return reply.code(403).send({
                    error: {
                        code: 'FORBIDDEN',
                        message: 'You do not have permission to update this tenant',
                        details: {},
                    },
                });
            }
            if (!user.is_super_admin && user.role !== 'admin') {
                fastify.log.warn({ userId: user.id, role: user.role, tenantId: id }, 'Unauthorized tenant update attempt - insufficient role');
                return reply.code(403).send({
                    error: {
                        code: 'INSUFFICIENT_PERMISSIONS',
                        message: 'Only admins can update tenant settings',
                        details: {},
                    },
                });
            }
            // Verify tenant exists
            const { data: existingTenant, error: fetchError } = await supabase_1.supabaseAdmin
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
            const updateData = {};
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
                    }
                    else {
                        updateData.settings[key] = value;
                    }
                }
            }
            // Perform update
            const { data: updatedTenant, error: updateError } = await supabase_1.supabaseAdmin
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
            fastify.log.info({
                userId: user.id,
                tenantId: id,
                updatedFields: Object.keys(updateData),
            }, 'Tenant updated successfully');
            (0, auditLog_1.writeAuditLog)({
                tenantId: id,
                actorId: user.id,
                action: 'settings.tenant_updated',
                actionType: 'settings',
                targetName: updatedTenant.name,
                ipAddress: (0, auditLog_1.getClientIp)(request),
                metadata: { fields_updated: Object.keys(updateData) },
            });
            return reply.code(200).send({
                success: true,
                data: {
                    tenant: updatedTenant,
                },
            });
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
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
        preHandler: [rateLimit_1.rateLimitMiddleware],
    }, async (request, reply) => {
        try {
            const { domain } = request.query;
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
                const { data, error } = await supabase_1.supabaseAdmin
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
            }
            else {
                // Custom domain case: docs.acme.com
                const { data, error } = await supabase_1.supabaseAdmin
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
        }
        catch (error) {
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
        preHandler: [rateLimit_1.rateLimitMiddleware],
    }, async (request, reply) => {
        try {
            const { subdomain } = request.params;
            const { data: tenant, error } = await supabase_1.supabaseAdmin
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
        }
        catch (error) {
            fastify.log.error({ error }, 'Error in GET /api/public/tenant/:subdomain');
            return reply.code(500).send({
                error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
            });
        }
    });
}
//# sourceMappingURL=tenants.js.map
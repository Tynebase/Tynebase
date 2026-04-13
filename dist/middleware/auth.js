"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
const supabase_1 = require("../lib/supabase");
const roles_1 = require("../lib/roles");
/**
 * JWT Authentication Middleware (Multi-Tenant Aware)
 *
 * Verifies Supabase JWT token and resolves the user's profile for the
 * correct tenant.  Resolution order:
 *
 *   1. If `request.tenant` is already set (by tenantContextMiddleware from
 *      the `x-tenant-subdomain` header), look up the user row for that
 *      specific tenant.
 *   2. Otherwise fall back to the user's *primary* workspace — identified by
 *      `original_tenant_id IS NULL` (they created it) or by the admin role.
 *   3. If neither is found, take the first active membership.
 *
 * After resolution, `request.user` and (if missing) `request.tenant` are
 * populated for downstream handlers.
 */
async function authMiddleware(request, reply) {
    // ── 1. Extract & validate Bearer token ────────────────────────────────
    const authHeader = request.headers.authorization;
    if (!authHeader) {
        return reply.status(401).send({
            error: {
                code: 'MISSING_AUTH_TOKEN',
                message: 'Authorization header is required',
            },
        });
    }
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token || token === authHeader) {
        return reply.status(401).send({
            error: {
                code: 'INVALID_AUTH_FORMAT',
                message: 'Authorization header must be in format: Bearer <token>',
            },
        });
    }
    try {
        // ── 2. Verify JWT with Supabase ───────────────────────────────────
        const { data: authData, error: authError } = await supabase_1.supabaseAdmin.auth.getUser(token);
        if (authError || !authData?.user) {
            request.log.warn({ error: authError?.message }, 'JWT verification failed');
            return reply.status(401).send({
                error: {
                    code: 'INVALID_TOKEN',
                    message: 'Invalid or expired token',
                },
            });
        }
        const authUser = authData.user;
        const userId = authUser.id;
        const userEmail = authUser.email;
        if (!userEmail) {
            request.log.error({ userId }, 'User email missing from JWT');
            return reply.status(401).send({
                error: {
                    code: 'INVALID_TOKEN',
                    message: 'Invalid token payload',
                },
            });
        }
        // ── 3. Resolve user profile ─────────────────────────────────────
        const tenantContext = request.tenant;
        let userData = null;
        let dbError = null;
        if (tenantContext?.id) {
            // 3a. Tenant already resolved from subdomain header → strict lookup
            const { data, error } = await supabase_1.supabaseAdmin
                .from('users')
                .select('id, email, full_name, role, tenant_id, is_super_admin, status, original_tenant_id')
                .eq('id', userId)
                .eq('tenant_id', tenantContext.id)
                .maybeSingle();
            userData = data;
            dbError = error;
            // If user has no membership for this specific tenant, check if they
            // are a super admin (they can access any tenant).
            if (!userData && !dbError) {
                const { data: anyRow } = await supabase_1.supabaseAdmin
                    .from('users')
                    .select('id, email, full_name, role, tenant_id, is_super_admin, status')
                    .eq('id', userId)
                    .eq('is_super_admin', true)
                    .eq('status', 'active')
                    .limit(1)
                    .maybeSingle();
                if (anyRow) {
                    // Super admin accessing a different tenant — use their profile
                    // but point tenant_id at the tenant from the subdomain context.
                    userData = { ...anyRow, tenant_id: tenantContext.id };
                }
            }
        }
        else {
            // 3b. No subdomain context → find the user's primary workspace.
            //     With the composite PK a user can have rows in many tenants.
            const { data: allRows, error } = await supabase_1.supabaseAdmin
                .from('users')
                .select('id, email, full_name, role, tenant_id, is_super_admin, status, original_tenant_id')
                .eq('id', userId)
                .eq('status', 'active');
            dbError = error;
            if (allRows && allRows.length > 0) {
                // Prefer the *home* workspace: original_tenant_id IS NULL means
                // this user is the creator of that workspace.
                userData =
                    allRows.find((r) => r.original_tenant_id === null || r.original_tenant_id === r.tenant_id) ||
                        // Then prefer admin role
                        allRows.find((r) => r.role === 'admin' || r.is_super_admin) ||
                        // Any active row
                        allRows[0];
                // Also populate request.tenant for downstream handlers
                if (userData?.tenant_id) {
                    const { data: tenant } = await supabase_1.supabaseAdmin
                        .from('tenants')
                        .select('id, subdomain, name, tier, settings, storage_limit')
                        .eq('id', userData.tenant_id)
                        .single();
                    if (tenant) {
                        request.tenant = {
                            id: tenant.id,
                            subdomain: tenant.subdomain,
                            name: tenant.name,
                            tier: tenant.tier,
                            settings: tenant.settings || {},
                            storage_limit: tenant.storage_limit,
                        };
                        request.log.debug({ tenantId: tenant.id }, 'Tenant context populated from user profile');
                    }
                }
            }
        }
        // ── 4. Handle missing profile ───────────────────────────────────
        if (dbError) {
            request.log.error({ userId, error: dbError }, 'User lookup failed');
            return reply.status(500).send({
                error: {
                    code: 'AUTH_ERROR',
                    message: 'Failed to look up user profile',
                },
            });
        }
        if (!userData) {
            request.log.warn({ userId, tenantId: tenantContext?.id }, 'No user profile found');
            return reply.status(401).send({
                error: {
                    code: 'USER_NOT_FOUND',
                    message: 'User account not found',
                },
            });
        }
        // ── 5. Check suspension ─────────────────────────────────────────
        if (userData.status === 'suspended') {
            request.log.warn({ userId, tenantId: userData.tenant_id }, 'Suspended user attempted to access API');
            return reply.status(403).send({
                error: {
                    code: 'USER_SUSPENDED',
                    message: 'Your account has been suspended',
                },
            });
        }
        // Check tenant suspension (skip for super admins)
        if (!userData.is_super_admin) {
            const { data: tenantData } = await supabase_1.supabaseAdmin
                .from('tenants')
                .select('id, status')
                .eq('id', userData.tenant_id)
                .single();
            if (!tenantData) {
                request.log.error({ userId, tenantId: userData.tenant_id }, 'Tenant not found for user');
                return reply.status(403).send({
                    error: {
                        code: 'TENANT_NOT_FOUND',
                        message: 'Your organization account not found',
                    },
                });
            }
            if (tenantData.status === 'suspended') {
                request.log.warn({ userId, tenantId: userData.tenant_id }, 'User from suspended tenant attempted to access API');
                return reply.status(403).send({
                    error: {
                        code: 'TENANT_SUSPENDED',
                        message: 'Your organization has been suspended. Please contact support.',
                    },
                });
            }
        }
        // ── 6. Populate request.user ────────────────────────────────────
        const normalizedRole = (0, roles_1.normalizeWorkspaceRole)(userData.role);
        request.user = {
            id: userData.id,
            email: userData.email,
            full_name: userData.full_name,
            role: normalizedRole,
            tenant_id: userData.tenant_id,
            is_super_admin: userData.is_super_admin || false,
        };
        request.log.info({
            userId: userData.id,
            tenantId: userData.tenant_id,
            role: normalizedRole,
        }, 'User authenticated successfully');
    }
    catch (error) {
        request.log.error({ error }, 'Authentication error');
        return reply.status(500).send({
            error: {
                code: 'AUTH_ERROR',
                message: 'Authentication failed',
            },
        });
    }
}
//# sourceMappingURL=auth.js.map